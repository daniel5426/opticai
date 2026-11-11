"""Apply timed edits to already mapped Google events."""
from datetime import datetime, timedelta, timezone
from urllib.parse import quote
from zoneinfo import ZoneInfo

import requests
from fastapi import HTTPException
from sqlalchemy import func, or_

from models import Appointment, Client, Clinic, GoogleCalendarSync, User
from services.appointment_schedule import find_conflict
from services.google_calendar import CalendarError, calendar_request, enqueue, events_url, now, route_for, eligible, token_key_id
from services.subscription_service import enforce_workspace

CLINIC_TIME = ZoneInfo('Asia/Jerusalem')
POLL_INTERVAL = timedelta(minutes=1)
CURSOR_OVERLAP = timedelta(seconds=15)
MAX_LOOKBACK = timedelta(days=30)
POLL_LEASE = timedelta(minutes=10)
REJECTED_EDITS = ('google_schedule_conflict', 'google_schedule_invalid')


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value and value.tzinfo is None else value


def timestamp(value):
    if not isinstance(value, str):
        raise ValueError('Google timestamp must be a string')
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('Google timestamp must include its offset')
    return parsed.astimezone(timezone.utc)


def schedule(event):
    if event.get('recurrence') or event.get('recurringEventId') or event.get('eventType', 'default') != 'default':
        return None
    try:
        start = timestamp(event['start']['dateTime'])
        end = timestamp(event['end']['dateTime'])
    except (KeyError, TypeError, ValueError, AttributeError):
        return None
    local_start = start.astimezone(CLINIC_TIME)
    local_end = end.astimezone(CLINIC_TIME)
    seconds = (end - start).total_seconds()
    if (not 0 < seconds <= 24 * 3600 or seconds % 60 or local_start.second or local_start.microsecond
            or (local_end.date() != local_start.date() and local_end.time() != datetime.min.time())
            or local_start.utcoffset() != local_end.utcoffset()
            or local_start.utcoffset() != local_start.replace(fold=1-local_start.fold).utcoffset()):
        return None
    return local_start.date(), local_start.strftime('%H:%M'), int(seconds // 60)


def ready_users(db):
    return db.query(User).filter(
        User.is_active.is_(True), User.google_account_connected.is_(True),
        User.google_calendar_sync_enabled.is_(True), User.google_calendar_pull_at.is_not(None),
        User.google_token_key_id == token_key_id(),
    )


def current_owner(db, user_id, lease):
    return ready_users(db).filter_by(id=user_id, google_calendar_pull_at=lease).populate_existing().with_for_update().first()


def mapped(db, user_id):
    return db.query(GoogleCalendarSync).join(Appointment).join(User, User.id == GoogleCalendarSync.user_id).filter(
        GoogleCalendarSync.user_id == user_id, GoogleCalendarSync.status == 'synced',
        GoogleCalendarSync.action == 'upsert', GoogleCalendarSync.account_email == User.google_account_email,
        Appointment.company_id == User.company_id, Appointment.deleted_at.is_(None),
    )


def apply_edit(db, user_id, lease, calendar_id, candidate, event, since):
    mapping_id, event_id, previous_etag, appointment_id, clinic_id = candidate
    # Calendar writes also take the clinic lock before the appointment lock when
    # checking availability. Keep that order, then lock the mapping and owner.
    clinic = db.query(Clinic).filter_by(id=clinic_id, is_active=True, maintenance_mode=False).with_for_update().first()
    appointment = db.query(Appointment).filter_by(id=appointment_id, clinic_id=clinic_id).populate_existing().with_for_update().first()
    row = db.query(GoogleCalendarSync).filter_by(id=mapping_id, user_id=user_id, calendar_id=calendar_id, event_id=event_id,
        appointment_id=appointment_id, status='synced', action='upsert').populate_existing().with_for_update().first()
    owner = current_owner(db, user_id, lease)
    if (not clinic or not appointment or not row or not owner or row.remote_etag != previous_etag
            or appointment.company_id != clinic.company_id
            or row.account_email != owner.google_account_email or not eligible(owner, appointment)
            or (owner.role_level < 4 and owner.clinic_id != clinic_id)
            or route_for(owner, clinic_id).get('calendar_id', 'primary') != calendar_id):
        return
    examiner = db.query(User.id).filter_by(id=appointment.user_id, company_id=clinic.company_id, is_active=True).first()
    if not examiner or appointment.date is None:
        return
    etag = event.get('etag')
    if event.get('id') != row.event_id or event.get('status') == 'cancelled' or not etag or etag == row.remote_etag:
        return
    updated = timestamp(event['updated'])
    if updated < since or (not row.remote_etag and row.synced_at and updated <= utc(row.synced_at)):
        return
    row.remote_etag = etag
    target = schedule(event)
    if target is None:
        row.error_code = 'google_schedule_invalid'
        return
    if target != (appointment.date, str(appointment.time)[:5], appointment.duration or 30):
        try:
            enforce_workspace(db, appointment.company_id, write=True)
        except HTTPException:
            raise CalendarError('workspace_unavailable') from None
        day, at, duration = target
        if find_conflict(db, clinic_id, appointment.user_id, day, at, duration, exclude=appointment.id):
            row.error_code = 'google_schedule_conflict'
            return
        appointment.date, appointment.time, appointment.duration = target
        clinic.google_calendar_revision += 1
        client = db.query(Client).filter_by(id=appointment.client_id, company_id=appointment.company_id).first()
        if client:
            client.client_updated_date = func.now()
            client.ai_appointment_state = None
        # Other connected calendars need the new time. The source already has it.
        enqueue(db, appointment, skip_receiver_id=user_id)
    row.error_code = None


def read_event(db, user_id, lease, calendar_id, event_id, etag):
    owner = current_owner(db, user_id, lease)
    if not owner:
        db.rollback()
        return None
    headers = {'If-None-Match': etag} if etag else {}
    response = calendar_request(owner, 'GET', f'{events_url(calendar_id)}/{quote(event_id, safe="")}', headers=headers,
        params={'fields': 'id,status,etag,updated,start,end,recurrence,recurringEventId,eventType'})
    db.commit()
    if response.status_code in (304, 404, 410):
        return None
    if not response.ok:
        raise CalendarError('provider_rejected')
    return response.json()


def scan_calendar(db, user_id, lease, calendar_id, since):
    params = {'updatedMin': since.isoformat(), 'fields': 'items(id,etag,status),nextPageToken', 'maxResults': 2500}
    for _ in range(20):
        owner = current_owner(db, user_id, lease)
        if not owner:
            return
        response = calendar_request(owner, 'GET', events_url(calendar_id), params=params)
        if not response.ok:
            raise CalendarError('calendar_unavailable')
        page = response.json()
        db.commit()  # Release the credential lock before taking clinic locks.
        changes = {event['id']: event['etag'] for event in page.get('items', [])
            if event.get('id') and event.get('etag') and event.get('status') != 'cancelled'}
        if changes:
            candidates = mapped(db, user_id).filter(
                GoogleCalendarSync.calendar_id == calendar_id, GoogleCalendarSync.event_id.in_(changes)).with_entities(
                GoogleCalendarSync.id, GoogleCalendarSync.event_id, GoogleCalendarSync.remote_etag,
                Appointment.id, Appointment.clinic_id).all()
            for candidate in candidates:
                _, event_id, etag, _, clinic_id = candidate
                if changes[event_id] == etag or clinic_id is None:
                    continue
                event = read_event(db, user_id, lease, calendar_id, event_id, etag)
                if event:
                    apply_edit(db, user_id, lease, calendar_id, candidate, event, since)
                    db.commit()
        if not page.get('nextPageToken'):
            return
        params['pageToken'] = page['nextPageToken']
    raise CalendarError('too_many_changes')


def run_pull_once(db):
    started = now()
    owner = ready_users(db).filter(User.google_calendar_pull_at <= started).order_by(
        User.google_calendar_pull_at, User.id).with_for_update(skip_locked=True).first()
    if not owner:
        db.rollback()
        return False
    user_id = owner.id
    since = max(utc(owner.google_calendar_pull_since) or started, started - MAX_LOOKBACK)
    lease = started + POLL_LEASE
    owner.google_calendar_pull_at = lease
    db.commit()
    destinations = mapped(db, user_id).with_entities(
        GoogleCalendarSync.calendar_id).distinct().all()
    error = None
    for (calendar_id,) in destinations:
        try:
            scan_calendar(db, user_id, lease, calendar_id, since)
        except (CalendarError, requests.RequestException, KeyError, TypeError, ValueError) as failure:
            db.rollback()
            error = 'reconnect' if isinstance(failure, CalendarError) and failure.reconnect else error or 'failed'
            if error == 'reconnect':
                break
    owner = current_owner(db, user_id, lease)
    if owner:
        owner.google_calendar_pull_error = error
        delay = timedelta(minutes=15 if error == 'reconnect' else 5) if error else POLL_INTERVAL
        owner.google_calendar_pull_at = now() + delay
        if not error:
            owner.google_calendar_pull_since = max(since, started - CURSOR_OVERLAP)
    db.commit()
    return True
