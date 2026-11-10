"""Authenticated, self-owned Calendar connection, status, preferences and resync."""
from datetime import datetime
import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from zoneinfo import ZoneInfo
from sqlalchemy.orm import Session
from auth import get_current_user, encrypt_secret
from config import settings
from database import get_db
from models import Appointment, GoogleCalendarSync, User
from services.google_calendar import CALENDAR_SCOPE, enqueue, now

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
    appointments = db.query(Appointment).filter(Appointment.user_id == user.id,
        Appointment.company_id == user.company_id, Appointment.date >= datetime.now(ZoneInfo('Asia/Jerusalem')).date()).order_by(Appointment.id).all()
    for appointment in appointments:
        enqueue(db, appointment, force=True)
    return len(appointments)


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
    # Switching accounts is explicit and leaves the old account's events intact.
    # A new account never receives another account's event identifiers.
    if not same_account:
        from services.google_calendar import event_id
        for row in db.query(GoogleCalendarSync).filter_by(user_id=user.id).all():
            row.generation += 1
            row.event_id = event_id(row.appointment_id, user.id, row.generation)
            row.account_email = info['email']
            row.status = 'paused'
        db.query(Appointment).filter_by(user_id=user.id, company_id=user.company_id).update({'google_calendar_event_id': None}, synchronize_session='fetch')
    from datetime import timedelta
    user.google_account_connected = True
    user.google_account_email = info['email']
    user.google_access_token = encrypt_secret(payload.access_token)
    if payload.refresh_token:
        user.google_refresh_token = encrypt_secret(payload.refresh_token)
    user.google_oauth_client_type = kinds[audience]
    user.google_token_expiry = now() + timedelta(seconds=int(data.get('expires_in', 3600)))
    # Reconnect resumes pending work, including removals, before bulk upserts.
    for row in db.query(GoogleCalendarSync).filter_by(user_id=user.id, status='reconnect').all():
        row.status, row.attempts, row.available_at, row.error_code = 'pending', 0, now(), None
    if user.google_calendar_sync_enabled:
        queue_upcoming(db, user)
    db.commit()
    return status_for(db, user)


@router.post('/disconnect')
def disconnect(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    user.google_account_connected = False
    user.google_calendar_sync_enabled = False
    user.google_access_token = user.google_refresh_token = user.google_token_expiry = user.google_oauth_client_type = None
    # Keep account identity/mappings for safe reconnect; no provider writes.
    db.query(GoogleCalendarSync).filter_by(user_id=user.id, status='pending').update({'status': 'reconnect'}, synchronize_session='fetch')
    db.commit()
    return status_for(db, user)


@router.post('/preferences')
def preferences(payload: Preferences, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if payload.enabled and not user.google_account_connected:
        raise HTTPException(409, 'googleCalendar.reconnect')
    user.google_calendar_sync_enabled = payload.enabled
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
