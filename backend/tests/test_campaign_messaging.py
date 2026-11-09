"""Real database-state regressions; provider and payment boundaries never send externally."""
import json
from datetime import UTC, datetime, date, timedelta
from types import SimpleNamespace as NS
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from database import Base, get_db
from auth import get_current_user
from models import Company, Clinic, Client, Campaign, User, Subscription, CampaignClientExecution
from campaign_models import *
from services import campaign_engine as engine, campaign_providers as providers, messaging_billing as money
from services.campaign_filters import clients_query, validate_filters
from EndPoints import campaigns, messaging
from workers.campaign_worker import deliver_once, schedule_once
from services.campaign_monitoring import email_slot as real_email_slot
from config import settings

@pytest.fixture
def state(monkeypatch):
    for key,value in [('ALLPAY_API_LOGIN','test-login'),('ALLPAY_API_KEY','test-key'),('MESSAGING_ALLPAY_API_LOGIN',''),('MESSAGING_ALLPAY_API_KEY',''),('MESSAGING_ALLPAY_TEST_MODE',True),('MESSAGING_ALLPAY_CHECKOUT_MODE','hosted_fields')]:
        monkeypatch.setattr(settings,key,value)
    db_engine=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
    import os, uuid
    pg_url = os.getenv('TEST_CAMPAIGN_DATABASE_URL')
    schema = None
    root_engine = None
    if pg_url:
        from sqlalchemy.engine import make_url
        from sqlalchemy import text
        if make_url(pg_url).host not in ('127.0.0.1', 'localhost'): pytest.fail('Disposable campaign tests require a loopback PostgreSQL cluster')
        db_engine.dispose()
        root_engine = create_engine(pg_url)
        schema = 'campaign_test_' + uuid.uuid4().hex
        with root_engine.begin() as conn: conn.execute(text('CREATE SCHEMA ' + schema))
        db_engine = create_engine(pg_url, connect_args={'options': '-csearch_path=' + schema + ' -clock_timeout=3000 -cstatement_timeout=8000'})
    Base.metadata.create_all(db_engine)
    sessions=sessionmaker(bind=db_engine,expire_on_commit=False,autoflush=False)
    db=sessions()
    co=Company(name='Clinic',owner_full_name='Owner'); foreign=Company(name='Other',owner_full_name='Other')
    db.add_all([co,foreign]);db.flush()
    clinic=Clinic(name='A',company_id=co.id,unique_id='A',is_active=True)
    other=Clinic(name='B',company_id=foreign.id,unique_id='B',is_active=True)
    db.add_all([clinic,other]);db.flush()
    user=User(username='manager',email='owner@example.com',role_level=4,company_id=co.id,clinic_id=clinic.id,is_active=True)
    db.add(user);db.flush()
    sub=Subscription(id='sub',company_id=co.id,plan_code='essential',provider='manual',status='active',
        current_period_starts_at=now()-timedelta(days=1),current_period_ends_at=now()+timedelta(days=29),campaigns_enabled=True)
    db.add_all([sub,MessagingCatalog(id=1,enabled=True,revision=1,allowances={'essential':1},email_per_clinic=1,sms_per_clinic=0,email_rate=10000,sms_rate=100000,packs=[10000])]);db.flush()
    c=Campaign(name='Recall',clinic_id=clinic.id,filters='[]',email_enabled=True,email_content='Hello {first_name}',sms_enabled=False,execute_once_per_client=True)
    db.add(c);db.flush()
    d=CampaignDetails(campaign_id=c.id,revision=1,subject='Hello',locale='en',all_clients=True,status='draft',schedule={})
    a=Client(company_id=co.id,clinic_id=clinic.id,first_name='A',email='a@example.com',phone_mobile='0501234567',send_notifications=True,date_of_birth=date(1980,1,1))
    b=Client(company_id=co.id,clinic_id=clinic.id,first_name='B',email='b@example.com',send_notifications=False)
    f=Client(company_id=foreign.id,clinic_id=other.id,first_name='Foreign',email='foreign@example.com',send_notifications=True)
    db.add_all([d,a,b,f,MessagingClinic(clinic_id=clinic.id,company_id=co.id,reply_to='clinic@example.com')]);db.commit()
    for destination in ('a@example.com', 'b@example.com'):
        db.add(MessagingConsent(company_id=co.id, channel='email', destination=destination, granted=True, evidence='Explicit fixture opt-in', actor_id=user.id))
    acct=money.account(db,co.id);acct.balance=100_000_000;db.commit()
    from services import campaign_monitoring
    monkeypatch.setattr(campaign_monitoring, 'email_slot', lambda db: None)
    monkeypatch.setattr(settings,'CAMPAIGN_SENDING_ENABLED',True)
    monkeypatch.setattr(providers,'email_ready',lambda:True)
    monkeypatch.setattr(providers,'send_email',lambda *args: providers.Outcome('submitted','email-1'))
    app=FastAPI();app.include_router(campaigns.router);app.include_router(messaging.router);app.include_router(messaging.admin_router)
    def session():
        with sessions() as current:yield current
    app.dependency_overrides[get_db]=session
    app.dependency_overrides[get_current_user]=lambda:user
    yield NS(db=db,sessions=sessions,user=user,company=co,clinic=clinic,other=other,sub=sub,c=c,d=d,a=a,b=b,http=TestClient(app),acct=acct)
    db.close();db_engine.dispose()
    if schema:
        with root_engine.begin() as conn: conn.execute(text('DROP SCHEMA ' + schema + ' CASCADE'))
        root_engine.dispose()


def quote_run(s,key='run-key-123'):
    q=engine.preview(s.db,s.c,s.user)
    return engine.create_run(s.db,s.c,s.user,key,q['quote'])


def test_audience_scope_optin_deduplication_and_once_false_object(state):
    s=state
    duplicate=Client(company_id=s.company.id,clinic_id=s.clinic.id,first_name='dup',email='A@example.com',send_notifications=True)
    s.db.add(duplicate);s.db.commit()
    q=engine.preview(s.db,s.c,s.user)
    assert q['emails']==1
    assert q['excluded']=={'opted_out':1,'duplicate':1}
    assert s.http.get(f'/campaigns/{s.c.id}/client-execution/{s.a.id}').json()=={'executed':False}
    assert s.http.get(f'/campaigns/?clinic_id={s.other.id}').status_code==403


def test_filters_use_actual_sql_dates_and_missing_values(state):
    s=state
    s.c.filters=json.dumps([{'field':'age','operator':'greater_than','value':'40'}])
    assert [c.id for c in clients_query(s.db,s.c,s.d,s.company.id,date(2026,11,7))]==[s.a.id]
    s.c.filters=json.dumps([{'field':'has_exams','operator':'equals','value':'false'}])
    assert len(clients_query(s.db,s.c,s.d,s.company.id,date(2026,11,7)).all())==2
    s.c.filters=json.dumps([{'field':'age','operator':'less_than','value':'100'}])
    assert [c.id for c in clients_query(s.db,s.c,s.d,s.company.id,date(2026,11,7))]==[s.a.id]
    for raw in ['{}','invalid',json.dumps([{'field':'x','operator':'equals','value':'1'}])]:
        with pytest.raises(HTTPException):validate_filters(raw)


