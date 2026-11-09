"""Authenticated messaging finance and public, signed provider callbacks."""
from datetime import datetime, timedelta
from typing import Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy import func, case
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
from models import User, Clinic, Client, Subscription
from security.scope import get_allowed_clinic_ids
from security.owner import require_owner
from campaign_models import (MessagingAccount, MessagingCatalog, MessagingTopup, MessagingLedger, MessagingClinic,
    MessagingSuppression, MessagingConsent, MessagingProviderState, CampaignDelivery, CampaignRun, now)
from services import messaging_billing as money, campaign_engine as engine, campaign_providers as providers
from services.saas_billing import audit

router = APIRouter(prefix='/messaging', tags=['messaging'])

class TopupRequest(BaseModel):
    amount_minor: int = Field(gt=0)
    request_key: str = Field(min_length=8, max_length=80)
    locale: str = 'he'

class ClinicUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    budget: int | None = Field(default=None, ge=0)
    reply_to: str | None = Field(default=None, max_length=320)
    timezone: str = 'Asia/Jerusalem'

class CatalogUpdate(BaseModel):
    revision: int
    allowances: dict[str, int] = Field(default_factory=dict)
    email_per_clinic: int = Field(default=None, ge=0, le=10000000)
    sms_per_clinic: int = Field(default=None, ge=0, le=10000000)
    email_rate: int | None = Field(default=None, ge=0)
    sms_rate: int | None = Field(default=None, ge=0)
    packs: list[int]
    enabled: bool
    effective_at: datetime | None = None
    reason: str = Field(min_length=3, max_length=1000)

class AccountUpdate(BaseModel):
    manual_anchor: datetime | None = None
    allowance_override: int | None = Field(default=None, ge=0)
    sms_allowance_override: int | None = Field(default=None, ge=0)
    reason: str = Field(min_length=3, max_length=1000)


def topup_dict(row):
    return {k: getattr(row, k) for k in ('id', 'amount_minor', 'status', 'payment_url', 'receipt_url', 'created_at', 'reversed', 'test_mode', 'checkout_mode')}


def finance_access(user):
    if user.role_level < 4: money.reject('ceo_required', 403)


def providers_status(db):
    return {row.provider: {key: getattr(row, key) for key in
        ('credit_units', 'usage', 'checked_at', 'error', 'blocked_until', 'blocked_reason', 'last_callback_at')}
        for row in db.query(MessagingProviderState).all()}


