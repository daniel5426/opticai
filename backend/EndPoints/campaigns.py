"""Campaign authoring and execution use the same server authority on web and desktop."""
import json
from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
from models import Campaign, User, Clinic
from campaign_models import CampaignDetails, CampaignRun, CampaignDelivery
from security.scope import get_allowed_clinic_ids, get_scoped_campaign, normalize_clinic_id_for_company
from security.entitlements import campaign_access
from services import campaign_engine as engine, messaging_billing as money

router = APIRouter(prefix='/campaigns', tags=['campaigns'])

class CampaignWrite(BaseModel):
    clinic_id: int | None = None
    name: str = Field(min_length=1, max_length=200)
    filters: str = '[]'
    email_enabled: bool = False
    email_content: str | None = Field(default='', max_length=100000)
    sms_enabled: bool = False
    sms_content: str | None = Field(default='', max_length=3000)
    execute_once_per_client: bool = False
    subject: str = Field(default='', max_length=300)
    locale: str = 'he'
    all_clients: bool = False
    revision: int | None = None

class RunRequest(BaseModel):
    request_key: str = Field(min_length=8, max_length=80)
    quote: str
    tests: list[dict[str, str]] | None = None
    retry_run: str | None = None

class PreviewRequest(BaseModel):
    tests: list[dict[str, str]] | None = None
    retry_run: str | None = None

class ScheduleRequest(BaseModel):
    revision: int
    quote: str
    schedule: dict
    max_cost: int = Field(ge=0)


def save_draft(db, user, payload, campaign=None, commit=True):
    engine.manager(user)
    clinic_id = normalize_clinic_id_for_company(db, user, payload.clinic_id or (campaign.clinic_id if campaign else None))
    engine.campaign_delivery(db, clinic_id, user.id)
    money.account(db, user.company_id)
    parsed_filters = engine.filters.validate_filters(payload.filters)
    if payload.all_clients and parsed_filters: money.reject('invalid_filters',422)
    if payload.locale not in ('he', 'en', 'fr'): money.reject('invalid_locale', 422)
    if campaign:
        if clinic_id != campaign.clinic_id: money.reject('campaign_clinic_immutable', 422)
        d = db.query(CampaignDetails).filter_by(campaign_id=campaign.id).with_for_update().populate_existing().first() or engine.details(db, campaign)
        if payload.revision is None or payload.revision != d.revision: money.reject('quote_stale')
        if d.status == 'scheduled': money.reject('pause_before_edit')
    else:
        campaign = Campaign(clinic_id=clinic_id, active=False)
        db.add(campaign)
        # Non-null name must exist before flush.
        campaign.name = payload.name.strip()
        db.flush()
        d = engine.details(db, campaign)
    for key in ('name', 'filters', 'email_enabled', 'email_content', 'sms_enabled', 'sms_content', 'execute_once_per_client'):
        setattr(campaign, key, getattr(payload, key))
    d.subject, d.locale, d.all_clients = payload.subject.strip() or campaign.name, payload.locale, payload.all_clients
    d.revision += 1
    d.status, d.last_error, d.next_run, campaign.active = 'draft', None, None, False
    if commit: db.commit()
    else: db.flush()
    return engine.serialize(db, campaign)


@router.get('/catalog')
def catalog(user: User = Depends(get_current_user)):
    from services.ai_campaign_catalog import FILTER_FIELDS, OPERATORS
    return {'fields': FILTER_FIELDS, 'operators': OPERATORS,
        'placeholders': ['first_name', 'last_name', 'clinic_name', 'clinic_phone', 'clinic_email', 'clinic_address']}


