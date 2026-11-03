"""Reconcile a shared appointment using its assigned owner's credentials only."""
import hashlib
import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import requests
from auth import decrypt_secret
from models import User, Client, Clinic

logger = logging.getLogger(__name__)
BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'


def headers(owner):
    if not owner or not owner.google_account_connected or not owner.google_calendar_sync_enabled or not owner.google_access_token:
        return None
    return {'Authorization': 'Bearer ' + decrypt_secret(owner.google_access_token), 'Content-Type': 'application/json'}


def synchronize_for_actor(db, appointment, actor, previous_owner_id=None, previous_event_id=None):
    owner_changed = previous_owner_id is not None and previous_owner_id != appointment.user_id
    if owner_changed:
        previous = db.get(User, previous_owner_id)
        if previous_owner_id != actor.id and previous and previous.company_id == appointment.company_id:
            authorization = headers(previous)
            if authorization and previous_event_id:
                response = requests.delete(f'{BASE}/{previous_event_id}', headers=authorization, timeout=15)
                if response.status_code not in (200, 204, 404, 410):
                    raise RuntimeError('Previous owner calendar reconciliation failed')
        appointment.google_calendar_event_id = None
        db.commit()
    # Existing self-owned synchronization remains compatible with desktop clients.
    appointment.calendar_sync_owned = bool(appointment.user_id and appointment.user_id != actor.id)
    if not appointment.calendar_sync_owned:
        return
    owner = db.get(User, appointment.user_id)
    authorization = headers(owner)
    if not owner or owner.company_id != appointment.company_id or not authorization or not appointment.date or not appointment.time:
        return
    client = db.get(Client, appointment.client_id)
    clinic = db.get(Clinic, appointment.clinic_id)
    starts = datetime.combine(appointment.date, datetime.strptime(appointment.time, '%H:%M').time()).replace(tzinfo=ZoneInfo('Asia/Jerusalem'))
    event_id = appointment.google_calendar_event_id or hashlib.sha256(f'prysm:{appointment.id}:{owner.id}'.encode()).hexdigest()
    payload = {'summary': ' — '.join(value for value in ((client.first_name or '') + ' ' + (client.last_name or ''), appointment.exam_name) if value),
        'description': appointment.note or '', 'location': clinic.name if clinic else '',
        'start': {'dateTime': starts.isoformat(), 'timeZone': 'Asia/Jerusalem'},
        'end': {'dateTime': (starts + timedelta(minutes=appointment.duration or 30)).isoformat(), 'timeZone': 'Asia/Jerusalem'},
        'extendedProperties': {'private': {'prysmAppointmentId': str(appointment.id)}}}
    response = requests.put(f'{BASE}/{event_id}', headers=authorization, json=payload, timeout=15)
    if response.status_code in (404, 410):
        response = requests.post(BASE, headers=authorization, json={**payload, 'id': event_id}, timeout=15)
        if response.status_code == 409:
            response = requests.put(f'{BASE}/{event_id}', headers=authorization, json=payload, timeout=15)
    if response.status_code not in (200, 201):
        raise RuntimeError('Assigned owner calendar reconciliation failed')
    appointment.google_calendar_event_id = response.json().get('id', event_id)
    db.commit()


def reconcile(db, appointment, actor, previous_owner_id=None, previous_event_id=None):
    # A provider failure must not undo a successfully saved appointment or use
    # another staff member's calendar as a fallback.
    appointment.calendar_sync_owned = bool(appointment.user_id and appointment.user_id != actor.id)
    try:
        synchronize_for_actor(db, appointment, actor, previous_owner_id, previous_event_id)
    except Exception:
        db.rollback()
        logger.warning('Assigned calendar reconciliation failed for appointment %s', appointment.id)
