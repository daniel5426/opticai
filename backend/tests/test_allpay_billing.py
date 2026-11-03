from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from auth import encrypt_secret, get_current_user
from config import settings
from database import Base, get_db
from EndPoints import admin, subscriptions
from models import (Company, Clinic, User, Subscription, SubscriptionInvoice, SubscriptionPaymentAttempt,
    SubscriptionPaymentMethod, SubscriptionAuditEvent, SubscriptionRefund)
from services import allpay, saas_billing as billing
from services.subscription_service import access_mode, ensure_legacy_subscription, require_module, enforce_workspace
from services.plan_catalog import require_plan
from security.owner import is_owner


@pytest.fixture()
def state(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine, expire_on_commit=False)()
    company = Company(name="One", owner_full_name="Owner")
    other = Company(name="Two", owner_full_name="Other")
    db.add_all([company, other]); db.flush()
    owner = User(id=1, company_id=company.id, username="owner", email="first@example.com", role_level=4, is_active=True)
    second = User(id=2, company_id=other.id, username="second", email="second@example.com", role_level=4, is_active=True)
    ceo = User(id=3, company_id=other.id, username="ceo", email="untrusted@example.com", role_level=4, is_active=True)
    clinic = Clinic(company_id=company.id, name="Main", unique_id="main", is_active=True)
    sub = Subscription(id="sub", company_id=company.id, plan_code="essential", status="active", provider="allpay",
        amount_minor=43000, automatic_billing=True, current_period_starts_at=billing.now()-timedelta(days=15),
        current_period_ends_at=billing.now()+timedelta(days=15), billing_anchor_at=billing.now()-timedelta(days=15),
        clinic_limit=1, staff_limit=5, billing_revision=0)
    db.add_all([owner, second, ceo, clinic, sub]); db.flush()
    db.add(SubscriptionPaymentMethod(company_id=company.id, token_encrypted=encrypt_secret("test-token"),
        card_last4="1234", card_brand="Visa", consent_at=billing.now(), consent_version=billing.CONSENT_VERSION))
    db.commit()
    monkeypatch.setattr(settings, "OWNER_USER_IDS", "1,2")
    monkeypatch.setattr(settings, "ALLPAY_API_KEY", "test-only-key")
    monkeypatch.setattr(settings, "BILLING_CHARGING_ENABLED", True)
    monkeypatch.setattr(settings, "ALLPAY_TEST_MODE", True)
    monkeypatch.setattr(settings, "SUBSCRIPTION_ENFORCEMENT_MODE", "enforce")
    class State: pass
    result = State()
    result.db, result.sub, result.owner, result.second, result.ceo, result.clinic = db, sub, owner, second, ceo, clinic
    result.user = owner
    app = FastAPI(); app.include_router(admin.router); app.include_router(subscriptions.router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: result.user
    with TestClient(app) as client:
        result.client = client
        yield result
    db.close(); engine.dispose()


def invoice_and_attempt(s, kind="initial", status="submitted", amount=43000):
    invoice = billing.new_invoice(s.db, s.sub, kind=kind, cycle=billing.uid(), amount=amount,
        start=billing.now(), end=billing.now()+timedelta(days=30))
    attempt = SubscriptionPaymentAttempt(id=billing.uid(), company_id=s.sub.company_id, invoice_id=invoice.id,
        kind="payment", status=status, consent_at=billing.now(), consent_version=billing.CONSENT_VERSION,
        submitted_at=billing.now(), test_mode=True, billing_revision=s.sub.billing_revision)
    s.db.add(attempt); s.db.commit()
    return invoice, attempt


def paid(attempt, amount=43000):
    return {"order_id": attempt.id, "status": 1, "amount": amount / 100, "currency_display": "ILS", "currency_payment": "ILS", "currency_course": 1}


def test_signature_keeps_zero_false_and_sorted_nested_objects():
    body = {"z": False, "items": [{"price": 100.0, "qty": 1, "name": "A"}], "empty": "", "nil": None, "a": 0}
    import hashlib
    expected = hashlib.sha256(b"0:A:100:1:0:key").hexdigest()
    assert allpay.signature(body, "key") == expected
    assert allpay.signature({**body, "sign": "ignored"}, "key") == expected
    assert allpay.signature({"x": Decimal("100.50")}, "key") == hashlib.sha256(b"100.5:key").hexdigest()


def test_expiry_and_timezone_aware_dates(state):
    sub = state.sub
    sub.current_period_ends_at = billing.now() - timedelta(seconds=1)
    assert access_mode(sub) == "read_only"
    sub.status = "trialing"; sub.trial_ends_at = billing.now() - timedelta(seconds=1)
    assert access_mode(sub) == "read_only"
    sub.status = "past_due"; sub.grace_ends_at = billing.now()+timedelta(days=1)
    assert access_mode(sub) == "full"
    sub.status = "cancelled"; sub.current_period_ends_at = billing.now()+timedelta(days=1)
    assert access_mode(sub) == "full"


def test_month_end_uses_original_anniversary():
    jan = datetime(2026, 1, 31, 12, tzinfo=UTC)
    feb = billing.month_after(jan, jan)
    assert feb.day == 28
    assert billing.month_after(feb, jan) == datetime(2026, 3, 31, 12, tzinfo=UTC)


def test_missing_subscription_never_grants_legacy(state):
    with pytest.raises(HTTPException) as error:
        ensure_legacy_subscription(state.db, state.second.company_id)
    assert error.value.status_code == 402
    assert state.db.query(Subscription).count() == 1


def test_owner_permissions_do_not_follow_email_or_role(state):
    for user in (state.owner, state.second):
        state.user = user
        assert state.client.get('/admin/me').status_code == 200
    state.user = state.ceo
    state.ceo.email = state.owner.email
    assert not is_owner(state.ceo)
    assert state.client.get('/admin/customers').status_code == 403
    assert state.client.patch(f'/admin/users/{state.owner.id}', json={"active":False,"reason":"test"}).status_code == 403


def test_empty_and_invalid_owner_configuration_denies_everyone(state, monkeypatch):
    for value in ("", "1,not-an-id"):
        monkeypatch.setattr(settings, "OWNER_USER_IDS", value)
        assert state.client.get('/admin/me').status_code == 403


def test_checkout_requires_consent_and_charging_switch(state, monkeypatch):
    assert state.client.post('/subscriptions/checkout-session', json={}).status_code == 400
    monkeypatch.setattr(settings, "BILLING_CHARGING_ENABLED", False)
    assert state.client.post('/subscriptions/checkout-session', json={"consent":True}).status_code == 503


def test_checkout_initial_amount_and_reused_iframe(state, monkeypatch):
    state.sub.status = "pending_checkout"; state.db.commit()
    calls=[]
    def provider(endpoint, body):
        calls.append((endpoint, body))
        assert state.db.get(SubscriptionPaymentAttempt, body['order_id']) is not None
        return {"payment_url":"https://allpay.to/test"}
    monkeypatch.setattr(allpay, 'request', provider)
    response=state.client.post('/subscriptions/checkout-session', json={"consent":True,"language":"fr"})
    assert response.status_code==200
    assert response.json()['amount_minor']==43000
    assert calls[0][1]['items'][0]['price']==430
    assert calls[0][1]['lang']=='FR'
    assert 'allpay_token' not in response.text
    assert state.client.post('/subscriptions/checkout-session', json={"consent":True}).json()['id']==response.json()['id']
    assert len(calls)==1
    assert state.sub.status=='pending_checkout'


def test_payment_verified_once_and_token_failure_does_not_rollback_access(state, monkeypatch):
    state.sub.status='pending_checkout'; state.db.commit()
    invoice, attempt=invoice_and_attempt(state)
    attempt.status, attempt.error_code = 'failed', 'declined'
    state.db.commit()
    billing.settle(state.db, attempt.id, paid(attempt))
    billing.settle(state.db, attempt.id, paid(attempt))
    assert attempt.error_code is None
    assert invoice.status=='paid' and state.sub.status=='active'
    assert billing.aware(state.sub.current_period_ends_at)==billing.aware(invoice.period_end)
    def unavailable(*args): raise allpay.AllpayError('network', uncertain=True)
    monkeypatch.setattr(allpay, 'request', unavailable)
    billing.recover_token(state.db, attempt.id)
    assert state.db.get(SubscriptionInvoice,invoice.id).status=='paid'
    assert state.db.get(SubscriptionPaymentAttempt,attempt.id).token_pending


def test_card_replacement_returns_to_billing_without_an_invoice(state, monkeypatch):
    def capture(endpoint, body):
        assert endpoint == 'capturetoken'
        assert body['success_url'].startswith(settings.SITE_URL + '/account/billing?')
        return {'payment_url': 'https://allpay.to/test-capture'}
    monkeypatch.setattr(allpay, 'request', capture)
    response = state.client.post('/subscriptions/payment-method', json={'consent': True})
    assert response.status_code == 200 and response.json()['amount_minor'] == 0
    assert state.db.query(SubscriptionInvoice).count() == 0


def test_incorrect_amount_and_currency_do_not_activate(state):
    state.sub.status='pending_checkout'; state.db.commit()
    invoice, attempt=invoice_and_attempt(state)
    for payload in (paid(attempt,43001), {**paid(attempt),'currency_payment':'USD'}, {**paid(attempt),'order_id':'other'}):
        with pytest.raises(HTTPException): billing.settle(state.db, attempt.id, payload)
        state.db.rollback()
        assert state.db.get(SubscriptionInvoice,invoice.id).status=='open'
        assert state.db.get(Subscription,state.sub.id).status=='pending_checkout'


def test_webhook_signature_and_authoritative_status(state, monkeypatch):
    invoice, attempt=invoice_and_attempt(state)
    assert state.client.post('/subscriptions/webhooks/allpay',json={'status':1,'order_id':attempt.id}).status_code==400
    event={'status':1,'order_id':attempt.id,'amount':430}
    event['sign']=allpay.signature(event,settings.ALLPAY_API_KEY)
    monkeypatch.setattr(allpay,'request',lambda endpoint,body: paid(attempt) if endpoint=='paymentstatus' else {'allpay_token':'new-token','card_mask':'xxxx5678','card_brand':'Visa'})
    assert state.client.post('/subscriptions/webhooks/allpay',json=event).status_code==200
    assert state.client.post('/subscriptions/webhooks/allpay',json=event).status_code==200
    assert invoice.status=='paid'
    assert state.db.get(SubscriptionPaymentMethod,state.sub.company_id).card_last4=='5678'


def test_unknown_charge_never_blindly_retries(state, monkeypatch):
    invoice, hosted=invoice_and_attempt(state,kind='renewal',status='failed')
    calls=[]
    def timeout(endpoint,body): calls.append(endpoint); raise allpay.AllpayError('timeout',uncertain=True)
    monkeypatch.setattr(allpay,'request',timeout)
    billing.charge(state.db,invoice.id)
    billing.charge(state.db,invoice.id)
    assert calls==['getpayment']
    attempt=state.db.query(SubscriptionPaymentAttempt).filter_by(invoice_id=invoice.id,status='unknown').one()
    monkeypatch.setattr(allpay,'request',lambda *args: {'order_id':attempt.id,'status':0})
    billing.reconcile(state.db,attempt.id)
    assert state.db.get(SubscriptionPaymentAttempt,attempt.id).status=='unknown'
    assert state.db.query(SubscriptionPaymentAttempt).filter_by(invoice_id=invoice.id).count()==2


def test_token_charge_includes_hosted_fields_customer_details(state, monkeypatch):
    invoice, previous = invoice_and_attempt(state, kind='renewal', status='failed')
    company = state.db.get(Company, state.sub.company_id)
    company.owner_full_name, company.contact_email = 'Billing Contact', 'billing@example.com'
    state.db.commit()
    def charge(endpoint, body):
        assert body['client_name'] == 'Billing Contact'
        assert body['client_email'] == 'billing@example.com'
        raise allpay.AllpayError('timeout', uncertain=True)
    monkeypatch.setattr(allpay, 'request', charge)
    billing.charge(state.db, invoice.id)


def test_failure_grace_is_fixed_and_invalid_cards_stop_retries(state):
    invoice, attempt=invoice_and_attempt(state,kind='renewal')
    billing.failure(state.db,state.sub,invoice,attempt,'21004'); state.db.commit()
    original=state.sub.grace_ends_at
    assert attempt.status=='needs_card' and invoice.next_attempt_at is None
    assert original==invoice.period_start+timedelta(days=7)
    billing.failure(state.db,state.sub,invoice,attempt,'20004')
    assert state.sub.grace_ends_at==original


def test_manual_override_survives_delayed_success(state):
    invoice,attempt=invoice_and_attempt(state)
    result=state.client.patch(f'/admin/customers/{state.sub.company_id}/subscription',json={"reason":"Owner contract","access_override":"suspended","amount_minor":999,"clinic_limit":8})
    assert result.status_code==200
    billing.settle(state.db,attempt.id,paid(attempt))
    assert invoice.status=='paid'
    assert state.sub.amount_minor==999 and state.sub.clinic_limit==8
    assert access_mode(state.sub)=='suspended' and not state.sub.automatic_billing
    assert state.db.query(SubscriptionAuditEvent).filter_by(action='payment_after_override').count()==1


def test_free_grant_stops_charging_and_expiring_override_restores_policy(state):
    result=state.client.patch(f'/admin/customers/{state.sub.company_id}/subscription',json={"reason":"Complimentary","access_override":"full"})
    assert result.status_code==200 and not result.json()['automatic_billing']
    state.sub.current_period_ends_at=billing.now()-timedelta(days=1)
    assert access_mode(state.sub)=='full'
    state.sub.override_ends_at=billing.now()-timedelta(seconds=1)
    assert access_mode(state.sub)=='read_only'


def test_cancellation_prevents_charging_but_keeps_paid_access(state, monkeypatch):
    invoice,attempt=invoice_and_attempt(state,kind='renewal',status='failed')
    assert state.client.post('/subscriptions/cancel').status_code==200
    assert access_mode(state.sub)=='full'
    monkeypatch.setattr(allpay,'request',lambda *args: pytest.fail('Must not charge cancelled subscription'))
    billing.charge(state.db,invoice.id)
    assert not state.sub.automatic_billing


def test_quote_binding_and_deferred_small_upgrade(state):
    state.sub.current_period_ends_at=billing.now()+timedelta(hours=1)
    state.db.commit()
    quote=billing.preview(state.sub,require_plan('growth'))
    assert quote['amount_due_minor']==0 and quote['deferred_amount_minor']>0
    billing.change_plan(state.db,state.owner,'growth',quote['quote_token'])
    assert state.sub.plan_code=='growth' and state.sub.balance_minor>0
    with pytest.raises(HTTPException): billing.change_plan(state.db,state.owner,'network',quote['quote_token'])


def test_downgrade_revalidates_usage_at_renewal(state):
    state.sub.plan_code='growth'; state.sub.amount_minor=99900
    state.sub.pending_plan_code='essential'; state.sub.current_period_ends_at=billing.now()-timedelta(seconds=1)
    state.db.add(Clinic(company_id=state.sub.company_id,name='Extra',unique_id='extra',is_active=True)); state.db.commit()
    invoice_id=billing.enqueue_renewal(state.db,state.sub.company_id)
    invoice=state.db.get(SubscriptionInvoice,invoice_id)
    assert invoice.plan_code=='growth' and state.sub.pending_plan_code is None
    assert billing.enqueue_renewal(state.db,state.sub.company_id)==invoice_id


def test_two_module_switches_and_suspension_apply_without_rollout_flag(state, monkeypatch):
    monkeypatch.setattr(settings,'SUBSCRIPTION_ENFORCEMENT_MODE','off')
    state.sub.ai_enabled=False; state.sub.campaigns_enabled=False; state.db.commit()
    for module in ('ai','campaigns'):
        assert state.client.get('/subscriptions/modules/'+module+'/authorize').status_code==403
        with pytest.raises(HTTPException): require_module(state.db,state.sub.company_id,module)
    state.sub.access_override='suspended'; state.db.commit()
    with pytest.raises(HTTPException): enforce_workspace(state.db,state.sub.company_id)


def test_owner_user_protected_and_manual_payment_is_idempotent(state):
    assert state.client.patch('/admin/users/1',json={"active":False,"reason":"test"}).status_code==409
    body={"amount_minor":43000,"period_start":billing.now().isoformat(),"period_end":(billing.now()+timedelta(days=30)).isoformat(),"reference":"BANK-1","reason":"Bank transfer"}
    a=state.client.post(f'/admin/customers/{state.sub.company_id}/payments',json=body)
    b=state.client.post(f'/admin/customers/{state.sub.company_id}/payments',json=body)
    assert a.status_code==b.status_code==200 and a.json()['id']==b.json()['id']
    assert state.db.query(SubscriptionInvoice).count()==1
    assert not state.sub.automatic_billing


def test_refunds_preserve_override_and_block_ambiguous_retry(state, monkeypatch):
    invoice,attempt=invoice_and_attempt(state)
    billing.settle(state.db,attempt.id,paid(attempt))
    state.sub.access_override='full'; state.db.commit()
    def unavailable(*args): raise allpay.AllpayError('timeout',uncertain=True)
    monkeypatch.setattr(allpay,'request',unavailable)
    with pytest.raises(HTTPException): billing.refund(state.db,invoice.id,100,1,'Customer request')
    with pytest.raises(HTTPException): billing.refund(state.db,invoice.id,100,1,'Customer request')
    assert state.db.query(SubscriptionRefund).count()==1
    assert state.sub.access_override=='full'


def test_retired_stripe_webhook_cannot_mutate(state):
    assert state.client.post('/subscriptions/webhooks/stripe',json={"type":"invoice.payment_failed"}).status_code==200
    assert state.sub.status=='active'


def test_card_capture_cannot_count_as_a_payment(state):
    attempt=SubscriptionPaymentAttempt(id=billing.uid(),company_id=state.sub.company_id,kind='capture',status='submitted',
        consent_at=billing.now(),consent_version=billing.CONSENT_VERSION,test_mode=True,billing_revision=0)
    state.db.add(attempt); state.db.commit()
    billing.settle(state.db,attempt.id,{"status":1,"amount":0,"subscription_create":0,"allpay_token":"saved","card_mask":"xxxx1111"})
    assert state.db.query(SubscriptionInvoice).count()==0
    assert state.db.get(SubscriptionPaymentMethod,state.sub.company_id).card_last4=='1111'


def test_cross_company_payment_session_is_denied(state):
    invoice,attempt=invoice_and_attempt(state)
    state.user=state.ceo
    assert state.client.get('/subscriptions/sessions/'+attempt.id).status_code==404


def test_module_only_change_does_not_invalidate_payment_or_schedule(state):
    invoice,attempt=invoice_and_attempt(state)
    state.sub.pending_plan_code='growth'; state.db.commit()
    result=state.client.patch(f'/admin/customers/{state.sub.company_id}/subscription',json={'reason':'Disable AI only','ai_enabled':False})
    assert result.status_code==200
    assert state.sub.billing_revision==0 and state.sub.pending_plan_code=='growth'
    billing.settle(state.db,attempt.id,paid(attempt))
    assert not state.sub.ai_enabled and state.sub.automatic_billing


def test_revised_contract_voids_unsubmitted_invoice_and_reissues_once(state):
    state.sub.current_period_ends_at=billing.now()-timedelta(seconds=1);state.sub.balance_minor=100;state.db.commit()
    old_id=billing.enqueue_renewal(state.db,state.sub.company_id)
    assert state.db.get(SubscriptionInvoice,old_id).carry_minor==100
    response=state.client.patch(f'/admin/customers/{state.sub.company_id}/subscription',json={'reason':'New contract price','amount_minor':50000})
    assert response.status_code==200
    assert state.db.get(SubscriptionInvoice,old_id).status=='void'
    new_id=billing.enqueue_renewal(state.db,state.sub.company_id)
    assert new_id!=old_id
    assert state.db.get(SubscriptionInvoice,new_id).amount_minor==50100
    assert billing.enqueue_renewal(state.db,state.sub.company_id)==new_id


def test_capture_cannot_undo_cancelled_renewal(state):
    state.sub.automatic_billing=False;state.sub.cancel_at_period_end=True;state.sub.status='cancelled';state.sub.cancelled_at=billing.now();state.db.commit()
    attempt=SubscriptionPaymentAttempt(id=billing.uid(),company_id=state.sub.company_id,kind='capture',status='submitted',
        consent_at=billing.now(),consent_version=billing.CONSENT_VERSION,test_mode=True,billing_revision=0)
    state.db.add(attempt);state.db.commit()
    billing.settle(state.db,attempt.id,{'status':1,'amount':0,'subscription_create':0,'allpay_token':'saved','card_mask':'xxxx1111'})
    assert not state.sub.automatic_billing and state.sub.cancel_at_period_end


def test_successful_refund_does_not_double_count_reconciliation(state,monkeypatch):
    invoice,attempt=invoice_and_attempt(state)
    billing.settle(state.db,attempt.id,paid(attempt))
    monkeypatch.setattr(allpay,'request',lambda *args:{'status':4,'receipt':'https://example.test/refund'})
    result=billing.refund(state.db,invoice.id,1000,state.owner.id,'Partial refund')
    assert result['status']=='paid' and invoice.refunded_minor==1000
    billing.settle(state.db,attempt.id,{**paid(attempt),'status':4,'refunded':10})
    assert invoice.refunded_minor==1000


def test_inactive_clinic_blocks_existing_authorized_scope(state):
    from security.scope import assert_clinic_scope
    state.clinic.is_active=False;state.db.commit()
    with pytest.raises(HTTPException) as error:assert_clinic_scope(state.db,state.owner,state.clinic.id)
    assert error.value.status_code==403


def test_full_access_override_can_explicitly_keep_automatic_billing(state,monkeypatch):
    state.sub.access_override='full';state.sub.current_period_ends_at=billing.now()-timedelta(seconds=1);state.db.commit()
    invoice_id=billing.enqueue_renewal(state.db,state.sub.company_id)
    assert invoice_id is not None
    calls=[]
    def provider(endpoint,payload):
        calls.append(endpoint)
        if endpoint=='getpayment':return {'status':1}
        return {'order_id':payload['order_id'],'status':1,'amount':430,'currency_display':'ILS','currency_payment':'ILS','currency_course':1}
    monkeypatch.setattr(allpay,'request',provider)
    billing.charge(state.db,invoice_id)
    assert calls==['getpayment','paymentstatus']
    assert access_mode(state.sub)=='full'


def test_live_payment_gate_blocks_non_sandbox_operations(state,monkeypatch):
    monkeypatch.setattr(settings,'ALLPAY_API_LOGIN','test-login')
    monkeypatch.setattr(settings,'ALLPAY_TEST_MODE',False)
    monkeypatch.setattr(settings,'ALLPAY_LIVE_PAYMENTS_ENABLED',False)
    for endpoint in ('getpayment','capturetoken','refund'):
        with pytest.raises(allpay.AllpayError) as error:allpay.request(endpoint,{'order_id':'test'})
        assert error.value.code=='billing_live_disabled'


def trial_candidate(state):
    state.sub.status = 'pending_checkout'
    state.sub.automatic_billing = False
    state.sub.current_period_starts_at = state.sub.current_period_ends_at = None
    method = state.db.get(SubscriptionPaymentMethod, state.sub.company_id)
    if method:
        state.db.delete(method)
    state.db.commit()


def test_trial_request_is_scoped_idempotent_and_does_not_grant_access(state):
    from models import SubscriptionTrialRequest
    trial_candidate(state)
    initial = state.client.get('/subscriptions/trial-request').json()
    assert initial['can_request'] and initial['request'] is None
    first = state.client.post('/subscriptions/trial-request').json()
    assert state.client.post('/subscriptions/trial-request').json()['id'] == first['id']
    assert state.db.query(SubscriptionTrialRequest).count() == 1
    assert access_mode(state.sub) == 'billing_only' and not state.sub.automatic_billing
    assert state.client.get('/admin/trial-requests').json()['total'] == 1
    state.user = state.ceo
    assert state.client.get('/admin/trial-requests').status_code == 403
    assert state.client.post(f"/admin/trial-requests/{first['id']}/review", json={'decision': 'approve', 'reason': 'CEO role is insufficient'}).status_code == 403
    # No tenant identifier is accepted from the caller. A different company sees only itself.
    from services.subscription_service import create_pending_subscription
    create_pending_subscription(state.db, state.ceo.company_id, 'essential'); state.db.commit()
    assert state.client.get('/subscriptions/trial-request').json()['request'] is None
    state.ceo.role_level = 2; state.db.commit()
    assert state.client.post('/subscriptions/trial-request').status_code == 403


def test_owner_trial_approval_sets_exact_expiry_and_no_automatic_billing(state):
    trial_candidate(state)
    row = state.client.post('/subscriptions/trial-request').json()
    end = billing.now() + timedelta(days=17)
    response = state.client.post(f"/admin/trial-requests/{row['id']}/review", json={
        'decision': 'approve', 'trial_ends_at': end.isoformat(), 'reason': 'Seventeen-day evaluation'})
    assert response.status_code == 200
    assert state.sub.status == 'trialing' and billing.aware(state.sub.trial_ends_at) == end
    assert state.sub.trial_consumed_at is not None and not state.sub.automatic_billing
    assert state.client.get('/subscriptions/me').json()['renewal_setup_incomplete'] is False
    assert access_mode(state.sub) == 'full'
    assert access_mode(state.sub, now=end) == 'read_only'
    assert billing.enqueue_renewal(state.db, state.sub.company_id) is None
    assert state.client.get('/admin/trial-requests').json()['total'] == 0
    customer = state.client.get('/subscriptions/trial-request').json()
    assert customer['request']['status'] == 'approved' and customer['access_granted']
    assert 'decision_reason' not in customer['request'] and 'reviewed_by_user_id' not in customer['request']
    assert state.client.post(f"/admin/trial-requests/{row['id']}/review", json={
        'decision': 'approve', 'trial_ends_at': (end+timedelta(days=3)).isoformat(), 'reason': 'Repeated review'}).status_code == 409
    assert billing.aware(state.sub.trial_ends_at) == end
    assert state.db.query(SubscriptionAuditEvent).filter_by(action='trial_approved').count() == 1


def test_trial_rejection_keeps_checkout_available_and_cannot_be_resubmitted(state, monkeypatch):
    trial_candidate(state)
    row = state.client.post('/subscriptions/trial-request').json()
    response = state.client.post(f"/admin/trial-requests/{row['id']}/review", json={'decision': 'reject', 'reason': 'Not eligible for this offer'})
    assert response.status_code == 200 and response.json()['status'] == 'rejected'
    assert state.sub.status == 'pending_checkout' and access_mode(state.sub) == 'billing_only'
    assert state.client.post('/subscriptions/trial-request').json()['status'] == 'rejected'
    monkeypatch.setattr(allpay, 'request', lambda *args: {'payment_url': 'https://allpay.to/test-payment'})
    assert state.client.post('/subscriptions/checkout-session', json={'consent': True}).status_code == 200


def test_trial_approval_revalidates_payment_and_manual_override_races(state):
    trial_candidate(state)
    row = state.client.post('/subscriptions/trial-request').json()
    payload = {'decision': 'approve', 'trial_ends_at': (billing.now()+timedelta(days=30)).isoformat(), 'reason': 'Owner evaluation'}
    invoice, attempt = invoice_and_attempt(state)
    attempt.payment_url = 'https://allpay.to/still-payable'; attempt.status = 'failed'; state.db.commit()
    response = state.client.post(f"/admin/trial-requests/{row['id']}/review", json=payload)
    assert response.status_code == 409 and response.json()['detail']['code'] == 'trial_payment_pending'
    # An expired page with an uncertain charge is still unsafe to approve.
    attempt.created_at = billing.now()-timedelta(days=2); attempt.status='unknown'; state.db.commit()
    assert state.client.post(f"/admin/trial-requests/{row['id']}/review", json=payload).status_code == 409
    attempt.status = 'paid'; invoice.status = 'paid'; state.db.commit()
    assert state.client.post(f"/admin/trial-requests/{row['id']}/review", json=payload).json()['detail']['code'] == 'trial_not_available'
    assert state.sub.status == 'pending_checkout'
    invoice.status = 'void'; attempt.status = 'failed'; state.sub.access_override='suspended'; state.db.commit()
    assert state.client.post(f"/admin/trial-requests/{row['id']}/review", json=payload).status_code == 409
    assert state.sub.access_override == 'suspended'


def test_trials_require_valid_future_end_and_meaningful_owner_reason(state):
    trial_candidate(state)
    row = state.client.post('/subscriptions/trial-request').json()
    path = f"/admin/trial-requests/{row['id']}/review"
    for end in [None, (billing.now()-timedelta(seconds=1)).isoformat()]:
        response = state.client.post(path, json={'decision': 'approve', 'trial_ends_at': end, 'reason': 'Evaluate'})
        assert response.status_code == 400
    assert state.client.post(path, json={'decision': 'reject', 'reason': '   '}).status_code == 400
    assert state.client.get('/subscriptions/trial-request').json()['request']['status'] == 'pending'
    state.sub.trial_consumed_at=billing.now();state.db.commit()
    assert state.client.post(path, json={'decision': 'approve', 'trial_ends_at': (billing.now()+timedelta(days=30)).isoformat(), 'reason': 'Cannot repeat trial'}).status_code == 409


def test_trial_expiry_allows_paid_checkout_without_a_second_free_trial(state, monkeypatch):
    trial_candidate(state)
    row=state.client.post('/subscriptions/trial-request').json()
    end=billing.now()+timedelta(days=10)
    assert state.client.post(f"/admin/trial-requests/{row['id']}/review",json={'decision':'approve','trial_ends_at':end.isoformat(),'reason':'Ten-day evaluation'}).status_code==200
    state.sub.trial_ends_at=billing.now()-timedelta(seconds=1);state.db.commit()
    assert state.client.get('/subscriptions/trial-request').json()['access_granted'] is False
    monkeypatch.setattr(allpay,'request',lambda *args:{'payment_url':'https://allpay.to/after-trial'})
    response=state.client.post('/subscriptions/checkout-session',json={'consent':True})
    assert response.status_code==200 and response.json()['amount_minor']==43000
    assert state.sub.automatic_billing is False
    assert state.client.post('/subscriptions/trial-request').json()['status']=='approved'


def test_paid_token_recovery_warning_is_preserved_without_warning_free_trials(state):
    trial_candidate(state)
    assert state.client.get('/subscriptions/me').json()['renewal_setup_incomplete'] is False
    invoice, attempt = invoice_and_attempt(state)
    billing.settle(state.db, attempt.id, paid(attempt))
    state.sub.automatic_billing = False
    state.db.commit()
    assert state.client.get('/subscriptions/me').json()['renewal_setup_incomplete'] is True