@router.get('/')
def list_campaigns(clinic_id: int | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ids = get_allowed_clinic_ids(db, user, clinic_id)
    result = [engine.serialize(db, c) for c in db.query(Campaign).filter(Campaign.clinic_id.in_(ids)).order_by(Campaign.id.desc()).all()]
    db.commit()
    return result


@router.post('/')
def create_campaign(payload: CampaignWrite, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return save_draft(db, user, payload)


@router.get('/{campaign_id}')
def get_campaign(campaign_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    result = engine.serialize(db, get_scoped_campaign(db, user, campaign_id))
    db.commit()
    return result


@router.put('/{campaign_id}')
def update_campaign(campaign_id: int, payload: CampaignWrite, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return save_draft(db, user, payload, get_scoped_campaign(db, user, campaign_id))


@router.post('/{campaign_id}/preview')
def preview(campaign_id: int, payload: PreviewRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    result = engine.preview(db, get_scoped_campaign(db, user, campaign_id), user, payload.tests, payload.retry_run)
    db.commit()
    return result


@router.post('/{campaign_id}/runs')
def run(campaign_id: int, payload: RunRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = engine.create_run(db, get_scoped_campaign(db, user, campaign_id), user, payload.request_key, payload.quote, payload.tests, retry_run=payload.retry_run)
    return engine.run_summary(db, row)


@router.get('/{campaign_id}/runs')
def runs(campaign_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    get_scoped_campaign(db, user, campaign_id)
    return [engine.run_summary(db, r) for r in db.query(CampaignRun).filter_by(campaign_id=campaign_id).order_by(CampaignRun.created_at.desc()).limit(100)]


@router.get('/{campaign_id}/runs/{run_id}/deliveries')
def deliveries(campaign_id: int, run_id: str, offset: int = Query(0, ge=0), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    get_scoped_campaign(db, user, campaign_id)
    query = db.query(CampaignDelivery).filter_by(campaign_id=campaign_id, run_id=run_id)
    return {'total': query.count(), 'items': [{k: getattr(d, k) for k in ('id', 'channel', 'destination', 'status', 'error', 'cost', 'segments', 'attempts')}
        for d in query.order_by(CampaignDelivery.id).offset(offset).limit(50)]}


def cancel_pending(db, campaign_id, run_id=None):
    query = db.query(CampaignDelivery).filter_by(campaign_id=campaign_id, status='queued')
    if run_id: query = query.filter_by(run_id=run_id)
    for delivery in query.with_for_update().all():
        delivery.status = 'cancelled'
        money.settle_delivery(db, delivery, False)
        engine.finish_run(db, delivery.run_id)


@router.post('/{campaign_id}/runs/{run_id}/cancel')
def cancel(campaign_id: int, run_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    engine.manager(user)
    get_scoped_campaign(db, user, campaign_id)
    money.account(db, user.company_id)
    cancel_pending(db, campaign_id, run_id)
    db.commit()
    return {'cancelled': True}


@router.post('/{campaign_id}/pause')
def pause(campaign_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    engine.manager(user)
    c = get_scoped_campaign(db, user, campaign_id)
    money.account(db, user.company_id)
    d = engine.details(db, c)
    d.status, d.next_run, c.active = 'paused', None, False
    d.revision += 1
    cancel_pending(db, campaign_id)
    db.commit()
    return engine.serialize(db, c)


@router.post('/{campaign_id}/schedule')
def schedule(campaign_id: int, payload: ScheduleRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    engine.manager(user)
    c = get_scoped_campaign(db, user, campaign_id)
    engine.campaign_delivery(db, c.clinic_id, user.id)
    acct = money.account(db, user.company_id)
    d = engine.details(db, c)
    # Verify the same expiring audience/price quote without creating a run.
    preview = engine.estimate(db, c, d, acct)
    from jose import jwt, JWTError
    from config import settings
    try:
        claims = jwt.decode(payload.quote, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if claims.get('purpose') != 'campaign-quote' or claims.get('campaign') != c.id or claims.get('company') != user.company_id or claims.get('user') != user.id or claims.get('fingerprint') != preview['fingerprint'] or claims.get('tests') is not None:
            raise ValueError()
    except (JWTError, ValueError): money.reject('quote_stale')
    if payload.revision != d.revision: money.reject('quote_stale')
    if preview['errors']: money.reject(preview['errors'][0])
    if payload.max_cost < preview['total_cost']: money.reject('budget_below_quote', 422)
    next_run = engine.next_occurrence(payload.schedule, engine.now())
    if not next_run: money.reject('invalid_schedule', 422)
    d.schedule, d.next_run, d.max_cost = payload.schedule, next_run, payload.max_cost
    d.status, d.approved_catalog, d.actor_id = 'scheduled', preview['catalog_revision'], user.id
    d.last_error, c.active = None, True
    d.revision += 1
    db.commit()
    return engine.serialize(db, c)


@router.delete('/{campaign_id}')
def archive(campaign_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    engine.manager(user)
    c = get_scoped_campaign(db, user, campaign_id)
    money.account(db, user.company_id)
    d = engine.details(db, c)
    d.status, d.next_run, c.active = 'archived', None, False
    d.revision += 1
    cancel_pending(db, campaign_id)
    db.commit()
    return {'archived': True}


@router.get('/{campaign_id}/client-execution/{client_id}')
def legacy_execution(campaign_id: int, client_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from models import CampaignClientExecution
    from security.scope import get_scoped_client
    get_scoped_campaign(db, user, campaign_id)
    get_scoped_client(db, user, client_id)
    return {'executed': db.query(CampaignClientExecution.id).filter_by(campaign_id=campaign_id, client_id=client_id, status='success').first() is not None or db.query(CampaignDelivery.id).filter_by(campaign_id=campaign_id, client_id=client_id).filter(CampaignDelivery.status.in_(engine.ACCEPTED)).first() is not None}


@router.post('/{campaign_id}/execute')
@router.post('/{campaign_id}/deliver-email/{client_id}')
@router.post('/{campaign_id}/client-execution/{client_id}')
@router.delete('/{campaign_id}/client-executions')
def retired(campaign_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    get_scoped_campaign(db, user, campaign_id)
    raise HTTPException(409, detail={'code': 'campaign_upgrade_required'})
