"""Cross-clinic identity, history, lifecycle and company isolation regressions."""
from datetime import date, datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from auth import get_current_user
from database import Base, get_db
from models import (Company, Clinic, User, Client, Family, OpticalExam, MedicalLog,
                    Order, ContactLensOrder, Appointment, File, Referral, OrderGroup,
                    ExamLayoutInstance, TrashMember, RecentClientVisit)
from EndPoints import clients, exams, families, unified_exam_data
from schemas import ClientMergeRequest
from security.scope import assert_clinic_scope, client_scope_conditions, get_scoped_client
from services.trash_service import move_to_trash, restore_item
from services.clinic_data_prune_service import _delete_operational_rows, _queue_storage_objects
from services.order_group_service import save_group


@pytest.fixture()
def scope():
    engine = create_engine('sqlite:///:memory:', poolclass=StaticPool, connect_args={'check_same_thread': False})
    @event.listens_for(engine, 'connect')
    def enable_fk(connection, _):
        connection.execute('PRAGMA foreign_keys=ON')
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    db = sessions()
    companies = [Company(name=name, owner_full_name='Synthetic') for name in ('Shared', 'Other')]
    db.add_all(companies); db.flush()
    a, b, c = [Clinic(name=name, unique_id=name, company_id=companies[index].id) for name, index in (('A', 0), ('B', 0), ('C', 1))]
    db.add_all([a,b,c]); db.flush()
    user = User(company_id=a.company_id, clinic_id=b.id, username='worker', role_level=2)
    family = Family(company_id=a.company_id, clinic_id=a.id, name='Family')
    client = Client(company_id=a.company_id, clinic_id=a.id, first_name='Sarah')
    outsider = Client(company_id=c.company_id, clinic_id=c.id, first_name='Other')
    db.add_all([user,family,client,outsider]); db.commit()
    app = FastAPI()
    for module in (clients, exams, families, unified_exam_data):
        app.include_router(module.router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user
    with TestClient(app) as http:
        yield SimpleNamespace(db=db, http=http, user=user, a=a, b=b, c=c, client=client, outsider=outsider, family=family)
    db.close(); engine.dispose()


def directory(s, clinic_id):
    return s.db.query(Client).filter(*client_scope_conditions(s.db, s.user, clinic_id)).all()


def test_shared_directory_and_company_history(scope):
    s=scope
    assert directory(s, s.b.id)==[]
    response=s.http.post('/exams/',json={'client_id':s.client.id,'clinic_id':s.b.id,'exam_date':'2026-11-02','test_name':'Follow up'})
    assert response.status_code==200, response.text
    assert response.json()['company_id']==s.a.company_id
    assert directory(s,s.a.id)==[s.client]
    assert directory(s,s.b.id)==[s.client]
    assert directory(s,None)==[s.client]
    s.db.add(OpticalExam(client_id=s.client.id,clinic_id=s.a.id,test_name='Original'));s.db.commit()
    all_history=s.http.get(f'/exams/client/{s.client.id}')
    assert all_history.status_code==200 and len(all_history.json())==2
    filtered=s.http.get(f'/exams/client/{s.client.id}',params={'clinic_id':s.b.id})
    assert len(filtered.json())==1
    assert s.http.get(f'/clients/{s.outsider.id}').status_code==403
    assert s.http.get('/clients/',params={'clinic_id':s.c.id}).status_code==403
    assert s.http.post('/exams/',json={'client_id':s.client.id,'clinic_id':s.c.id}).status_code==403
    # Sharing records never grants clinic-settings administration.
    with pytest.raises(HTTPException): assert_clinic_scope(s.db,s.user,s.a.id)


def test_family_can_have_clients_registered_elsewhere(scope):
    s=scope
    s.client.family_id=s.family.id
    s.db.add(Appointment(client_id=s.client.id,clinic_id=s.b.id,date=date.today()));s.db.commit()
    result=s.http.get('/families/',params={'clinic_id':s.b.id})
    assert result.status_code==200 and result.json()[0]['id']==s.family.id
    assert result.json()[0]['clients'][0]['id']==s.client.id


def test_legacy_recent_visit_without_admin_clinic_preserves_registration_fallback(scope):
    s = scope
    s.user.clinic_id = None
    s.user.role_level = 4
    s.db.commit()
    for _ in range(2):
        response = s.http.post(f'/clients/{s.client.id}/recent-visit')
        assert response.status_code == 200, response.text
    visit = s.db.query(RecentClientVisit).filter_by(user_id=s.user.id, client_id=s.client.id).one()
    assert visit.clinic_id == s.a.id
    assert s.http.post(f'/clients/{s.outsider.id}/recent-visit').status_code == 403


def test_recent_visit_keeps_active_and_explicit_clinic_attribution(scope):
    s = scope
    response = s.http.post(f'/clients/{s.client.id}/recent-visit')
    assert response.status_code == 200, response.text
    visit = s.db.query(RecentClientVisit).filter_by(user_id=s.user.id, client_id=s.client.id).one()
    assert visit.clinic_id == s.b.id
    s.user.clinic_id = None
    s.user.role_level = 4
    s.db.commit()
    response = s.http.post(f'/clients/{s.client.id}/recent-visit', params={'clinic_id': s.b.id})
    assert response.status_code == 200, response.text
    assert s.db.query(RecentClientVisit).filter_by(user_id=s.user.id, client_id=s.client.id).count() == 1
    assert s.http.post(f'/clients/{s.client.id}/recent-visit', params={'clinic_id': s.c.id}).status_code == 403


def test_inactive_history_readable_new_work_blocked_origin_immutable(scope):
    s=scope
    exam=OpticalExam(client_id=s.client.id,clinic_id=s.a.id);s.db.add(exam);s.db.commit()
    s.a.is_active=False;s.db.commit()
    assert s.http.get(f'/exams/{exam.id}').status_code==200
    assert s.http.post('/exams/',json={'client_id':s.client.id,'clinic_id':s.a.id}).status_code==403
    exam.clinic_id=s.b.id
    with pytest.raises(HTTPException,match='companyClients.ownershipImmutable'): s.db.flush()
    s.db.rollback()


def test_nested_exam_data_is_company_scoped(scope):
    s=scope
    exam=OpticalExam(client_id=s.outsider.id,clinic_id=s.c.id);s.db.add(exam);s.db.flush()
    instance=ExamLayoutInstance(exam_id=exam.id,exam_data={'secret':True});s.db.add(instance);s.db.commit()
    assert s.http.get(f'/unified-exam-data/{instance.id}').status_code==403
    assert s.http.post(f'/unified-exam-data/{instance.id}',json={}).status_code==403
    assert s.http.get(f'/unified-exam-data/{instance.id}/component/secret').status_code==403
    assert s.http.delete(f'/unified-exam-data/{instance.id}').status_code==403


def test_cross_company_links_rejected_for_non_http_writers(scope):
    s=scope
    s.db.add(MedicalLog(client_id=s.client.id,clinic_id=s.c.id,log='Invalid'))
    with pytest.raises(HTTPException):s.db.flush()
    s.db.rollback()
    s.client.family_id=s.family.id;s.db.commit()
    s.outsider.family_id=s.family.id
    with pytest.raises(HTTPException):s.db.flush()
    s.db.rollback()


def test_cross_clinic_merge_preserves_activity_and_protected_group(scope):
    s=scope
    duplicate=Client(company_id=s.a.company_id,clinic_id=s.b.id,first_name='Duplicate');s.db.add(duplicate);s.db.flush()
    exam=OpticalExam(client_id=duplicate.id,clinic_id=s.b.id);s.db.add(exam);s.db.commit()
    group=save_group(s.db,s.user,{'clinic_id':s.b.id,'payer_client_id':duplicate.id,
        'entries':[{'client_key':'one','kind':'regular','order':{'client_id':duplicate.id,'order_date':'2026-11-02'}},
                   {'client_key':'two','kind':'contact','order':{'client_id':s.client.id,'order_date':'2026-11-02'}}]},creation_key='merge')
    result=clients.merge_clients(ClientMergeRequest(canonical_client_id=s.client.id,duplicate_client_ids=[duplicate.id]),s.db,s.user)
    assert result['merged_client_ids']==[duplicate.id]
    s.db.expire_all()
    assert s.db.get(OpticalExam,exam.id).client_id==s.client.id
    assert s.db.get(OpticalExam,exam.id).clinic_id==s.b.id
    assert s.db.get(OrderGroup,group['id']).payer_client_id==s.client.id
    assert s.db.get(OrderGroup,group['id']).legacy_write_protected


def test_company_delete_restore_and_clinic_cleanup_preserve_profiles(scope):
    s=scope
    first=OpticalExam(client_id=s.client.id,clinic_id=s.a.id)
    second=OpticalExam(client_id=s.client.id,clinic_id=s.b.id)
    s.db.add_all([first,second]);s.db.commit()
    item=move_to_trash(s.db,s.user,'client',s.client.id)
    assert s.db.query(OpticalExam).count()==0
    restore_item(s.db,s.user,item.id)
    assert s.db.query(OpticalExam).count()==2
    _delete_operational_rows(s.db,SimpleNamespace(clinic_id=s.a.id));s.db.commit()
    assert s.db.get(Client,s.client.id) is not None
    assert s.db.query(OpticalExam).one().id==second.id
    assert s.db.get(Family,s.family.id) is not None


def test_merged_client_links_resolve_full_company_history(scope):
    s=scope
    old=Client(company_id=s.a.company_id,clinic_id=s.a.id,first_name='Old')
    s.db.add(old);s.db.flush()
    old.merged_into_client_id=s.client.id
    s.db.add(OpticalExam(client_id=s.client.id,clinic_id=s.b.id));s.db.commit()
    assert s.http.get(f'/clients/{old.id}').json()['id']==s.client.id
    assert len(s.http.get(f'/exams/client/{old.id}').json())==1


def test_calendar_reconciliation_uses_assigned_owner_and_original_clinic(scope,monkeypatch):
    from auth import encrypt_secret
    from services import google_calendar as calendar
    s=scope
    owner=User(company_id=s.a.company_id,clinic_id=s.a.id,username='examiner',role_level=2,
        google_account_connected=True,google_calendar_sync_enabled=True,google_access_token=encrypt_secret('assigned-owner-token'))
    s.db.add(owner);s.db.flush()
    appointment=Appointment(client_id=s.client.id,clinic_id=s.a.id,user_id=owner.id,date=date(2026,11,2),time='10:00',duration=30)
    s.db.add(appointment);s.db.commit()
    calls=[]
    def send(method,url,**kwargs):
        calls.append((url,kwargs))
        return SimpleNamespace(status_code=200,json=lambda:{'id':'assigned-event'})
    monkeypatch.setattr(calendar.requests,'request',send)
    calendar.enqueue(s.db,appointment)
    s.db.commit()
    calendar.run_once(s.db)
    assert appointment.calendar_sync_owned
    assert appointment.google_calendar_event_id==calendar.event_id(appointment.id,owner.id,0)
    assert calls[0][1]['headers']['Authorization']=='Bearer assigned-owner-token'
    assert calls[0][1]['json']['location']==s.a.name


def test_cross_clinic_exam_instances_shared_but_other_company_denied(scope):
    from EndPoints import exam_layouts
    s=scope
    own=OpticalExam(client_id=s.client.id,clinic_id=s.a.id)
    other=OpticalExam(client_id=s.outsider.id,clinic_id=s.c.id)
    s.db.add_all([own,other]);s.db.flush()
    first=ExamLayoutInstance(exam_id=own.id,exam_data={});second=ExamLayoutInstance(exam_id=other.id,exam_data={})
    s.db.add_all([first,second]);s.db.commit()
    assert exam_layouts.get_exam_layout_instance(first.id,s.db,s.user)['exam_id']==own.id
    s.user.role_level=4;s.db.commit()
    with pytest.raises(HTTPException) as error:exam_layouts.get_exam_layout_instance(second.id,s.db,s.user)
    assert error.value.status_code==403


@pytest.mark.parametrize('model,extra',[(OpticalExam,{}),(MedicalLog,{}),(Order,{}),(ContactLensOrder,{}),
    (Appointment,{}),(File,{'file_name':'test.pdf'}),(Referral,{'referral_notes':'Synthetic referral'})])
def test_every_independent_activity_derives_company_for_import_writers(scope,model,extra):
    s=scope
    record=model(client_id=s.client.id,clinic_id=s.b.id,**extra)
    s.db.add(record);s.db.commit()
    assert record.company_id==s.a.company_id
    assert record.clinic_id==s.b.id


def test_merge_keeps_registration_membership_without_activity(scope):
    s=scope
    duplicate=Client(company_id=s.a.company_id,clinic_id=s.b.id,first_name='Duplicate')
    s.db.add(duplicate);s.db.commit()
    clients.merge_clients(ClientMergeRequest(canonical_client_id=s.client.id,duplicate_client_ids=[duplicate.id]),s.db,s.user)
    assert directory(s,s.b.id)==[s.client]


def test_purging_merged_identity_cannot_resurrect_alias_profiles(scope):
    from models import TrashJob
    from services.trash_service import _purge
    s=scope
    duplicate=Client(company_id=s.a.company_id,clinic_id=s.b.id,first_name='Duplicate')
    s.db.add(duplicate);s.db.commit()
    clients.merge_clients(ClientMergeRequest(canonical_client_id=s.client.id,duplicate_client_ids=[duplicate.id]),s.db,s.user)
    group=save_group(s.db,s.user,{'clinic_id':s.b.id,'payer_client_id':s.client.id,
        'entries':[{'kind':'regular','order':{'client_id':s.client.id,'order_date':'2026-11-02'}}]},creation_key='purge-merged')
    item=move_to_trash(s.db,s.user,'client',s.client.id)
    job=TrashJob(trash_item_id=item.id,job_type='purge',payload={});s.db.add(job);s.db.commit()
    _purge(s.db,job,SimpleNamespace(remove=lambda *args:None));s.db.commit()
    assert s.db.query(Client).execution_options(include_deleted=True).filter(Client.id.in_([s.client.id,duplicate.id])).count()==0
    assert s.db.query(OrderGroup).execution_options(include_deleted=True).filter(OrderGroup.id==group['id']).count()==0


def test_foreign_clinic_inventory_read_requires_a_matching_company_order(scope):
    from EndPoints.inventory import list_variants
    s=scope
    own=Order(client_id=s.client.id,clinic_id=s.a.id)
    foreign=Order(client_id=s.outsider.id,clinic_id=s.c.id)
    s.db.add_all([own,foreign]);s.db.commit()
    def variants(clinic_id,order_id=None):
        return list_variants(clinic_id=clinic_id,order_id=order_id,order_kind='regular',category=None,
            search=None,barcode=None,include_archived=False,stockable_only=False,limit=500,offset=0,db=s.db,current_user=s.user)
    with pytest.raises(HTTPException):variants(s.a.id)
    assert variants(s.a.id,own.id)['clinic_id']==s.a.id
    with pytest.raises(HTTPException):variants(s.c.id,foreign.id)
    with pytest.raises(HTTPException):variants(s.b.id,own.id)


def test_historical_staff_directory_exposes_only_company_labels(scope):
    from EndPoints.users import get_record_staff
    s=scope
    inconsistent=User(company_id=s.c.company_id,clinic_id=s.a.id,username='Other-company identity',role_level=2)
    s.db.add(inconsistent);s.db.commit()
    labels=get_record_staff(s.db,s.user)
    assert [row['id'] for row in labels]==[s.user.id]
    assert all(not any('token' in key or 'password' in key for key in row) for row in labels)


def test_exam_clinic_names_follow_service_clinic_in_list_history_search_and_sort(scope):
    s=scope
    s.a.name="North clinic";s.b.name="South clinic"
    connection = s.db.connection().connection.driver_connection
    connection.create_function("to_char",2,lambda value,_format:value)
    connection.create_function("regexp_replace",4,lambda *_args:None)
    s.db.add_all([
        OpticalExam(client_id=s.client.id,clinic_id=s.a.id,clinic='Conflicting legacy label',type='exam'),
        OpticalExam(client_id=s.client.id,clinic_id=s.b.id,type='exam'),
    ]);s.db.commit()
    response=s.http.get('/exams/enriched',params={'order':'clinic_asc'})
    assert response.status_code==200,response.text
    assert [exam['clinic_name'] for exam in response.json()['items']]==[s.a.name,s.b.name]
    history=s.http.get(f'/exams/client/{s.client.id}').json()
    assert {exam['clinic_id']:exam['clinic_name'] for exam in history}=={s.a.id:s.a.name,s.b.id:s.b.name}
    searched=s.http.get('/exams/enriched',params={'search':s.a.name}).json()
    assert [exam['clinic_name'] for exam in searched['items']]==[s.a.name]
