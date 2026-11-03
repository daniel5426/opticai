"""Real row-lock tests. Run only against the disposable local allpay_test database."""
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier, Event

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from auth import encrypt_secret
from config import settings
from models import Company, Subscription, SubscriptionInvoice, SubscriptionPaymentAttempt, SubscriptionPaymentMethod, SubscriptionAuditEvent
from services import saas_billing as billing, allpay

URL = os.getenv('BILLING_TEST_DATABASE_URL')
pytestmark = pytest.mark.skipif(not URL, reason='Dedicated disposable local PostgreSQL required')


@pytest.fixture()
def pg(monkeypatch):
    parsed=make_url(URL)
    assert parsed.host in {'127.0.0.1','localhost'} and parsed.database=='allpay_test', 'Never mutate a shared database'
    engine=create_engine(URL)
    sessions=sessionmaker(bind=engine,expire_on_commit=False)
    with sessions() as db:
        company=Company(name='Concurrent billing test',owner_full_name='Synthetic owner'); db.add(company); db.flush()
        sub=Subscription(id=billing.uid(),company_id=company.id,provider='allpay',status='active',plan_code='essential',amount_minor=43000,
            current_period_starts_at=billing.now()-timedelta(days=30),current_period_ends_at=billing.now()-timedelta(seconds=1),automatic_billing=True)
        db.add(sub)
        db.add(SubscriptionPaymentMethod(company_id=company.id,token_encrypted=encrypt_secret('test-token'),consent_at=billing.now(),consent_version=billing.CONSENT_VERSION))
        db.commit();company_id=company.id
    monkeypatch.setattr(settings,'BILLING_CHARGING_ENABLED',True)
    monkeypatch.setattr(settings,'ALLPAY_TEST_MODE',True)
    yield sessions,company_id
    engine.dispose()


def test_concurrent_workers_create_one_invoice_and_one_charge(pg,monkeypatch):
    sessions,company_id=pg
    barrier=Barrier(2)
    def enqueue():
        with sessions() as db:
            barrier.wait(timeout=5)
            return billing.enqueue_renewal(db,company_id)
    with ThreadPoolExecutor(max_workers=2) as pool:
        a,b=pool.submit(enqueue),pool.submit(enqueue)
        first,second=a.result(timeout=10),b.result(timeout=10)
    assert first==second
    submitted=Event(); release=Event();calls=[]
    def provider(endpoint,payload):
        if endpoint=='getpayment':
            calls.append(payload['order_id']);submitted.set();assert release.wait(timeout=5)
            return {'order_id':payload['order_id'],'status':1}
        assert endpoint=='paymentstatus'
        return {'order_id':payload['order_id'],'status':1,'amount':430,'currency_display':'ILS','currency_payment':'ILS','currency_course':1}
    monkeypatch.setattr(allpay,'request',provider)
    def charge():
        with sessions() as db:billing.charge(db,first)
    with ThreadPoolExecutor(max_workers=2) as pool:
        a=pool.submit(charge);assert submitted.wait(timeout=5)
        b=pool.submit(charge);b.result(timeout=5)
        release.set();a.result(timeout=10)
    with sessions() as db:
        assert db.query(SubscriptionInvoice).filter_by(company_id=company_id).count()==1
        assert db.query(SubscriptionPaymentAttempt).filter_by(invoice_id=first).count()==1
        assert db.get(SubscriptionInvoice,first).status=='paid'
    assert len(calls)==1


def test_postgres_audit_is_append_only(pg):
    sessions,company_id=pg
    with sessions() as db:
        row=SubscriptionAuditEvent(id=billing.uid(),company_id=company_id,action='test',reason='Synthetic audit',before={},after={})
        db.add(row);db.commit()
        with pytest.raises(Exception,match='append-only'):
            db.execute(text('UPDATE subscription_audit_events SET reason=:reason WHERE id=:id'),{'reason':'changed','id':row.id})
        db.rollback()
        assert db.get(SubscriptionAuditEvent,row.id).reason=='Synthetic audit'


def trial_company(sessions, company_id):
    from models import User
    with sessions() as db:
        sub=db.query(Subscription).filter_by(company_id=company_id).one()
        sub.status='pending_checkout';sub.automatic_billing=False
        sub.current_period_starts_at=sub.current_period_ends_at=None
        owner=User(company_id=company_id,username='trial-'+billing.uid(),full_name='Trial Owner',role_level=4,is_active=True)
        db.add(owner);db.commit();return owner.id


def test_concurrent_trial_requests_create_one_request_and_audit(pg):
    from models import User, SubscriptionTrialRequest
    from services import trial_requests
    sessions,company_id=pg;user_id=trial_company(sessions,company_id)
    barrier=Barrier(2)
    def request():
        with sessions() as db:
            user=db.get(User,user_id);barrier.wait(timeout=5)
            return trial_requests.request_trial(db,user)['id']
    with ThreadPoolExecutor(max_workers=2) as pool:
        a,b=pool.submit(request),pool.submit(request)
        assert a.result(timeout=10)==b.result(timeout=10)
    with sessions() as db:
        assert db.query(SubscriptionTrialRequest).filter_by(company_id=company_id).count()==1
        assert db.query(SubscriptionAuditEvent).filter_by(company_id=company_id,action='trial_requested').count()==1


def test_concurrent_trial_reviews_cannot_grant_twice(pg):
    from models import User, SubscriptionTrialRequest
    from services import trial_requests
    from fastapi import HTTPException
    sessions,company_id=pg;user_id=trial_company(sessions,company_id)
    with sessions() as db:request_id=trial_requests.request_trial(db,db.get(User,user_id))['id']
    barrier=Barrier(2)
    def approve(days):
        with sessions() as db:
            owner=db.get(User,user_id);barrier.wait(timeout=5)
            try:
                trial_requests.review(db,request_id,owner,decision='approve',trial_ends_at=billing.now()+timedelta(days=days),reason='Concurrent trial test')
                return 200
            except HTTPException as error:
                db.rollback();return error.status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        a,b=pool.submit(approve,17),pool.submit(approve,31)
        assert sorted([a.result(timeout=10),b.result(timeout=10)])==[200,409]
    with sessions() as db:
        assert db.query(SubscriptionAuditEvent).filter_by(company_id=company_id,action='trial_approved').count()==1
        assert db.query(Subscription).filter_by(company_id=company_id).one().automatic_billing is False
        assert db.get(SubscriptionTrialRequest,request_id).status=='approved'
