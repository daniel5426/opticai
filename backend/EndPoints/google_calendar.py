"""Authenticated, self-owned Calendar connection, status, preferences and resync."""
from datetime import datetime
import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, and_
from zoneinfo import ZoneInfo
from sqlalchemy.orm import Session
from auth import get_current_user, encrypt_secret
from config import settings
from database import get_db
from models import Appointment, GoogleCalendarSync, User
from services.google_calendar import CALENDAR_SCOPE, enqueue, now, token_key_id, eligible

router = APIRouter(prefix='/google/calendar', tags=['Google Calendar'])


class Connection(BaseModel):
    access_token: str = Field(min_length=1, max_length=4096)
    refresh_token: str | None = Field(default=None, max_length=4096)


class Preferences(BaseModel):
    enabled: bool


def status_for(db, user):
    counts = dict(db.query(GoogleCalendarSync.status, func.count(GoogleCalendarSync.id)).filter_by(user_id=user.id).group_by(GoogleCalendarSync.status).all())
    return {'connected': bool(user.google_account_connected), 'email': user.google_account_email,
        'enabled': bool(user.google_calendar_sync_enabled), 'pending': counts.get('pending', 0),
        'failed': counts.get('failed', 0), 'reconnect': counts.get('reconnect', 0)}


def queue_upcoming(db, user):
    # No historical bulk export. Existing event mappings are retained in place.
    mapped = db.query(GoogleCalendarSync.appointment_id).filter_by(user_id=user.id).filter(GoogleCalendarSync.status != 'deleted')
    selected = [Appointment.user_id == user.id]
    if user.role_level >= 4:
        for clinic_id, route in (user.google_calendar_routes or {}).items():
            if route.get('all_workers'):
                selected.append(and_(Appointment.clinic_id == int(clinic_id), Appointment.user_id.is_not(None)))
            elif route.get('workers'):
                selected.append(and_(Appointment.clinic_id == int(clinic_id), Appointment.user_id.in_(route['workers'])))
    appointments = db.query(Appointment).execution_options(include_deleted=True).filter(
        Appointment.company_id == user.company_id, or_(Appointment.id.in_(mapped),
        and_(or_(*selected), Appointment.date >= datetime.now(ZoneInfo('Asia/Jerusalem')).date()))).order_by(Appointment.id).all()
    existing = {v[0] for v in mapped.all()}
    count = 0
    for appointment in appointments:
        if eligible(user, appointment) or appointment.id in existing:
            enqueue(db, appointment, force=True, receiver_id=user.id)
            count += 1
    return count


