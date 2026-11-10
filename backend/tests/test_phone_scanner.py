import os
import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
os.environ.setdefault('DATABASE_URL','sqlite:///:memory:')
os.environ.setdefault('PRYSM_AGENT_SERVICES_MANAGED','1')
from test_inventory_v1 import _session_factory, _seed
from database import get_db
from auth import get_current_user, get_current_auth_session
from models import User, AuthSession, CatalogProduct, CatalogVariant
from scanner_models import ScannerScan, ScannerPairing, ScannerDevice, ScannerEvent
from EndPoints.scanner import router
from config import settings
from services.scanner_provenance import preserve_provenance

@pytest.fixture
def scanner(monkeypatch):
    monkeypatch.setattr(settings,'SCANNER_ENABLED',True)
    factory=_session_factory(); ids=_seed(factory)
    with factory() as db:
        session=AuthSession(id='test-session',user_id=ids['worker'],company_id=ids['company'],clinic_id=ids['clinic'],refresh_token_hash='testhash',expires_at=datetime.now(timezone.utc)+timedelta(days=1))
        p=CatalogProduct(company_id=ids['company'],category='frame',brand='Test',model='Frame',normalized_key='test-frame')
        db.add_all([session,p]);db.flush()
        v=CatalogVariant(company_id=ids['company'],product_id=p.id,barcode='0012345678905',sku='test',attributes={},normalized_fingerprint='test-frame',currency='ILS',is_stockable=True)
        db.add(v);db.commit();ids['variant']=v.id
    app=FastAPI();app.include_router(router)
    def database():
        with factory() as db: yield db
    def user():
        with factory() as db: return db.get(User,ids['worker'])
    def session():
        with factory() as db: return db.get(AuthSession,'test-session')
    app.dependency_overrides.update({get_db:database,get_current_user:user,get_current_auth_session:session})
    with TestClient(app) as client: yield client,factory,ids

def setup(client,ids):
    r=client.post('/scanner/devices',json={'name':'Reception','clinic_id':ids['clinic']});assert r.status_code==200,r.text
    d=r.json();binding={'secret':d['secret'],'lease':'lease','context':'context','destination':'order'}
    assert client.put(f"/scanner/devices/{d['id']}/receiver",json=binding).status_code==200
    r=client.post(f"/scanner/devices/{d['id']}/pairing",json={'secret':d['secret']});code=r.json()['code']
    r=client.post('/scanner/pair',json={'code':code});assert r.status_code==200,r.text
    headers={'Authorization':'Bearer '+r.json()['token']}
    assert client.post(f"/scanner/phone/devices/{d['id']}/start",json={},headers=headers).status_code==200
    return d,binding,headers,code

def test_pair_delivery_history_and_duplicate(scanner):
    c,f,ids=scanner;d,b,h,code=setup(c,ids)
    assert c.post('/scanner/pair',json={'code':code}).status_code==400
    path=f"/scanner/phone/devices/{d['id']}/scans"
    payload={'request_id':'one','barcode':'0012345678905','lease':'lease','context':'context'}
    r=c.post(path,json=payload,headers=h);assert r.status_code==200,r.text
    scan=r.json();assert scan['barcode']=='0012345678905';assert scan['variant_id']==ids['variant']
    assert c.post(path,json=payload,headers=h).json()['id']==scan['id']
    r=c.patch('/scanner/scans/'+scan['id'],json={'status':'applied'});assert r.status_code==200,r.text
    assert c.patch('/scanner/scans/'+scan['id'],json={'status':'rejected'}).json()['status']=='applied'
    history=c.get('/scanner/history',params={'clinic_id':ids['clinic']}).json();assert len(history['items'])==1
    r=c.get(f"/scanner/variants/{ids['variant']}?clinic_id={ids['clinic']}");assert r.status_code==200,r.text
    assert len(r.json()['items'])==1

def test_desktop_scan_includes_fresh_details_without_sharing_them_in_phone_events(scanner):
    c,f,ids=scanner;d,b,h,_=setup(c,ids)
    payload={'request_id':'desktop-detail','barcode':'0012345678905','lease':'lease','context':'context'}
    r=c.post(f"/scanner/devices/{d['id']}/scans",json=payload,headers={'X-Scanner-Device':d['secret']})
    assert r.status_code==200,r.text
    scan=r.json()
    assert scan['variant']['id']==ids['variant']
    assert scan['variant']['product']['model']=='Frame'
    assert 'default_cost' not in scan['variant']
    with f() as db:
        event=db.query(ScannerEvent).filter_by(device_id=d['id']).order_by(ScannerEvent.id.desc()).first()
        assert event.payload['type']=='scan'
        assert 'variant' not in event.payload['scan']
    history=c.get('/scanner/history',params={'clinic_id':ids['clinic']}).json()
    assert 'variant' not in history['items'][0]
    assert c.patch('/scanner/scans/'+scan['id'],json={'status':'displayed'}).status_code==200
    payload['request_id']='phone-detail'
    phone=c.post(f"/scanner/phone/devices/{d['id']}/scans",json=payload,headers=h)
    assert phone.status_code==200,phone.text
    assert 'variant' not in phone.json()

def test_unknown_desktop_barcode_returns_an_explicit_empty_detail(scanner):
    c,_,ids=scanner;d,_,_,_=setup(c,ids)
    r=c.post(f"/scanner/devices/{d['id']}/scans",headers={'X-Scanner-Device':d['secret']},
        json={'request_id':'unknown','barcode':'not-in-catalog','lease':'lease','context':'context'})
    assert r.status_code==200,r.text
    assert r.json()['variant'] is None