def test_filters_match_imported_gender_and_health_fund_and_exclude_future_births(state):
    s=state
    s.a.gender=' Female ';s.a.health_fund='Clalit'
    s.b.date_of_birth=date(2030,1,1)
    s.db.commit()
    for field,value in [('gender','נקבה'),('gender','female'),('health_fund','כללית')]:
        s.c.filters=json.dumps([{'field':field,'operator':'equals','value':value}])
        assert [c.id for c in clients_query(s.db,s.c,s.d,s.company.id,date(2026,11,7))]==[s.a.id]
    for op in ['less_than','less_equal','not_equals']:
        s.c.filters=json.dumps([{'field':'age','operator':op,'value':'100'}])
        assert [c.id for c in clients_query(s.db,s.c,s.d,s.company.id,date(2026,11,7))]==[s.a.id]


def test_quotes_become_stale_after_content_audience_or_price_change(state):
    s=state;q=engine.preview(s.db,s.c,s.user)
    s.c.email_content='Changed';s.db.commit()
    with pytest.raises(HTTPException) as e:engine.create_run(s.db,s.c,s.user,'request1',q['quote'])
    assert e.value.detail['code']=='quote_stale'
    s.db.rollback()
    assert s.db.query(CampaignRun).count()==0


def test_reserve_send_settle_once_and_duplicate_run(state):
    s=state;r=quote_run(s)
    s.db.refresh(s.acct);assert s.acct.held==1
    assert engine.create_run(s.db,s.c,s.user,'run-key-123','expired').id==r.id
    assert deliver_once(s.sessions)
    s.db.expire_all()
    assert s.db.query(CampaignDelivery).one().status=='submitted'
    assert s.db.get(CampaignRun,r.id).status=='completed'
    assert s.acct.used==1 and s.acct.held==0 and s.acct.reserved==0
    assert engine.preview(s.db,s.c,s.user)['emails']==0
    assert s.db.query(MessagingLedger).filter_by(kind='usage').count()==1


def test_no_funds_means_no_partial_campaign(state):
    s=state;s.acct.allowance_override=0;s.acct.allowance=0;s.acct.balance=0;s.db.commit()
    q=engine.preview(s.db,s.c,s.user)
    assert 'insufficient_balance' in q['errors']
    with pytest.raises(HTTPException):engine.create_run(s.db,s.c,s.user,'nofunds1',q['quote'])
    s.db.rollback();assert s.db.query(CampaignDelivery).count()==0


def test_failure_releases_money_and_once_claim_but_uncertain_does_not(state,monkeypatch):
    s=state;s.acct.allowance_override=0;s.acct.allowance=0;s.db.commit()
    quote_run(s)
    monkeypatch.setattr(providers,'send_email',lambda *a,**kwargs:providers.Outcome('failed',code='reject'))
    deliver_once(s.sessions);s.db.expire_all()
    assert s.acct.reserved==0 and s.acct.balance==100_000_000
    assert s.db.query(CampaignContactClaim).count()==0
    quote_run(s,'run-key-456')
    monkeypatch.setattr(providers,'send_email',lambda *a,**kwargs:providers.Outcome('uncertain',code='timeout'))
    deliver_once(s.sessions);s.db.expire_all()
    assert s.acct.reserved==10000 and s.acct.balance==100_000_000
    assert not deliver_once(s.sessions)


def test_unsubscribe_get_does_not_mutate_and_post_suppresses_queued(state):
    s=state;quote_run(s)
    d=s.db.query(CampaignDelivery).one();token=engine.unsubscribe_url(d.id).split('/')[-1]
    assert s.http.get('/messaging/unsubscribe/'+token).status_code==200
    assert s.db.query(MessagingSuppression).count()==0
    assert s.http.post('/messaging/unsubscribe/'+token).status_code==200
    deliver_once(s.sessions);s.db.expire_all()
    assert d.status=='suppressed' and s.acct.held==0
    assert s.http.post('/messaging/unsubscribe/'+token+'bad').status_code==404


def test_payment_double_notification_and_mismatch_never_double_credit(state,monkeypatch):
    s=state;t=MessagingTopup(id='payment-1',company_id=s.company.id,request_key='payment-key',amount_minor=10000,status='pending',test_mode=True)
    s.db.add(t);s.db.commit();start=s.acct.balance
    monkeypatch.setattr(settings,'ALLPAY_TEST_MODE',True)
    monkeypatch.setattr(money.allpay,'request',lambda *a,**kwargs:{'order_id':t.id,'status':1,'amount':100,'currency_display':'ILS','currency_payment':'ILS','currency_course':1})
    money.reconcile(s.db,t.id);money.reconcile(s.db,t.id)
    assert s.acct.balance==start+100_000_000
    assert s.sub.status=='active'
    monkeypatch.setattr(money.allpay,'request',lambda *a,**kwargs:{'order_id':t.id,'status':1,'amount':1,'currency_display':'ILS','currency_payment':'ILS'})
    with pytest.raises(HTTPException):money.reconcile(s.db,t.id)
    assert s.acct.balance==start+100_000_000


def test_permissions_and_legacy_delivery_are_closed(state):
    s=state
    assert s.http.post(f'/campaigns/{s.c.id}/deliver-email/{s.a.id}',json={'text':'x','html':'x'}).status_code==409
    s.user.role_level=2
    assert s.http.post('/messaging/topups',json={'amount_minor':10000,'request_key':'request-1'}).status_code==403
    assert s.http.put(f'/campaigns/{s.c.id}',json={'name':'wrong','revision':1}).status_code==403


def test_segments_and_calendar_scheduling():
    assert providers.segments('א'*70)==1
    assert providers.segments('א'*71)==2
    assert providers.segments('א'*160)==3
    assert providers.segments('^'*81)==2
    schedule={'kind':'monthly','start':'2026-01-31T10:00','timezone':'Asia/Jerusalem'}
    assert engine.next_occurrence(schedule,datetime(2026,2,28,15,tzinfo=UTC)).astimezone(engine.ZoneInfo('Asia/Jerusalem')).day==31


def test_provider_callbacks_are_idempotent_and_out_of_order_safe(state):
    s=state;quote_run(s);deliver_once(s.sessions);s.db.expire_all()
    d=s.db.query(CampaignDelivery).one()
    event={'key':'event-1','provider_id':'email-1','type':'email.delivered'}
    engine.provider_event(s.db,event,'resend');engine.provider_event(s.db,event,'resend')
    engine.provider_event(s.db,{**event,'key':'event-2','type':'email.sent'},'resend')
    assert d.status=='delivered' and s.acct.used==1
    assert s.db.get(CampaignRun,d.run_id).status=='completed'


def test_retry_only_failed_channel_and_never_successful_recipients(state,monkeypatch):
    s=state;s.c.execute_once_per_client=False;s.b.send_notifications=True;s.db.commit()
    q=engine.preview(s.db,s.c,s.user)
    run=engine.create_run(s.db,s.c,s.user,'multi-recipient',q['quote'])
    monkeypatch.setattr(providers,'send_email',lambda d,*a:providers.Outcome('submitted','accepted-a') if d.destination.startswith('a@') else providers.Outcome('failed',code='reject'))
    deliver_once(s.sessions);deliver_once(s.sessions);s.db.expire_all()
    retry=engine.preview(s.db,s.c,s.user,retry_run=run.id)
    assert retry['emails']==1 and 'B' in retry['sample'][0]['content']
    new=engine.create_run(s.db,s.c,s.user,'retry-request',retry['quote'],retry_run=run.id)
    assert [d.destination for d in s.db.query(CampaignDelivery).filter_by(run_id=new.id)]==['b@example.com']