@router.get('/summary')
def summary(clinic_id: int | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ids = get_allowed_clinic_ids(db, user, clinic_id)
    acct = money.account(db, user.company_id)
    prices = money.catalog(db)
    adapter = providers.sms_adapter()
    result = {k: getattr(acct, k) for k in ('balance', 'reserved', 'allowance', 'used', 'held', 'period_start', 'period_end', 'low_balance')}
    period = money.current_period(db, acct)
    result.update({'included': money.allowances(db, acct), 'eligible_clinics': period.eligible_clinics if period else 0,
        'per_clinic': {'email': period.email_per_clinic if period else prices.email_per_clinic, 'sms': period.sms_per_clinic if period else prices.sms_per_clinic},
        'provider_status': providers_status(db), 'available': acct.balance - acct.reserved, 'currency': 'ILS', 'money_scale': money.MICRO,
        'email_rate': prices.email_rate, 'sms_rate': prices.sms_rate, 'packs': prices.packs,
        'can_pay': user.role_level >= 4, 'can_manage': user.role_level >= 3,
        'email_ready': providers.email_ready(), 'sms_ready': bool(adapter and adapter.ready()),
        'sending_enabled': prices.enabled and __import__('config').settings.CAMPAIGN_SENDING_ENABLED, 'catalog_revision': prices.revision})
    result['clinics'] = [{'id': cid, 'name': db.get(Clinic, cid).name,
        **{k: getattr(money.clinic_settings(db, cid), k) for k in ('budget', 'reply_to', 'timezone')}} for cid in ids]
    db.commit()
    return result


@router.get('/usage')
def usage(clinic_id: int | None = None, start: datetime | None = None, end: datetime | None = None,
          offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100),
          user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ids = get_allowed_clinic_ids(db, user, clinic_id)
    start, end = start or now() - timedelta(days=30), end or now()
    if start > end or (end - start).days > 366: money.reject('invalid_range', 422)
    query = db.query(CampaignDelivery).filter(CampaignDelivery.company_id == user.company_id,
        CampaignDelivery.clinic_id.in_(ids), CampaignDelivery.created_at >= start, CampaignDelivery.created_at <= end)
    aggregate = query.with_entities(CampaignDelivery.clinic_id, CampaignDelivery.channel, CampaignDelivery.status,
        func.count(), func.sum(case((CampaignDelivery.settled & CampaignDelivery.status.in_(engine.ACCEPTED), CampaignDelivery.cost), else_=0)), func.sum(case((CampaignDelivery.settled & CampaignDelivery.status.in_(engine.ACCEPTED), CampaignDelivery.segments), else_=0)), func.sum(case((CampaignDelivery.settled & CampaignDelivery.status.in_(engine.ACCEPTED), CampaignDelivery.allowance), else_=0)), func.sum(case((CampaignDelivery.settled & CampaignDelivery.status.in_(engine.ACCEPTED), CampaignDelivery.billing_units), else_=0))).group_by(
        CampaignDelivery.clinic_id, CampaignDelivery.channel, CampaignDelivery.status).all()
    total = query.count()
    rows = query.order_by(CampaignDelivery.created_at.desc(), CampaignDelivery.id).offset(offset).limit(limit).all()
    return {'total': total, 'groups': [{'clinic_id': a, 'channel': b, 'status': c, 'count': d, 'cost': e or 0,
        'segments': f or 0, 'included': g or 0, 'billing_units': h or 0} for a,b,c,d,e,f,g,h in aggregate],
        'items': [{**{k: getattr(r, k) for k in ('id', 'run_id', 'campaign_id', 'clinic_id', 'channel', 'status', 'segments', 'billing_units', 'error', 'created_at')}, 'cost': r.cost if r.settled and r.status in engine.ACCEPTED else 0} for r in rows]}


@router.get('/ledger')
def ledger(offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100),
           user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    finance_access(user)
    query = db.query(MessagingLedger).filter_by(company_id=user.company_id)
    return {'total': query.count(), 'items': [{k: getattr(r, k) for k in ('id', 'kind', 'amount', 'clinic_id', 'reference', 'created_at')}
        for r in query.order_by(MessagingLedger.created_at.desc(), MessagingLedger.id).offset(offset).limit(limit)]}


@router.put('/clinics/{clinic_id}')
def update_clinic(clinic_id: int, payload: ClinicUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    engine.manager(user)
    get_allowed_clinic_ids(db, user, clinic_id)
    money.account(db, user.company_id)
    row = money.clinic_settings(db, clinic_id)
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
    try: ZoneInfo(payload.timezone)
    except (ZoneInfoNotFoundError, ValueError): money.reject('invalid_timezone', 422)
    if payload.reply_to and not engine.filters.normalize('email', payload.reply_to): money.reject('invalid_email', 422)
    if user.role_level < 4 and payload.budget != row.budget: money.reject('ceo_required', 403)
    before = {k: getattr(row, k) for k in ('budget', 'reply_to', 'timezone')}
    for key, value in payload.model_dump().items(): setattr(row, key, value)
    audit(db, user.company_id, user.id, 'messaging_clinic_settings', 'Clinic messaging settings', before, payload.model_dump())
    db.commit()
    return {'saved': True}


@router.post('/topups')
def topup(payload: TopupRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return topup_dict(money.topup(db, user, payload.amount_minor, payload.request_key,
        payload.locale if payload.locale in ('he', 'en', 'fr') else 'he'))


@router.get('/topups')
def topups(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    finance_access(user)
    return [topup_dict(r) for r in db.query(MessagingTopup).filter_by(company_id=user.company_id).order_by(MessagingTopup.created_at.desc()).limit(100)]


@router.post('/topups/{topup_id}/reconcile')
def reconcile(topup_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    finance_access(user)
    row = db.query(MessagingTopup).filter_by(id=topup_id, company_id=user.company_id).first()
    if not row: money.reject('payment_not_found', 404)
    return topup_dict(money.reconcile(db, row.id))


@router.get('/unsubscribe/{token}', response_class=HTMLResponse)
def unsubscribe_page(token: str, db: Session = Depends(get_db)):
    row = db.get(CampaignDelivery, engine.decode_unsubscribe(token))
    if not row: money.reject('invalid_link', 404)
    # GET is intentionally read-only: mail scanners cannot unsubscribe recipients.
    from services.campaign_public_copy import page
    return HTMLResponse(page(), headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'})


@router.post('/unsubscribe/{token}')
def unsubscribe(token: str, request: Request, db: Session = Depends(get_db)):
    row = db.get(CampaignDelivery, engine.decode_unsubscribe(token))
    if not row: money.reject('invalid_link', 404)
    money.account(db, row.company_id)
    if not engine.filters.suppressed(db, row.company_id, row.channel, row.destination):
        db.add(MessagingSuppression(scope=row.company_id, channel=row.channel, destination=row.destination, reason='unsubscribe'))
    db.commit()
    if 'text/html' in request.headers.get('accept', ''):
        from services.campaign_public_copy import page
        return HTMLResponse(page(completed=True), headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'})
    return {'unsubscribed': True}


@router.post('/webhooks/{provider}')
async def webhook(provider: str, request: Request, db: Session = Depends(get_db)):
    body = await request.body()
    if len(body) > 65536: raise HTTPException(413)
    try:
        if provider == 'resend': event = providers.verify_resend(body, dict(request.headers))
        elif providers.sms_adapter() and provider == providers.sms_adapter().name:
            event = providers.sms_adapter().verify_event(body, dict(request.headers))
        else: raise ValueError()
    except (ValueError, TypeError, KeyError): raise HTTPException(400, detail={'code': 'invalid_signature'})
    if event.get('ignored'): return {'received': True}
    engine.provider_event(db, event, provider)
    return {'received': True}


@router.api_route('/webhooks/micropay/{secret}', methods=['GET', 'HEAD', 'POST'])
async def micropay_webhook(secret: str, request: Request, db: Session = Depends(get_db)):
    import hmac
    from config import settings
    from services.micropay_sms import MicropaySms
    expected = settings.MICROPAY_WEBHOOK_SECRET
    if len(expected) < 32 or not hmac.compare_digest(secret.encode(), expected.encode()): raise HTTPException(404)
    try:
        if request.method == 'POST':
            body = await request.body()
            if len(body) > 65536: raise HTTPException(413)
            import json
            data = json.loads(body)
        else: data = dict(request.query_params)
        event = MicropaySms().event(data)
    except (ValueError, TypeError, AttributeError): raise HTTPException(400)
    from sqlalchemy.exc import IntegrityError
    try: engine.provider_event(db, event, 'micropay')
    except IntegrityError:
        # Concurrent duplicate orphan callbacks may race on the inbox's unique key.
        db.rollback()
        if not db.get(engine.MessagingEvent, event['key']): raise
    return {'received': True}


admin_router = APIRouter(prefix='/admin/messaging', tags=['owner-messaging'], dependencies=[Depends(require_owner)])

@admin_router.get('/catalog')
def admin_catalog(db: Session = Depends(get_db)):
    p = money.catalog(db)
    return {k: getattr(p, k) for k in ('revision', 'allowances', 'email_per_clinic', 'sms_per_clinic', 'email_rate', 'sms_rate', 'packs', 'enabled', 'effective_at', 'pending_config')}

@admin_router.put('/catalog')
def update_catalog(payload: CatalogUpdate, owner: User = Depends(require_owner), db: Session = Depends(get_db)):
    row = db.query(MessagingCatalog).filter_by(id=1).with_for_update().populate_existing().one()
    if payload.revision != row.revision: money.reject('quote_stale')
    if len(payload.packs) > 10 or not payload.packs or any(not 100 <= p <= 1_000_000 for p in payload.packs): money.reject('invalid_pack', 422)
    if any(v < 0 or v > 10_000_000 for v in payload.allowances.values()): money.reject('invalid_allowance', 422)
    before = {k: getattr(row, k) for k in ('allowances', 'email_per_clinic', 'sms_per_clinic', 'email_rate', 'sms_rate', 'packs', 'enabled', 'effective_at', 'pending_config')}
    values = payload.model_dump(exclude={'reason', 'revision', 'effective_at'}, exclude_unset=True)
    from services.subscription_service import aware
    if payload.effective_at and aware(payload.effective_at) > now():
        row.pending_config, row.effective_at = values, payload.effective_at
    else:
        for key, value in values.items(): setattr(row, key, value)
        row.pending_config, row.effective_at = None, None
        row.revision += 1
    audit(db, owner.company_id, owner.id, 'messaging_catalog', payload.reason, before, payload.model_dump())
    db.commit()
    return {'revision': row.revision}

@admin_router.get('/companies/{company_id}')
def admin_account(company_id: int, db: Session = Depends(get_db)):
    row = money.account(db, company_id)
    db.commit()
    return {k: getattr(row, k) for k in ('balance', 'reserved', 'allowance', 'used', 'held', 'period_start', 'period_end', 'manual_anchor', 'allowance_override', 'sms_allowance_override')} | {'included': money.allowances(db, row)}

@admin_router.put('/companies/{company_id}')
def update_account(company_id: int, payload: AccountUpdate, owner: User = Depends(require_owner), db: Session = Depends(get_db)):
    row = money.account(db, company_id)
    before = {'manual_anchor': str(row.manual_anchor), 'allowance_override': row.allowance_override, 'sms_allowance_override': row.sms_allowance_override}
    period = money.current_period(db, row)
    for channel, key in [('email', 'allowance_override'), ('sms', 'sms_allowance_override')]:
        if period and key in payload.model_fields_set and getattr(row, key) is not None and getattr(payload, key) is None:
            setattr(period, channel + '_limit', max(period.eligible_clinics * getattr(period, channel + '_per_clinic'),
                getattr(period, channel + '_used') + getattr(period, channel + '_held')))
    row.manual_anchor, row.allowance_override = payload.manual_anchor, payload.allowance_override
    if 'sms_allowance_override' in payload.model_fields_set:
        row.sms_allowance_override = payload.sms_allowance_override
    money.refresh_period(db, row)
    audit(db, company_id, owner.id, 'messaging_account', payload.reason, before, payload.model_dump(mode='json'))
    db.commit()
    return {'saved': True}


class RefundRequest(BaseModel):
    amount_minor: int = Field(gt=0)
    reason: str = Field(min_length=3, max_length=1000)

class AdjustmentRequest(BaseModel):
    amount: int
    request_key: str = Field(min_length=8, max_length=80)
    reason: str = Field(min_length=3, max_length=1000)

@admin_router.post('/topups/{topup_id}/refund')
def refund(topup_id: str, payload: RefundRequest, owner: User = Depends(require_owner), db: Session = Depends(get_db)):
    return money.refund(db, topup_id, payload.amount_minor, owner, payload.reason)

@admin_router.post('/companies/{company_id}/adjustments')
def adjustment(company_id: int, payload: AdjustmentRequest, owner: User = Depends(require_owner), db: Session = Depends(get_db)):
    row = money.account(db, company_id)
    key = f'adjustment:{company_id}:{payload.request_key}'
    previous = db.query(MessagingLedger).filter_by(key=key).first()
    if previous:
        if previous.amount != payload.amount: money.reject('request_conflict')
        return {'saved': True}
    row.balance += payload.amount
    money.entry(db, company_id, key, 'adjustment', payload.amount)
    audit(db, company_id, owner.id, 'messaging_adjustment', payload.reason, {}, {'amount': payload.amount, 'key': key})
    db.commit()
    return {'saved': True}

@admin_router.get('/companies/{company_id}/payments')
def owner_payments(company_id: int, db: Session = Depends(get_db)):
    return [topup_dict(r) for r in db.query(MessagingTopup).filter_by(company_id=company_id).order_by(MessagingTopup.created_at.desc()).limit(100)]

@admin_router.post('/topups/{topup_id}/reconcile')
def owner_reconcile(topup_id: str, db: Session = Depends(get_db)):
    return topup_dict(money.reconcile(db, topup_id))

@router.get('/usage-export')
def usage_export(clinic_id: int | None = None, start: datetime | None = None, end: datetime | None = None,
                 user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    import csv
    import io
    ids = get_allowed_clinic_ids(db, user, clinic_id)
    start, end = start or now()-timedelta(days=30), end or now()
    if start > end or (end-start).days > 366: money.reject('invalid_range', 422)
    rows = db.query(CampaignDelivery).filter(CampaignDelivery.company_id == user.company_id,
        CampaignDelivery.clinic_id.in_(ids), CampaignDelivery.created_at >= start, CampaignDelivery.created_at <= end).order_by(CampaignDelivery.created_at).limit(10001).all()
    if len(rows) > 10000: money.reject('export_range_too_large', 422)
    buffer = io.StringIO(); writer = csv.writer(buffer)
    writer.writerow(['created_at','clinic_id','campaign_id','channel','status','segments','billing_units','cost_ILS'])
    for r in rows:
        writer.writerow([r.created_at.isoformat(),r.clinic_id,r.campaign_id,r.channel,r.status,r.segments,r.billing_units,str(__import__('decimal').Decimal(r.cost if r.settled and r.status in engine.ACCEPTED else 0)/money.MICRO)])
    return {'csv': buffer.getvalue()}


@admin_router.get('/operations')
def operations(db: Session = Depends(get_db)):
    p = money.catalog(db)
    groups = db.query(CampaignDelivery.status, func.count()).group_by(CampaignDelivery.status).all()
    uncertain = db.query(CampaignDelivery).filter(CampaignDelivery.status.in_(['uncertain','sending'])).order_by(CampaignDelivery.created_at).limit(100).all()
    pending = db.query(MessagingTopup).filter(MessagingTopup.status.in_(['pending','uncertain'])).order_by(MessagingTopup.created_at).limit(100).all()
    return {'worker_heartbeat': p.worker_heartbeat, 'counts': dict(groups), 'providers': providers_status(db),
        'pending_callbacks': db.query(engine.MessagingEvent).filter_by(kind='pending').count(),
        'reserved_wallet': db.query(func.coalesce(func.sum(MessagingAccount.reserved), 0)).scalar(),
        'deliveries': [{k: getattr(r,k) for k in ('id','company_id','clinic_id','channel','status','provider','provider_id','provider_cost','error','created_at')} for r in uncertain],
        'payments': [topup_dict(r) for r in pending]}


class CompanySettings(BaseModel):
    low_balance: int = Field(ge=0, le=1_000_000_000_000)

@router.put('/settings')
def company_settings(payload: CompanySettings, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    finance_access(user)
    account = money.account(db, user.company_id)
    before = account.low_balance
    account.low_balance = payload.low_balance
    audit(db, user.company_id, user.id, 'messaging_low_balance', 'Low balance threshold', {'low_balance':before}, payload.model_dump())
    db.commit()
    return {'saved':True}

@admin_router.post('/deliveries/{delivery_id}/reconcile')
def reconcile_delivery(delivery_id: str, owner: User = Depends(require_owner), db: Session = Depends(get_db)):
    row = db.get(CampaignDelivery, delivery_id)
    if not row: money.reject('delivery_not_found',404)
    if row.status != 'uncertain' or not row.provider_id: money.reject('provider_evidence_required')
    if row.provider == 'resend':
        import httpx
        from config import settings
        try:
            response = httpx.get('https://api.resend.com/emails/' + row.provider_id,
                headers={'Authorization':'Bearer ' + (settings.CAMPAIGN_RESEND_API_KEY or settings.RESEND_API_KEY)}, timeout=20)
            response.raise_for_status()
            result=response.json()
            if result.get('id') != row.provider_id or row.destination not in result.get('to',[]): money.reject('provider_evidence_required')
            status={'sent':'submitted','delivered':'delivered','bounced':'bounced','complained':'complained','failed':'failed'}.get(result.get('last_event'))
            if not status: money.reject('reconciliation_pending')
            outcome=providers.Outcome(status,row.provider_id)
        except (httpx.HTTPError,ValueError): money.reject('reconciliation_pending',503)
    else:
        adapter=providers.sms_adapter()
        if not adapter or adapter.name != row.provider: money.reject('sms_not_configured')
        outcome=adapter.reconcile(row.provider_id)
    money.account(db,row.company_id)
    row=db.query(CampaignDelivery).filter_by(id=delivery_id).with_for_update().populate_existing().one()
    engine.apply_outcome(db,row,outcome)
    audit(db,row.company_id,owner.id,'messaging_reconcile','Verified provider response',{}, {'delivery_id':row.id,'status':row.status})
    db.commit()
    return {'status':row.status}


# Compact SMS links live at the origin root; old email/queued links remain valid.
public_router = APIRouter(tags=['messaging-unsubscribe'])
public_router.add_api_route('/s/{token}', unsubscribe_page, methods=['GET'], response_class=HTMLResponse)
public_router.add_api_route('/s/{token}', unsubscribe, methods=['POST'])


@admin_router.post('/providers/refresh')
def refresh_providers(db: Session = Depends(get_db)):
    from services.campaign_monitoring import refresh
    refresh(db)
    db.commit()
    return providers_status(db)


class ConsentUpdate(BaseModel):
    client_id: int
    channel: Literal['email', 'sms']
    granted: bool
    evidence: str = Field(min_length=3, max_length=1000)


@router.get('/consent-clients')
def consent_clients(search: str = Query(min_length=2, max_length=100), clinic_id: int | None = None,
                    user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from security.scope import client_clinic_condition
    from sqlalchemy import or_
    from services.campaign_filters import normalize
    engine.manager(user)
    ids = get_allowed_clinic_ids(db, user, clinic_id)
    pattern = '%' + search.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'
    clients = db.query(Client).filter(Client.company_id == user.company_id, Client.deleted_at.is_(None),
        Client.merged_into_client_id.is_(None), client_clinic_condition(ids), or_(
        Client.first_name.ilike(pattern, escape='\\'), Client.last_name.ilike(pattern, escape='\\'),
        Client.email.ilike(pattern, escape='\\'), Client.phone_mobile.ilike(pattern, escape='\\'))).limit(20).all()
    return [{'id': c.id, 'name': ' '.join(v for v in (c.first_name, c.last_name) if v),
        'channels': {channel: {'destination': normalize(channel, raw),
            'granted': bool((row := db.get(MessagingConsent, (user.company_id, channel, normalize(channel, raw) or ''))) and row.granted)}
            for channel, raw in [('email', c.email), ('sms', c.phone_mobile)]}} for c in clients]


@router.put('/consent')
def consent_update(payload: ConsentUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from security.scope import get_scoped_client
    from services.campaign_filters import normalize
    engine.manager(user)
    client = get_scoped_client(db, user, payload.client_id)
    if client.deleted_at: money.reject('scope_denied', 403)
    destination = normalize(payload.channel, client.email if payload.channel == 'email' else client.phone_mobile)
    if not destination: money.reject('invalid_' + payload.channel, 422)
    money.account(db, user.company_id)
    row = db.get(MessagingConsent, (user.company_id, payload.channel, destination))
    before = {'granted': bool(row and row.granted)}
    if not row:
        row = MessagingConsent(company_id=user.company_id, channel=payload.channel, destination=destination)
        db.add(row)
    row.granted, row.evidence, row.actor_id, row.recorded_at = payload.granted, payload.evidence.strip(), user.id, now()
    audit(db, user.company_id, user.id, 'messaging_consent', payload.evidence, before,
        {'client_id': client.id, 'channel': payload.channel, 'granted': payload.granted})
    db.commit()
    return {'saved': True}