@router.get('/status')
def status(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return status_for(db, user)


@router.post('/connect')
def connect(payload: Connection, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        response = requests.get('https://oauth2.googleapis.com/tokeninfo', params={'access_token': payload.access_token}, timeout=10)
        data = response.json() if response.ok else {}
        audience = data.get('aud') or data.get('issued_to')
        kinds = {settings.GOOGLE_WEB_CLIENT_ID: 'web', settings.GOOGLE_DESKTOP_CLIENT_ID: 'desktop'}
        if not audience or audience not in kinds or CALENDAR_SCOPE not in data.get('scope', '').split():
            raise HTTPException(400, 'googleCalendar.permission')
        profile = requests.get('https://www.googleapis.com/oauth2/v2/userinfo', headers={'Authorization': 'Bearer ' + payload.access_token}, timeout=10)
        info = profile.json() if profile.ok else {}
        if not info.get('email') or info.get('verified_email') is not True:
            raise HTTPException(400, 'googleCalendar.permission')
    except (requests.RequestException, ValueError):
        raise HTTPException(502, 'googleCalendar.failed')
    user = db.query(User).filter_by(id=user.id).with_for_update().one()
    same_account = user.google_account_email == info['email']
    if not payload.refresh_token and (not same_account or not user.google_refresh_token or user.google_oauth_client_type not in (None, kinds[audience])):
        raise HTTPException(400, 'googleCalendar.reconnect')
    from datetime import timedelta
    user.google_account_connected = True
    user.google_account_email = info['email']
    user.google_access_token = encrypt_secret(payload.access_token)
    if payload.refresh_token:
        user.google_refresh_token = encrypt_secret(payload.refresh_token)
    user.google_token_key_id = token_key_id()
    user.google_oauth_client_type = kinds[audience]
    user.google_token_expiry = now() + timedelta(seconds=int(data.get('expires_in', 3600)))
    # Release the credential row before taking appointment/mapping locks. The
    # worker takes those locks before refreshing the owner, so holding both in
    # reverse order here would deadlock reconnect against an in-flight sync.
    db.commit()
    # Switching accounts is explicit and leaves the old account's events intact.
    # A new account never receives another account's event identifiers.
    if not same_account:
        user.google_calendar_routes = None
        from services.google_calendar import event_id
        for row in db.query(GoogleCalendarSync).filter_by(user_id=user.id).all():
            row.generation += 1
            row.event_id = event_id(row.appointment_id, user.id, row.generation)
            row.account_email = info['email']
            row.status = 'paused'
            row.retired_events = []
            row.calendar_id = 'primary'
        db.query(Appointment).filter_by(user_id=user.id, company_id=user.company_id).update({'google_calendar_event_id': None}, synchronize_session='fetch')
    if user.google_calendar_sync_enabled:
        queue_upcoming(db, user)
    for row in db.query(GoogleCalendarSync).filter_by(user_id=user.id, status='reconnect').all():
        row.status, row.attempts, row.available_at, row.error_code = 'pending', 0, now(), None
    db.commit()
    return status_for(db, user)


@router.post('/disconnect')
def disconnect(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    user.google_account_connected = False
    user.google_calendar_sync_enabled = False
    user.google_access_token = user.google_refresh_token = user.google_token_expiry = user.google_oauth_client_type = None
    db.commit()
    # Keep account identity/mappings for safe reconnect; no provider writes.
    db.query(GoogleCalendarSync).filter_by(user_id=user.id, status='pending').update({'status': 'reconnect'}, synchronize_session='fetch')
    db.commit()
    return status_for(db, user)


@router.post('/preferences')
def preferences(payload: Preferences, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if payload.enabled and not user.google_account_connected:
        raise HTTPException(409, 'googleCalendar.reconnect')
    user.google_calendar_sync_enabled = payload.enabled
    db.commit()
    if payload.enabled:
        queue_upcoming(db, user)
    else:
        db.query(GoogleCalendarSync).filter_by(user_id=user.id, action='upsert', status='pending').update({'status': 'paused'}, synchronize_session='fetch')
    db.commit()
    return status_for(db, user)


@router.post('/sync')
def sync(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not user.google_account_connected:
        raise HTTPException(409, 'googleCalendar.reconnect')
    count = queue_upcoming(db, user)
    for row in db.query(GoogleCalendarSync).filter_by(user_id=user.id, action='delete').filter(GoogleCalendarSync.status.in_(['failed', 'reconnect'])).all():
        row.status, row.attempts, row.available_at = 'pending', 0, now()
    db.commit()
    return {**status_for(db, user), 'queued': count}


class ClinicRoute(BaseModel):
    clinic_id: int = Field(gt=0)
    calendar_id: str = Field(default='primary', min_length=1, max_length=1024)
    all_workers: bool = False
    workers: list[int] = Field(default_factory=list, max_length=500)


def routing_clinics(db, user):
    from models import Clinic
    query = db.query(Clinic).filter_by(company_id=user.company_id, is_active=True)
    if user.role_level < 4:
        query = query.filter(or_(Clinic.id == user.clinic_id, Clinic.id.in_(
            db.query(Appointment.clinic_id).filter_by(user_id=user.id, company_id=user.company_id))))
    return query.order_by(Clinic.id).all()


def list_calendars(user):
    from services.google_calendar import calendar_request, CalendarError
    result, token = [], None
    try:
        while True:
            params = {'minAccessRole': 'writer', 'maxResults': 250}
            if token:
                params['pageToken'] = token
            response = calendar_request(user, 'GET', 'https://www.googleapis.com/calendar/v3/users/me/calendarList', params=params)
            if not response.ok:
                raise CalendarError('calendar_unavailable', retry=False)
            data = response.json()
            result.extend({'id': v['id'], 'name': v.get('summary', v['id']), 'primary': bool(v.get('primary'))}
                          for v in data.get('items', []) if v.get('accessRole') in ('owner', 'writer'))
            token = data.get('nextPageToken')
            if not token:
                return result
    except (CalendarError, requests.RequestException, ValueError):
        raise HTTPException(502, 'googleCalendar.calendarUnavailable')


@router.get('/routing')
def routing(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    clinics = routing_clinics(db, user)
    ids = {c.id for c in clinics}
    workers = db.query(User).filter(User.company_id == user.company_id, User.is_active.is_(True)).order_by(User.id).all() if user.role_level >= 4 else []
    return {'clinics': [{'id': c.id, 'name': c.name} for c in clinics],
        'workers': [{'id': w.id, 'name': w.full_name or w.username, 'clinic_id': w.clinic_id} for w in workers],
        'can_include_workers': user.role_level >= 4,
        'routes': {k: v for k, v in (user.google_calendar_routes or {}).items() if int(k) in ids}}


@router.get('/calendars')
def calendars(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    values = list_calendars(user)
    db.commit()  # Persist any successful access-token refresh.
    return values


@router.put('/routing')
def save_route(payload: ClinicRoute, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not user.google_account_connected:
        raise HTTPException(409, 'googleCalendar.reconnect')
    if payload.clinic_id not in {c.id for c in routing_clinics(db, user)}:
        raise HTTPException(403, 'googleCalendar.routeDenied')
    if (payload.all_workers or payload.workers) and user.role_level < 4:
        raise HTTPException(403, 'googleCalendar.routeDenied')
    if payload.workers:
        valid = {w.id for w in db.query(User).filter(User.company_id == user.company_id, User.is_active.is_(True), User.id.in_(payload.workers)).all()}
        if set(payload.workers) != valid:
            raise HTTPException(403, 'googleCalendar.routeDenied')
    if payload.calendar_id != 'primary' and payload.calendar_id not in {v['id'] for v in list_calendars(user)}:
        raise HTTPException(400, 'googleCalendar.calendarUnavailable')
    user.google_calendar_routes = {**(user.google_calendar_routes or {}), str(payload.clinic_id): payload.model_dump(exclude={'clinic_id'})}
    db.commit()
    queue_upcoming(db, user)
    db.commit()
    return routing(db, user)


class CreateCalendar(BaseModel):
    clinic_id: int = Field(gt=0)


@router.post('/calendars')
def create_calendar(payload: CreateCalendar, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from services.google_calendar import calendar_request, CalendarError
    if not user.google_account_connected:
        raise HTTPException(409, 'googleCalendar.reconnect')
    clinic = next((c for c in routing_clinics(db, user) if c.id == payload.clinic_id), None)
    if not clinic:
        raise HTTPException(403, 'googleCalendar.routeDenied')
    user = db.query(User).filter_by(id=user.id).with_for_update().one()
    route = (user.google_calendar_routes or {}).get(str(clinic.id), {})
    if route.get('creation_pending'):
        raise HTTPException(409, 'googleCalendar.creationUncertain')
    user.google_calendar_routes = {**(user.google_calendar_routes or {}), str(clinic.id): {**route, 'creation_pending': True}}
    db.commit()  # An uncertain insert must never be retried automatically.
    try:
        response = calendar_request(user, 'POST', 'https://www.googleapis.com/calendar/v3/calendars', json={
            'summary': 'Prysm — ' + clinic.name, 'timeZone': 'Asia/Jerusalem',
            'description': f'Prysm clinic {clinic.id}'})
        if not response.ok or not response.json().get('id'):
            raise CalendarError('calendar_unavailable')
        calendar_id = response.json()['id']
    except (CalendarError, requests.RequestException, ValueError):
        db.commit()
        raise HTTPException(502, 'googleCalendar.creationUncertain')
    user.google_calendar_routes = {**(user.google_calendar_routes or {}), str(clinic.id): {**route, 'calendar_id': calendar_id}}
    db.commit()
    queue_upcoming(db, user)
    db.commit()
    return routing(db, user)