def test_clinic_budget_and_catalog_change_block_scheduled_run(state):
    s=state;s.acct.allowance_override=0;s.acct.allowance=0;s.db.commit()
    cfg=money.clinic_settings(s.db,s.clinic.id);cfg.budget=1;s.db.commit()
    q=engine.preview(s.db,s.c,s.user)
    with pytest.raises(HTTPException) as e:engine.create_run(s.db,s.c,s.user,'limited-run',q['quote'])
    assert e.value.detail['code']=='clinic_budget_exceeded'
    s.db.rollback();cfg.budget=None;s.db.commit()
    s.d.status='scheduled';s.d.approved_catalog=0;s.d.max_cost=100000;s.db.commit()
    with pytest.raises(HTTPException) as e:engine.create_run(s.db,s.c,s.user,'scheduled-run',scheduled=True)
    assert e.value.detail['code']=='schedule_review_required'


def test_allowance_renewal_does_not_refill_balance_or_refill_midperiod(state):
    s=state;money.current_period(s.db,s.acct).email_used=1;s.acct.used=1;s.db.commit();balance=s.acct.balance
    money.account(s.db,s.company.id);assert s.acct.used==1
    s.sub.current_period_starts_at=now()-timedelta(hours=1);s.sub.current_period_ends_at=now()+timedelta(days=30)
    s.db.commit();money.account(s.db,s.company.id)
    assert s.acct.used==0 and s.acct.allowance==1 and s.acct.balance==balance


def test_resend_webhook_signature_and_replay_age(monkeypatch):
    import base64,hashlib,hmac,time
    secret=b'unit-test-only';monkeypatch.setattr(settings,'CAMPAIGN_RESEND_WEBHOOK_SECRET','whsec_'+base64.b64encode(secret).decode())
    body=b'{"type":"email.delivered","data":{"email_id":"one","tags":{"delivery_id":"id"}}}'
    stamp=str(int(time.time()));event_id='event-1'
    signature=base64.b64encode(hmac.new(secret,event_id.encode()+b'.'+stamp.encode()+b'.'+body,hashlib.sha256).digest()).decode()
    headers={'svix-id':event_id,'svix-timestamp':stamp,'svix-signature':'v1,'+signature}
    assert providers.verify_resend(body,headers)['delivery_id']=='id'
    with pytest.raises(ValueError):providers.verify_resend(body+b' ',headers)
    with pytest.raises(ValueError):providers.verify_resend(body,{**headers,'svix-timestamp':'1'})


@pytest.mark.parametrize('dedicated', [True, False])
def test_campaign_email_uses_its_own_key_without_changing_transactional_settings(monkeypatch, dedicated):
    monkeypatch.setattr(settings,'RESEND_API_KEY','transactional-test-key')
    monkeypatch.setattr(settings,'CAMPAIGN_RESEND_API_KEY','campaign-test-key' if dedicated else '')
    monkeypatch.setattr(settings,'EMAIL_FROM','Prysm <hello@prysm.co.il>')
    monkeypatch.setattr(settings,'CAMPAIGN_EMAIL_FROM','Prysm <campaigns@mail.prysm.co.il>')
    monkeypatch.setattr(settings,'CAMPAIGN_RESEND_WEBHOOK_SECRET','configured-for-test')
    def post(url, *, json, headers, timeout):
        assert headers['Authorization']=='Bearer '+('campaign-test-key' if dedicated else 'transactional-test-key')
        assert json['from']=='"Clinic via Prysm" <campaigns@mail.prysm.co.il>'
        assert json['reply_to']=='clinic@example.com'
        return NS(status_code=200,json=lambda:{'id':'test-email'})
    monkeypatch.setattr(providers.httpx,'post',post)
    delivery=NS(id='test-delivery',destination='test@example.com',subject='Test',content='Hello')
    assert providers.email_ready()
    assert providers.send_email(delivery,'clinic@example.com','https://example.com/unsubscribe','Clinic').status=='submitted'
    assert settings.RESEND_API_KEY=='transactional-test-key'
    assert settings.EMAIL_FROM=='Prysm <hello@prysm.co.il>'


def test_resend_reconciliation_uses_the_campaign_account_key(state, monkeypatch):
    s=state;run=quote_run(s)
    delivery=s.db.query(CampaignDelivery).filter_by(run_id=run.id).one()
    delivery.provider='resend';delivery.provider_id='resend-one';delivery.status='uncertain';s.db.commit()
    monkeypatch.setattr(settings,'RESEND_API_KEY','transactional-test-key')
    monkeypatch.setattr(settings,'CAMPAIGN_RESEND_API_KEY','campaign-test-key')
    def get(url, *, headers, timeout):
        assert headers['Authorization']=='Bearer campaign-test-key'
        return NS(raise_for_status=lambda:None,json=lambda:{'id':'resend-one','to':[delivery.destination],'last_event':'delivered'})
    monkeypatch.setattr(providers.httpx,'get',get)
    assert messaging.reconcile_delivery(delivery.id,s.user,s.db)=={'status':'delivered'}
    assert delivery.settled and s.acct.reserved==0



def test_postgres_concurrent_runs_cannot_spend_the_same_balance(state):
    s=state
    if s.db.get_bind().dialect.name != 'postgresql': pytest.skip('Requires disposable PostgreSQL')
    from concurrent.futures import ThreadPoolExecutor
    s.c.execute_once_per_client=False;s.acct.allowance_override=0;s.acct.allowance=0;s.acct.balance=10000;s.db.commit()
    q=engine.preview(s.db,s.c,s.user);s.db.commit()
    def run(key):
        with s.sessions() as db:
            try:
                result=engine.create_run(db,db.get(Campaign,s.c.id),db.get(User,s.user.id),key,q['quote'])
                return result.id
            except HTTPException as error:
                db.rollback();return error.detail['code']
    with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(run,['parallel-1','parallel-2']))
    assert results.count('insufficient_balance')==1
    s.db.expire_all()
    assert s.acct.reserved==10000 and s.acct.balance==10000
    assert s.db.query(CampaignDelivery).count()==1


def test_postgres_duplicate_payment_reconciliation_credits_once(state,monkeypatch):
    s=state
    if s.db.get_bind().dialect.name != 'postgresql': pytest.skip('Requires disposable PostgreSQL')
    from concurrent.futures import ThreadPoolExecutor
    row=MessagingTopup(id='parallel-payment',company_id=s.company.id,request_key='parallel-payment',amount_minor=10000,status='pending',test_mode=True)
    s.db.add(row);s.db.commit();before=s.acct.balance
    monkeypatch.setattr(settings,'ALLPAY_TEST_MODE',True)
    monkeypatch.setattr(money.allpay,'request',lambda *a,**kwargs:{'order_id':row.id,'status':1,'amount':100,'currency_display':'ILS','currency_payment':'ILS','currency_course':1})
    def settle(_):
        with s.sessions() as db: money.reconcile(db,row.id)
    with ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(settle,[1,2]))
    s.db.expire_all();assert s.acct.balance==before+100_000_000


def test_chargeback_and_revert_restore_balance_once(state,monkeypatch):
    s=state;row=MessagingTopup(id='chargeback-order',company_id=s.company.id,request_key='chargeback-order',amount_minor=10000,status='pending',test_mode=True)
    s.db.add(row);s.db.commit();before=s.acct.balance
    monkeypatch.setattr(settings,'ALLPAY_TEST_MODE',True)
    status={'order_id':row.id,'status':1,'amount':100,'currency_display':'ILS','currency_payment':'ILS','currency_course':1}
    monkeypatch.setattr(money.allpay,'request',lambda *a,**kwargs:status)
    money.reconcile(s.db,row.id)
    status.update(status=3,refunded=100)
    money.reconcile(s.db,row.id)
    assert s.acct.balance==before
    def request(endpoint,*args,**kwargs):
        if endpoint=='paymentstatus':return status
        return {'next_page':0,'transactions':[{'transaction_id':42,'type':'chargeback_revert','order_id':row.id,'currency_payment':'ILS','amount':100}]}
    monkeypatch.setattr(money.allpay,'request',request)
    money.reconcile(s.db,row.id,include_reverts=True);money.reconcile(s.db,row.id,include_reverts=True);money.reconcile(s.db,row.id)
    assert s.acct.balance==before+100_000_000 and row.reversed==0


