"""The public local-test tunnel must not become a proxy for the clinic API."""
import base64
import hashlib
import hmac
import json
import time
import httpx
import pytest
from fastapi.testclient import TestClient
from scripts import campaign_callback_gateway as gateway
from services import campaign_providers as providers
from config import settings


@pytest.mark.parametrize('method,path', [
    ('GET','/api/v1/clients'), ('POST','/api/v1/auth/login'), ('GET','/health'),
    ('GET','/docs'), ('GET','/api/v1/messaging/webhooks/resend'),
    ('POST','/api/v1/messaging/webhooks/micropay'),
    ('PUT','/api/v1/messaging/webhooks/resend'),
    ('GET','/api/v1/messaging/unsubscribe/invalid'),
    ('POST','/api/v1/messaging/webhooks/resend?redirect=/api/v1/clients'),
])
def test_gateway_blocks_every_unrelated_route(method, path, monkeypatch):
    def unexpected(*args, **kwargs):
        raise AssertionError('Unrelated route reached the upstream client')
    monkeypatch.setattr(gateway.httpx,'AsyncClient',unexpected)
    assert TestClient(gateway.app).request(method,path).status_code==404


def test_gateway_preserves_signed_bytes_and_strips_user_credentials(monkeypatch):
    body=b'{ "type": "email.delivered" }'
    class Client:
        def __init__(self, **kwargs): assert kwargs['trust_env'] is False
        async def __aenter__(self): return self
        async def __aexit__(self,*args): pass
        async def request(self,method,url,*,content,headers):
            assert method=='POST' and url=='http://127.0.0.1:8000/api/v1/messaging/webhooks/resend'
            assert content==body
            assert headers=={'svix-id':'event-id','content-type':'application/json'}
            return httpx.Response(400,json={'detail':'invalid_signature'})
    monkeypatch.setattr(gateway.httpx,'AsyncClient',Client)
    response=TestClient(gateway.app).post('/api/v1/messaging/webhooks/resend',content=body,
        headers={'svix-id':'event-id','content-type':'application/json','authorization':'Bearer private','cookie':'session=private'})
    assert response.status_code==400 and response.headers['cache-control']=='no-store'


def test_gateway_blocks_oversized_requests():
    assert TestClient(gateway.app).post('/api/v1/messaging/webhooks/resend',content=b'x'*65537).status_code==413


def test_gateway_allows_only_complete_unsubscribe_tokens():
    valid='/api/v1/messaging/unsubscribe/'+'a'*32+'.'+'b'*32
    assert gateway.allowed('GET',valid) and gateway.allowed('POST',valid)
    assert not gateway.allowed('GET',valid+'/clients')
    assert not gateway.allowed('DELETE',valid)


def test_signed_events_for_other_domains_are_ignored_before_clinic_lookup(monkeypatch):
    secret=b'callback-test-secret'
    monkeypatch.setattr(settings,'CAMPAIGN_EMAIL_FROM','Prysm <campaigns@mail.prysm.co.il>')
    monkeypatch.setattr(settings,'CAMPAIGN_RESEND_WEBHOOK_SECRET','whsec_'+base64.b64encode(secret).decode())
    body=json.dumps({'type':'email.delivered','data':{'from':'Tavi <hello@tavi24.org>','email_id':'other-account-email'}}).encode()
    stamp=str(int(time.time()));event_id='evt-test'
    signature=base64.b64encode(hmac.new(secret,event_id.encode()+b'.'+stamp.encode()+b'.'+body,hashlib.sha256).digest()).decode()
    headers={'svix-id':event_id,'svix-timestamp':stamp,'svix-signature':'v1,'+signature}
    assert providers.verify_resend(body,headers)=={'ignored':True}
    with pytest.raises(ValueError):providers.verify_resend(body+b' ',headers)


def test_gateway_admits_only_exact_short_links_and_secret_sms_callbacks():
    short='/s/'+'a'*38
    callback='/api/v1/messaging/webhooks/micropay/'+'x'*40
    assert gateway.allowed('GET',short) and gateway.allowed('POST',short)
    assert gateway.allowed('POST',callback)
    assert not gateway.allowed('GET',callback)
    assert not gateway.allowed('POST',callback+'/clients')
    assert not gateway.allowed('GET',short+'a')
    assert not gateway.allowed('GET',short+'/clients')


def test_gateway_only_admits_signed_payment_callback_route():
    path = '/api/v1/subscriptions/webhooks/allpay'
    assert gateway.allowed('POST', path)
    assert not gateway.allowed('GET', path)
    assert not gateway.allowed('POST', path + '/other')