def test_context_revoke_and_phone_permissions(scanner):
    c,f,ids=scanner;d,b,h,_=setup(c,ids)
    # Scanner credentials cannot be used as clinician sessions in production;
    # phone endpoints also require a matching workstation grant.
    other=c.post('/scanner/devices',json={'name':'Other','clinic_id':ids['clinic']}).json()
    assert c.post(f"/scanner/phone/devices/{other['id']}/start",json={},headers=h).status_code==403
    b['context']='new';c.put(f"/scanner/devices/{d['id']}/receiver",json=b)
    assert c.post(f"/scanner/phone/devices/{d['id']}/scans",json={'request_id':'old','barcode':'abc','lease':'lease','context':'context'},headers=h).status_code==409
    c.request('DELETE',f"/scanner/devices/{d['id']}/grants",json={'secret':d['secret']})
    assert c.get('/scanner/phone/devices',headers=h).json()==[]

def test_pair_attempt_limits_and_binding(scanner):
    c,f,ids=scanner;d,b,h,_=setup(c,ids)
    b['secret']='wrong';assert c.put(f"/scanner/devices/{d['id']}/receiver",json=b).status_code==403
    for _ in range(4):assert c.post('/scanner/pair',json={'code':'BADBADBAD'}).status_code==400
    assert c.post('/scanner/pair',json={'code':'BADBADBAD'}).status_code==429

def test_provenance_older_clients_and_manual_edits():
    meta='{"frame":{"variant_id":1,"fields":{"model":"Original"}}}'
    old={'frame':{'model':'Original','_scan_provenance':meta}}
    kept=preserve_provenance(old,{'frame':{'model':'Original'}})
    assert 'frame' in __import__('json').loads(kept['frame']['_scan_provenance'])
    changed=preserve_provenance(old,{'frame':{'model':'Changed'}})
    assert changed['frame']['_scan_provenance']=='{}'

def test_phone_credentials_cannot_enroll_workstations(scanner):
    c,f,ids=scanner;d,b,h,_=setup(c,ids)
    c.app.dependency_overrides.pop(get_current_user)
    c.app.dependency_overrides.pop(get_current_auth_session)
    r=c.post('/scanner/devices',json={'name':'Forbidden','clinic_id':ids['clinic']},headers=h)
    assert r.status_code==401

def test_revoked_staff_session_stops_phone_delivery(scanner):
    c,f,ids=scanner;d,b,h,_=setup(c,ids)
    with f() as db:
        db.get(AuthSession,'test-session').revoked_at=datetime.now(timezone.utc)
        db.commit()
    assert c.get('/scanner/phone/devices',headers=h).json()[0]['online'] is False
    assert c.post(f"/scanner/phone/devices/{d['id']}/start",json={},headers=h).status_code==409


def test_company_wide_admin_session_can_receive_in_authorized_clinic(scanner):
    c, f, ids = scanner
    with f() as db:
        user = db.get(User, ids['worker'])
        user.role_level, user.clinic_id = 4, None
        db.get(AuthSession, 'test-session').clinic_id = None
        db.commit()
    d, binding, headers, _ = setup(c, ids)
    rows = c.get('/scanner/phone/devices', headers=headers).json()
    assert rows[0]['online'] is True
    response = c.post(f"/scanner/phone/devices/{d['id']}/scans", json={
        'request_id': 'company-count', 'barcode': '0012345678905',
        'lease': binding['lease'], 'context': binding['context'],
    }, headers=headers)
    assert response.status_code == 200, response.text


def test_explicit_other_clinic_session_cannot_register_receiver(scanner):
    c, f, ids = scanner
    d = c.post('/scanner/devices', json={'name': 'Reception', 'clinic_id': ids['clinic']}).json()
    with f() as db:
        db.get(AuthSession, 'test-session').clinic_id = ids['clinic'] + 100
        db.commit()
    response = c.put(f"/scanner/devices/{d['id']}/receiver", json={
        'secret': d['secret'], 'lease': 'lease', 'context': 'context',
    })
    assert response.status_code == 403


def test_other_company_session_cannot_register_receiver(scanner):
    c, f, ids = scanner
    d = c.post('/scanner/devices', json={'name': 'Reception', 'clinic_id': ids['clinic']}).json()
    with f() as db:
        db.get(AuthSession, 'test-session').company_id = ids['company'] + 100
        db.commit()
    response = c.put(f"/scanner/devices/{d['id']}/receiver", json={
        'secret': d['secret'], 'lease': 'lease', 'context': 'context',
    })
    assert response.status_code == 403


def test_unscoped_session_still_enforces_workers_assigned_clinic(scanner):
    from models import Clinic
    from auth import token_hash
    c, f, ids = scanner
    with f() as db:
        other = Clinic(company_id=ids['company'], name='Other', unique_id='scanner-other')
        db.add(other)
        db.flush()
        db.add(ScannerDevice(id='other-clinic-device', company_id=ids['company'],
                             clinic_id=other.id, name='Other', secret_hash=token_hash('known-secret')))
        db.get(AuthSession, 'test-session').clinic_id = None
        db.commit()
    response = c.put('/scanner/devices/other-clinic-device/receiver', json={
        'secret': 'known-secret', 'lease': 'lease', 'context': 'context',
    })
    assert response.status_code == 403