def test_late_delivery_failure_remains_billable_without_second_charge(state):
    s=state;s.acct.allowance_override=0;s.acct.allowance=0;s.db.commit()
    quote_run(s);deliver_once(s.sessions);s.db.expire_all()
    before=s.acct.balance
    engine.provider_event(s.db,{'key':'late-failure','provider_id':'email-1','type':'email.failed'},'resend')
    delivery=s.db.query(CampaignDelivery).one()
    assert delivery.status=='undeliverable' and s.acct.balance==before
    assert s.db.query(MessagingLedger).filter_by(kind='usage').count()==1


def test_scheduled_run_is_created_once_and_advances_past_missed_dates(state):
    s=state
    s.d.status='scheduled';s.d.approved_catalog=1;s.d.max_cost=1000000;s.d.actor_id=s.user.id
    s.d.schedule={'kind':'daily','start':(now()-timedelta(days=10)).isoformat(),'timezone':'Asia/Jerusalem'}
    s.d.next_run=now()-timedelta(days=3);s.db.commit()
    assert schedule_once(s.sessions)
    s.db.expire_all()
    assert s.db.query(CampaignRun).count()==1 and engine.aware(s.d.next_run)>now()
    assert not schedule_once(s.sessions)


def test_stopping_a_run_releases_queued_reservations(state):
    s=state;run=quote_run(s)
    result=s.http.post(f'/campaigns/{s.c.id}/runs/{run.id}/cancel')
    assert result.status_code==200
    s.db.expire_all()
    assert s.acct.reserved==0 and s.acct.held==0
    assert s.db.query(CampaignDelivery).one().status=='cancelled'


def test_manual_topup_uses_hosted_checkout_without_saved_card_and_reuses_request(state,monkeypatch):
    s=state;calls=[]
    monkeypatch.setattr(settings,'ALLPAY_TEST_MODE',True)
    def provider(endpoint,payload,**kwargs):
        calls.append((endpoint,payload));return {'payment_url':'https://allpay.to/test-checkout'}
    monkeypatch.setattr(money.allpay,'request',provider)
    payload={'amount_minor':10000,'request_key':'manual-topup-key','locale':'he'}
    first=s.http.post('/messaging/topups',json=payload)
    assert first.status_code==200
    second=s.http.post('/messaging/topups',json=payload)
    assert first.json()['id']==second.json()['id'] and len(calls)==1
    assert calls[0][0]=='getpayment'
    assert 'allpay_token' not in calls[0][1] and 'subscription' not in calls[0][1]
    s.db.expire_all();assert s.acct.balance==100_000_000 and s.sub.status=='active'


def test_refund_reserves_unspent_value_and_settles_from_verified_status(state,monkeypatch):
    s=state;row=MessagingTopup(id='refund-order',company_id=s.company.id,request_key='refund-order',amount_minor=10000,status='pending',test_mode=True)
    s.db.add(row);s.db.commit()
    monkeypatch.setattr(settings,'ALLPAY_TEST_MODE',True)
    status={'order_id':row.id,'status':1,'order_amount':100,'amount':100,'currency_display':'ILS','currency_payment':'ILS','currency_course':1}
    def provider(endpoint,payload,**kwargs):
        if endpoint=='refund':status.update(status=4,refunded=50)
        return status
    monkeypatch.setattr(money.allpay,'request',provider)
    money.reconcile(s.db,row.id);before=s.acct.balance
    result=money.refund(s.db,row.id,5000,s.user,'Customer request')
    assert result['status']=='paid' and s.acct.balance==before-50_000_000 and s.acct.reserved==0
    assert row.reversed==50_000_000
    with pytest.raises(HTTPException):money.refund(s.db,row.id,6000,s.user,'Too much')


def test_ledger_reservation_projection_returns_to_zero_after_settlement(state):
    s=state;s.acct.allowance_override=0;s.acct.allowance=0;s.db.commit()
    quote_run(s)
    held=sum(r.amount for r in s.db.query(MessagingLedger).filter(MessagingLedger.kind.in_(['reserve','release'])))
    assert held==-10000
    deliver_once(s.sessions);s.db.expire_all()
    assert sum(r.amount for r in s.db.query(MessagingLedger).filter(MessagingLedger.kind.in_(['reserve','release'])))==0
    assert sum(r.amount for r in s.db.query(MessagingLedger))==-10000


def test_owner_catalog_and_company_overrides_are_not_tenant_ceo_privileges(state,monkeypatch):
    s=state;monkeypatch.setattr(settings,'OWNER_USER_IDS','')
    assert s.http.get('/admin/messaging/catalog').status_code==403
    monkeypatch.setattr(settings,'OWNER_USER_IDS',str(s.user.id))
    catalog=s.http.get('/admin/messaging/catalog').json()
    result=s.http.put('/admin/messaging/catalog',json={**catalog,'allowances':{'essential':100},'reason':'Launch pricing'})
    assert result.status_code==200
    assert s.http.get('/admin/messaging/catalog').json()['revision']==2
    s.user.role_level=3
    assert s.http.post('/messaging/topups',json={'amount_minor':10000,'request_key':'manager-funding'}).status_code==403

@pytest.fixture
def micropay(state, monkeypatch):
    from services.micropay_sms import MicropaySms
    monkeypatch.setattr(settings,'MICROPAY_TOKEN','test-token')
    monkeypatch.setattr(settings,'MICROPAY_SENDER','Prysm')
    monkeypatch.setattr(settings,'MICROPAY_WEBHOOK_SECRET','s'*40)
    monkeypatch.setattr(settings,'MICROPAY_UNIT_TIERS','[[134,1],[268,2]]')
    monkeypatch.setattr(providers,'_sms',None)
    state.c.email_enabled=False;state.c.sms_enabled=True;state.c.sms_content='שלום'
    state.db.commit()
    state.db.add(MessagingConsent(company_id=state.company.id, channel='sms', destination='+972501234567', granted=True, evidence='Explicit SMS opt-in fixture', actor_id=state.user.id))
    state.db.commit()
    return MicropaySms()


def test_micropay_units_are_not_transport_segments(state, micropay, monkeypatch):
    from services.micropay_sms import wire_text
    assert micropay.billing('א'*134)[0]==1
    assert providers.segments('א'*134)==2
    assert micropay.billing('א'*135)[0]==2
    assert micropay.billing('😀'*67)[0]==1
    assert micropay.billing('😀'*68)[0]==2
    assert wire_text('a\r\nb\nc\rd')=='a\rb\rc\rd'
    monkeypatch.setattr(settings,'MICROPAY_UNIT_TIERS','[[134,1]]')
    with pytest.raises(ValueError):micropay.billing('א'*135)
    for value in ['[]','[[134,0]]','[[134,1],[100,2]]','{}','[[134,1],[268,1]]']:
        monkeypatch.setattr(settings,'MICROPAY_UNIT_TIERS',value)
        assert not micropay.ready()


def test_micropay_wire_response_and_ambiguous_timeout(state,micropay,monkeypatch):
    import httpx
    calls=[]
    def post(url,**kwargs):
        calls.append((url,kwargs))
        return httpx.Response(200,json={'status':1,'message':'OK','data':{'taskId':'42','count':1}})
    monkeypatch.setattr(httpx,'post',post)
    assert micropay.send(destination='+972501234567',content='שלום\nעולם',key='delivery-id').status=='submitted'
    assert calls[0][1]['json']['list']=='972501234567'
    assert calls[0][1]['json']['msg']=='שלום\rעולם'
    for response,expected in [(httpx.Response(200,json={'status':0,'message':'ERROR'}),'failed'),(httpx.Response(200,json={'status':1,'message':'OK'}),'uncertain'),(httpx.Response(500),'uncertain'),(httpx.Response(429),'uncertain')]:
        monkeypatch.setattr(httpx,'post',lambda *a,**k:response)
        assert micropay.send(destination='+972501234567',content='x',key='key').status==expected
    def timeout(*a,**k):raise httpx.ReadTimeout('timeout')
    monkeypatch.setattr(httpx,'post',timeout)
    assert micropay.send(destination='+972501234567',content='x',key='key').status=='uncertain'


def test_micropay_run_charges_frozen_units_and_dlr_is_idempotent(state,micropay,monkeypatch):
    s=state
    monkeypatch.setattr(type(micropay),'send',lambda *a,**k:providers.Outcome('submitted','42'))
    q=engine.preview(s.db,s.c,s.user)
    run=engine.create_run(s.db,s.c,s.user,'sms-units',q['quote'])
    delivery=s.db.query(CampaignDelivery).one()
    assert delivery.cost==delivery.billing_units*100000==q['total_cost']
    assert q['billing_units']==delivery.billing_units
    assert delivery.billing_units < delivery.segments
    before=s.acct.balance
    assert deliver_once(s.sessions)
    s.db.expire_all();assert s.acct.balance==before-delivery.cost
    path='/messaging/webhooks/micropay/'+'s'*40
    event={'type':'pushreg','msgid':'42','phone':'0501234567','status':'nd'}
    assert s.http.head(path,params=event).status_code==200
    assert s.http.post(path,json=event).status_code==200
    s.db.expire_all();assert delivery.status=='undeliverable' and s.acct.balance==before-delivery.cost
    assert s.db.query(MessagingLedger).filter_by(kind='usage').count()==1
    event['status']='ok'
    assert s.http.post(path,json=event).status_code==200
    s.db.expire_all();assert delivery.status=='delivered'
    assert s.http.get('/messaging/usage').json()['groups'][0]['billing_units']==delivery.billing_units
    assert s.http.post('/messaging/webhooks/micropay/bad',json=event).status_code==404
    event['phone']='0507654321'
    assert s.http.post(path,json=event).status_code==400


def test_micropay_callback_before_send_response_is_durable(state,micropay):
    from workers.campaign_worker import reconcile_events
    s=state;run=quote_run(s)
    delivery=s.db.query(CampaignDelivery).one();delivery.provider='micropay';s.db.commit()
    event=micropay.event({'type':'pushreg','msgid':'early','phone':'0501234567','status':'nd'})
    engine.provider_event(s.db,event,'micropay')
    assert s.db.get(MessagingEvent,event['key']).kind=='pending'
    delivery.provider_id='early';s.db.commit()
    reconcile_events(s.sessions)
    s.db.expire_all()
    assert delivery.status=='undeliverable' and delivery.settled
    assert s.db.get(MessagingEvent,event['key']).payload is None


def test_micropay_tariff_changes_invalidate_quotes_and_queued_sends(state,micropay,monkeypatch):
    s=state;q=engine.preview(s.db,s.c,s.user)
    monkeypatch.setattr(settings,'MICROPAY_UNIT_TIERS','[[134,2],[268,3]]')
    with pytest.raises(HTTPException):engine.create_run(s.db,s.c,s.user,'stale-units',q['quote'])
    s.db.rollback()
    q=engine.preview(s.db,s.c,s.user);engine.create_run(s.db,s.c,s.user,'new-units',q['quote'])
    monkeypatch.setattr(settings,'MICROPAY_TOKEN','different-account')
    monkeypatch.setattr(type(micropay),'send',lambda *a,**k:pytest.fail('Changed provider account must never send'))
    assert deliver_once(s.sessions)
    s.db.expire_all();delivery=s.db.query(CampaignDelivery).one()
    assert delivery.status=='suppressed' and delivery.error=='sms_tariff_changed' and s.acct.reserved==0


def test_micropay_status_poll_does_not_claim_handset_delivery(state,micropay,monkeypatch):
    import httpx
    for status,expected in [('done','submitted'),('pending','submitted'),('na','uncertain'),('noMsgLeft','uncertain')]:
        monkeypatch.setattr(httpx,'post',lambda *a,**k:httpx.Response(200,json={'status':1,'message':'OK','data':{'taskStatus':status}},request=httpx.Request('POST','https://www.micropay.co.il')))
        assert micropay.reconcile('42').status==expected


def test_unit_migration_preserves_historical_charges():
    import importlib.util
    from pathlib import Path
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from sqlalchemy import text
    db=create_engine('sqlite://')
    with db.begin() as conn:
        conn.execute(text('CREATE TABLE campaign_deliveries (id TEXT PRIMARY KEY, segments INTEGER, cost BIGINT)'))
        conn.execute(text('CREATE TABLE messaging_events (key TEXT PRIMARY KEY)'))
        conn.execute(text("INSERT INTO campaign_deliveries VALUES ('old',4,40000)"))
        path=Path(__file__).parents[1]/'alembic/versions/0059_micropay_units.py'
        spec=importlib.util.spec_from_file_location('unit_migration',path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        with Operations.context(MigrationContext.configure(conn)):module.upgrade()
        assert conn.execute(text('SELECT segments,billing_units,cost,billing_policy FROM campaign_deliveries')).one()==(4,4,40000,None)
    db.dispose()


def test_postgres_micropay_concurrent_callbacks_settle_once(state,micropay):
    s=state
    if s.db.get_bind().dialect.name!='postgresql':pytest.skip('Requires disposable PostgreSQL')
    from concurrent.futures import ThreadPoolExecutor
    run=quote_run(s)
    delivery=s.db.query(CampaignDelivery).one();delivery.provider='micropay';delivery.provider_id='parallel-dlr';s.db.commit()
    event=micropay.event({'type':'pushreg','msgid':'parallel-dlr','phone':'0501234567','status':'ok'})
    before=s.acct.balance
    def callback(_):
        with s.sessions() as db:engine.provider_event(db,event,'micropay')
    with ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(callback,[1,2]))
    s.db.expire_all()
    assert s.acct.balance==before-delivery.cost and s.acct.reserved==0
    assert s.db.query(MessagingEvent).count()==1
    assert s.db.query(MessagingLedger).filter_by(kind='usage').count()==1


def test_compact_sms_unsubscribe_is_authenticated_and_scanner_safe(state,monkeypatch):
    s=state;s.http.app.include_router(messaging.public_router)
    run=quote_run(s);row=s.db.query(CampaignDelivery).one()
    short=engine.sms_unsubscribe_url(row.id).rsplit('/',1)[-1]
    assert len(short)==38 and engine.decode_unsubscribe(short)==row.id
    legacy=engine.unsubscribe_url(row.id).rsplit('/',1)[-1]
    assert engine.decode_unsubscribe(legacy)==row.id
    assert s.http.get('/s/'+short).status_code==200
    assert not engine.filters.suppressed(s.db,s.company.id,'email',row.destination)
    for bad in [short[:-1],short+'a',short[:22]+'a'*16,'!'+short[1:]]:
        assert s.http.post('/s/'+bad).status_code==404
    assert s.http.post('/s/'+short).status_code==200
    assert s.http.post('/s/'+short).status_code==200
    assert s.db.query(MessagingSuppression).count()==1
    monkeypatch.setattr(settings,'CAMPAIGN_PUBLIC_URL','https://api.prysm.co.il')
    assert len(engine.sms_unsubscribe_url(row.id))==64
    assert len('שלום דניאל, הגיע הזמן לבדיקה. לקביעת תור: 03-5555555\n'+engine.sms_unsubscribe_url(row.id))<=134


def test_realistic_sms_with_short_link_fits_unit(state,micropay,monkeypatch):
    s=state;monkeypatch.setattr(settings,'CAMPAIGN_PUBLIC_URL','https://api.prysm.co.il')
    s.c.sms_content='שלום {first_name}, הגיע הזמן לבדיקה. לפרטים: 03-5555555'
    q=engine.preview(s.db,s.c,s.user)
    assert q['sms']==1 and q['billing_units']==1 and not q['errors']
    run=engine.create_run(s.db,s.c,s.user,'short-sms',q['quote'])
    row=s.db.query(CampaignDelivery).one()
    assert '/s/' in row.content and engine.sms_unsubscribe_url(row.id) in row.content
    assert micropay.billing(row.content)[0]==row.billing_units==1


def test_monthly_per_clinic_allowances_pool_only_actual_paid_clinics(state):
    s = state
    prices = money.catalog(s.db)
    prices.email_per_clinic, prices.sms_per_clinic = 1000, 200
    s.sub.clinic_limit = 3
    s.sub.plan_code = 'growth'
    s.sub.current_period_starts_at = now() - timedelta(hours=1)
    s.sub.current_period_ends_at = now() + timedelta(days=30)
    s.db.commit()
    money.account(s.db, s.company.id)
    assert money.allowances(s.db, s.acct)['email']['limit'] == 1000
    assert money.allowances(s.db, s.acct)['sms']['limit'] == 200
    second = Clinic(name='Second', company_id=s.company.id, unique_id='second', is_active=True)
    s.db.add(second); s.db.commit()
    money.account(s.db, s.company.id)
    p = money.current_period(s.db, s.acct)
    assert (p.email_limit, p.sms_limit, p.eligible_clinics) == (2000, 400, 2)
    second.is_active = False; s.db.commit(); money.account(s.db, s.company.id)
    second.is_active = True; s.db.commit(); money.account(s.db, s.company.id)
    assert (p.email_limit, p.sms_limit, p.eligible_clinics) == (2000, 400, 2)
    second.is_active = False
    s.sub.current_period_starts_at = now() - timedelta(minutes=1)
    s.db.commit(); money.account(s.db, s.company.id)
    p = money.current_period(s.db, s.acct)
    assert (p.email_limit, p.sms_limit, p.eligible_clinics) == (1000, 200, 1)


def test_sms_included_units_are_reserved_and_consumed_separately(state, micropay, monkeypatch):
    s = state
    p = money.current_period(s.db, s.acct); p.sms_limit = 1
    s.c.email_enabled = False; s.c.sms_enabled = True; s.c.sms_content = 'Short'
    s.db.commit()
    q = engine.preview(s.db, s.c, s.user)
    assert q['channels']['sms'] == {'included_units': 1, 'paid_units': 0, 'cost': 0}
    run = engine.create_run(s.db, s.c, s.user, 'included-sms-run', q['quote'])
    balance = s.acct.balance
    monkeypatch.setattr(type(micropay), 'send', lambda *a, **kw: providers.Outcome('submitted', 'included-sms-id'))
    assert deliver_once(s.sessions)
    s.db.expire_all()
    p = money.current_period(s.db, s.acct)
    assert (p.sms_used, p.sms_held, p.email_used, s.acct.balance) == (1, 0, 0, balance)
    delivery = s.db.query(CampaignDelivery).filter_by(run_id=run.id).one()
    engine.provider_event(s.db, {'key':'sms-replay', 'provider_id':'included-sms-id', 'type':'sms.undeliverable'}, 'micropay')
    s.db.refresh(p)
    assert p.sms_used == 1 and delivery.status == 'undeliverable'


def test_old_period_callback_settles_original_allowance_after_renewal(state):
    s = state
    run = quote_run(s)
    delivery = s.db.query(CampaignDelivery).filter_by(run_id=run.id).one()
    old = money.current_period(s.db, s.acct)
    assert old.email_held == 1
    s.sub.current_period_starts_at = now() - timedelta(minutes=1)
    s.sub.current_period_ends_at = now() + timedelta(days=30)
    s.db.commit(); money.account(s.db, s.company.id)
    current = money.current_period(s.db, s.acct)
    engine.apply_outcome(s.db, delivery, providers.Outcome('submitted', 'late-id'))
    s.db.commit()
    assert (old.email_used, old.email_held, current.email_used, current.email_held) == (1, 0, 0, 0)
    assert s.acct.used == 0 and s.acct.held == 0


def test_explicit_marketing_consent_is_required_and_rechecked(state):
    s = state
    consent = s.db.get(MessagingConsent, (s.company.id, 'email', 'a@example.com'))
    consent.granted = False; s.db.commit()
    q = engine.preview(s.db, s.c, s.user)
    assert q['emails'] == 0 and q['excluded']['consent_required'] == 1
    s.db.commit()
    result = s.http.put('/messaging/consent', json={'client_id':s.a.id,'channel':'email','granted':True,'evidence':'Signed consent form 2026-11-08'})
    assert result.status_code == 200
    assert s.http.get('/messaging/consent-clients?search=example').json()[0]['channels']['email']['granted']
    run = quote_run(s)
    s.db.refresh(consent)
    consent.granted = False; s.db.commit()
    assert deliver_once(s.sessions)
    s.db.expire_all()
    delivery = s.db.query(CampaignDelivery).filter_by(run_id=run.id).one()
    assert delivery.status == 'suppressed' and delivery.error == 'consent_required'
    assert s.acct.held == 0
    foreign = s.db.query(Client).filter_by(company_id=s.other.company_id).one()
    assert s.http.put('/messaging/consent', json={'client_id':foreign.id,'channel':'email','granted':True,'evidence':'Out of scope'}).status_code == 403


def test_trial_and_unanchored_managed_accounts_receive_no_allowance(state):
    s = state
    s.sub.status = 'trialing'; s.db.commit(); money.account(s.db, s.company.id)
    assert s.acct.period_start is None
    assert money.allowances(s.db, s.acct)['email']['limit'] == 0
    s.sub.status = 'legacy_active'; s.sub.current_period_starts_at = s.sub.current_period_ends_at = None
    s.db.commit(); money.account(s.db, s.company.id)
    assert s.acct.period_start is None
    s.acct.manual_anchor = now() - timedelta(days=90)
    s.db.commit(); money.account(s.db, s.company.id)
    assert s.acct.period_end > now()


def test_provider_rejected_quota_remains_queued_without_spending(state):
    s = state
    run = quote_run(s)
    delivery = s.db.query(CampaignDelivery).filter_by(run_id=run.id).one()
    delivery.attempts = 20
    engine.apply_outcome(s.db, delivery, providers.Outcome('retry', code='email_daily_quota', retry_after=600))
    s.db.commit()
    assert delivery.status == 'queued' and not delivery.settled and s.acct.held == 1
    assert delivery.next_attempt > now() + timedelta(minutes=9)


def test_summary_preserves_email_aliases_and_adds_channel_balances(state):
    s = state
    result = s.http.get('/messaging/summary').json()
    assert result['allowance'] == result['included']['email']['limit'] == 1
    assert result['included']['sms']['limit'] == 0
    assert result['eligible_clinics'] == 1


def test_additive_allowance_migration_preserves_wallet_and_email_usage(state):
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from sqlalchemy import text
    from pathlib import Path
    import importlib.util
    s = state
    balance = s.acct.balance
    s.db.commit()
    with s.db.bind.begin() as connection:
        for table in ('messaging_periods', 'messaging_consents', 'messaging_provider_states'):
            connection.execute(text('DROP TABLE ' + table))
        connection.execute(text('ALTER TABLE messaging_accounts DROP COLUMN sms_allowance_override'))
        for column in ('email_per_clinic', 'sms_per_clinic'):
            connection.execute(text('ALTER TABLE messaging_catalog DROP COLUMN ' + column))
        connection.execute(text('UPDATE messaging_accounts SET used=1, held=0'))
        spec = importlib.util.spec_from_file_location('campaign_allowance_upgrade', Path(__file__).parents[1] / 'alembic/versions/0061_campaign_allowances.py')
        module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
        with Operations.context(MigrationContext.configure(connection)):
            module.upgrade()
        assert connection.execute(text('SELECT balance FROM messaging_accounts')).scalar() == balance
        assert connection.execute(text('SELECT email_used FROM messaging_periods')).scalar() == 1
        assert tuple(connection.execute(text('SELECT email_per_clinic,sms_per_clinic,email_rate,sms_rate FROM messaging_catalog')).one()) == (1000,200,10000,50000)
        assert connection.execute(text('SELECT count(*) FROM messaging_consents')).scalar() == 0
    s.db.expire_all()


def test_resend_usage_gate_and_quota_retry_are_shared(state, monkeypatch):
    from services import campaign_monitoring as monitoring
    slot = real_email_slot
    s = state
    row = monitoring.state(s.db, 'resend')
    row.checked_at = now()
    row.usage = {'daily':{'used':99,'limit':100,'resets_at':(now()+timedelta(hours=2)).isoformat()},
                 'monthly':{'used':2999,'limit':3000,'resets_at':(now()+timedelta(days=2)).isoformat()}}
    s.db.commit()
    assert slot(s.db) is None
    s.db.commit()
    s.db.refresh(row)
    assert row.usage['daily']['used'] == 100
    row.next_request_at = now() - timedelta(seconds=1); s.db.commit()
    wait = slot(s.db)
    assert wait[1] == 'email_daily_quota'
    assert wait[0] > now()
    s.db.commit()
    assert slot(s.db)[1] == 'email_daily_quota'


def test_resend_429_quota_is_not_a_delivery_failure(monkeypatch):
    import httpx
    monkeypatch.setattr(providers, 'email_ready', lambda: True)
    monkeypatch.setattr(settings, 'CAMPAIGN_EMAIL_FROM', 'Prysm <campaigns@mail.prysm.co.il>')
    monkeypatch.setattr(providers.httpx, 'post', lambda *a, **kw: httpx.Response(429, json={'name':'daily_quota_exceeded'}))
    result = providers.send_email(NS(id='id',destination='owner@example.com',subject='Test',content='Test'), None, 'https://example.com/unsubscribe', 'Clinic')
    assert result.status == 'retry' and result.code == 'email_daily_quota' and result.retry_after > 0


def test_postgres_concurrent_runs_cannot_reserve_the_same_included_unit(state):
    import concurrent.futures
    s = state
    if s.db.bind.dialect.name != 'postgresql': pytest.skip('PostgreSQL lock semantics')
    s.c.execute_once_per_client = False
    s.db.commit()
    quote = engine.preview(s.db, s.c, s.user)['quote']; s.db.commit()
    campaign_id, user_id = s.c.id, s.user.id
    def create(key):
        with s.sessions() as db:
            try:
                return engine.create_run(db, db.get(Campaign,campaign_id), db.get(User,user_id), key, quote).id
            except HTTPException as error:
                db.rollback()
                return error.detail['code']
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(create, ['included-concurrent-a','included-concurrent-b']))
    assert results.count('quote_stale') == 1
    s.db.expire_all()
    p = money.current_period(s.db, s.acct)
    assert (p.email_held, p.email_used) == (1,0)
    assert s.acct.reserved == 0


def test_pausing_sending_keeps_callback_reconciliation_available(state, micropay, monkeypatch):
    from workers.campaign_worker import reconcile_events
    s = state
    s.c.email_enabled=False; s.c.sms_enabled=True; s.c.sms_content='Test'
    s.db.commit(); run=quote_run(s)
    d=s.db.query(CampaignDelivery).filter_by(run_id=run.id).one()
    d.provider='micropay'; d.status='sending'; s.db.commit()
    engine.provider_event(s.db, {'key':'paused-orphan','provider_id':'paused-task','destination':d.destination,'type':'sms.delivered'}, 'micropay')
    d.provider_id='paused-task'; s.db.commit()
    monkeypatch.setattr(settings,'CAMPAIGN_SENDING_ENABLED',False)
    reconcile_events(s.sessions)
    s.db.expire_all()
    assert d.status=='delivered' and d.settled
    assert s.db.get(MessagingEvent,'paused-orphan').kind=='delivered'


def test_manual_messaging_funding_does_not_enable_subscription_collection(monkeypatch):
    from services import allpay
    import httpx
    monkeypatch.setattr(settings,'MESSAGING_ALLPAY_API_LOGIN','')
    monkeypatch.setattr(settings,'MESSAGING_ALLPAY_API_KEY','')
    monkeypatch.setattr(settings,'MESSAGING_ALLPAY_TEST_MODE',True)
    monkeypatch.setattr(settings,'ALLPAY_API_LOGIN','test-login')
    monkeypatch.setattr(settings,'ALLPAY_API_KEY','test-key')
    monkeypatch.setattr(settings,'ALLPAY_TEST_MODE',True)
    monkeypatch.setattr(settings,'BILLING_CHARGING_ENABLED',False)
    monkeypatch.setattr(settings,'MESSAGING_TOPUPS_ENABLED',True)
    def post(url,**kwargs):
        assert kwargs['json']['test_mode']==1
        assert 'allpay_token' not in kwargs['json']
        return httpx.Response(200,json={'payment_url':'https://allpay.to/test'},request=httpx.Request('POST',url))
    monkeypatch.setattr(allpay.httpx,'post',post)
    assert allpay.request('getpayment',{'order_id':'manual'},messaging=True)['payment_url']
    with pytest.raises(allpay.AllpayError,match='billing_disabled'):
        allpay.request('getpayment',{'order_id':'subscription'})


def test_thousand_recipient_approval_reserves_atomically_without_per_recipient_flushes(state):
    from sqlalchemy import event
    s=state
    p=money.current_period(s.db,s.acct);p.email_limit=1000
    for index in range(999):
        destination=f'bulk-{index}@example.com'
        s.db.add(Client(company_id=s.company.id,clinic_id=s.clinic.id,first_name='Fixture',email=destination,send_notifications=True))
        s.db.add(MessagingConsent(company_id=s.company.id,channel='email',destination=destination,granted=True,evidence='Isolated bulk fixture opt-in',actor_id=s.user.id))
    s.db.commit()
    statements=[]
    def count(*args):statements.append(1)
    event.listen(s.db.bind,'before_cursor_execute',count)
    try:
        run=quote_run(s,'bulk-approval')
    finally:
        event.remove(s.db.bind,'before_cursor_execute',count)
    assert s.db.query(CampaignDelivery).filter_by(run_id=run.id).count()==1000
    assert s.db.query(CampaignContactClaim).count()==1000
    assert s.acct.held==1000 and s.acct.reserved==0
    assert len(statements)<80


def test_legacy_owner_payloads_preserve_new_allowance_configuration(state, monkeypatch):
    s=state
    monkeypatch.setattr(settings,'OWNER_USER_IDS',str(s.user.id))
    prices=money.catalog(s.db);prices.email_per_clinic=1500;prices.sms_per_clinic=300
    s.acct.sms_allowance_override=17
    period=money.current_period(s.db,s.acct);period.sms_per_clinic=200
    s.db.commit()
    payload=s.http.get('/admin/messaging/catalog').json()
    payload.pop('email_per_clinic');payload.pop('sms_per_clinic');payload['reason']='Legacy portal compatibility'
    assert s.http.put('/admin/messaging/catalog',json=payload).status_code==200
    s.db.expire_all()
    assert (prices.email_per_clinic,prices.sms_per_clinic)==(1500,300)
    body={'manual_anchor':None,'allowance_override':None,'reason':'Legacy account editor'}
    assert s.http.put(f'/admin/messaging/companies/{s.company.id}',json=body).status_code==200
    s.db.expire_all();assert s.acct.sms_allowance_override==17
    assert s.http.put(f'/admin/messaging/companies/{s.company.id}',json={**body,'sms_allowance_override':None}).status_code==200
    s.db.expire_all();assert money.current_period(s.db,s.acct).sms_limit==200


def test_browser_unsubscribe_has_trilingual_confirmation_without_breaking_one_click(state):
    s=state;run=quote_run(s)
    d=s.db.query(CampaignDelivery).filter_by(run_id=run.id).one()
    token=engine.unsubscribe_url(d.id).split('/')[-1]
    result=s.http.post('/messaging/unsubscribe/'+token,headers={'accept':'text/html'})
    assert result.status_code==200 and result.headers['content-type'].startswith('text/html')
    assert all(text in result.text for text in ('You are unsubscribed','הוסרת בהצלחה','Désinscription confirmée'))
    assert result.headers['cache-control']=='no-store'
    assert s.http.post('/messaging/unsubscribe/'+token).json()=={'unsubscribed':True}


def test_restarted_tunnel_cannot_send_an_old_sms_unsubscribe_link(state,micropay,monkeypatch):
    s=state;run=quote_run(s);calls=[]
    monkeypatch.setattr(type(micropay),'send',lambda **kw:calls.append(kw) or providers.Outcome('submitted','should-not-send'))
    monkeypatch.setattr(settings,'CAMPAIGN_PUBLIC_URL','https://new-staging-origin.example')
    assert deliver_once(s.sessions)
    s.db.expire_all();d=s.db.query(CampaignDelivery).filter_by(run_id=run.id).one()
    assert not calls and d.status=='suppressed' and d.error=='unsubscribe_origin_changed'
    assert s.acct.reserved==0


def test_separate_messaging_credentials_and_test_mode_do_not_change_subscriptions(monkeypatch):
    import httpx
    from services import allpay
    for key,value in [('ALLPAY_API_LOGIN','subscription-login'),('ALLPAY_API_KEY','subscription-key'),
                      ('MESSAGING_ALLPAY_API_LOGIN','messaging-login'),('MESSAGING_ALLPAY_API_KEY','messaging-key'),
                      ('ALLPAY_TEST_MODE',False),('MESSAGING_ALLPAY_TEST_MODE',True),
                      ('MESSAGING_TOPUPS_ENABLED',True),('ALLPAY_LIVE_PAYMENTS_ENABLED',False)]:monkeypatch.setattr(settings,key,value)
    calls=[]
    def post(url,**kwargs):
        calls.append(kwargs['json'])
        return httpx.Response(200,json={'payment_url':'https://allpay.to/test'},request=httpx.Request('POST',url))
    monkeypatch.setattr(allpay.httpx,'post',post)
    allpay.request('getpayment',{'order_id':'messaging'},messaging=True)
    assert calls[-1]['login']=='messaging-login' and calls[-1]['test_mode']==1
    assert calls[-1]['sign']==allpay.signature(calls[-1],'messaging-key')
    allpay.request('paymentstatus',{'order_id':'old-order'},messaging=True,integration_login='subscription-login',test_mode=False)
    assert calls[-1]['login']=='subscription-login'
    with pytest.raises(allpay.AllpayError,match='billing_live_disabled'):
        allpay.request('refund',{'order_id':'old-order'},messaging=True,integration_login='subscription-login',test_mode=False)


def test_messaging_signature_cannot_authorize_subscription_webhooks(state,monkeypatch):
    from EndPoints import subscriptions
    from services import allpay
    s=state;s.http.app.include_router(subscriptions.router)
    monkeypatch.setattr(settings,'MESSAGING_ALLPAY_API_LOGIN','messaging-login')
    monkeypatch.setattr(settings,'MESSAGING_ALLPAY_API_KEY','messaging-key')
    payload={'order_id':'unrelated-subscription','status':1,'amount':100}
    payload['sign']=allpay.signature(payload,'messaging-key')
    assert s.http.post('/subscriptions/webhooks/allpay',json=payload).status_code==400
    topup=MessagingTopup(id='scoped-topup',company_id=s.company.id,request_key='scoped-topup',amount_minor=10000,status='pending',test_mode=True,provider_login='messaging-login',checkout_mode='redirect')
    s.db.add(topup);s.db.commit();calls=[]
    monkeypatch.setattr(money,'reconcile',lambda db,order_id,**kwargs:calls.append(order_id))
    payload['order_id']=topup.id;payload['sign']=allpay.signature(payload,'messaging-key')
    assert s.http.post('/subscriptions/webhooks/allpay',json=payload).status_code==200
    assert calls==[topup.id]
    payload['sign']=allpay.signature(payload,'test-key')
    assert s.http.post('/subscriptions/webhooks/allpay',json=payload).status_code==400


def test_checkout_migration_keeps_legacy_payment_identity_and_money(state):
    from alembic.operations import Operations
    from alembic.migration import MigrationContext
    from sqlalchemy import text
    from pathlib import Path
    import importlib.util
    s=state;s.db.commit()
    with s.db.bind.begin() as connection:
        for column in ('provider_login','checkout_mode'):
            connection.execute(text('ALTER TABLE messaging_topups DROP COLUMN '+column))
        connection.execute(text("INSERT INTO messaging_topups(id,company_id,request_key,amount_minor,status,test_mode,reversed,created_at) VALUES ('old-checkout',:company,'old-checkout',12345,'paid',true,0,:created)"),{'company':s.company.id,'created':now()})
        spec=importlib.util.spec_from_file_location('checkout_upgrade',Path(__file__).parents[1]/'alembic/versions/0062_messaging_checkout.py')
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        with Operations.context(MigrationContext.configure(connection)):module.upgrade()
        assert connection.execute(text("SELECT amount_minor,status,provider_login,checkout_mode FROM messaging_topups WHERE id='old-checkout'")).one()==(12345,'paid',None,'hosted_fields')
    s.db.expire_all()
