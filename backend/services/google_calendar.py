"""Calendar writes belong to the API, with durable, repeat-safe owner mappings."""
import hashlib
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import requests
from auth import decrypt_secret, encrypt_secret
from config import settings
from models import Appointment, Client, Clinic, GoogleCalendarSync, User

BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar'


def now():
    return datetime.now(timezone.utc)


class CalendarError(Exception):
    def __init__(self, code, reconnect=False, retry=True):
        self.code, self.reconnect, self.retry = code, reconnect, retry
        super().__init__(code)


def credentials(kind):
    prefix = 'GOOGLE_DESKTOP' if kind == 'desktop' else 'GOOGLE_WEB'
    client_id = getattr(settings, prefix + '_CLIENT_ID')
    secret = getattr(settings, prefix + '_CLIENT_SECRET')
    return {'client_id': client_id, 'client_secret': secret} if client_id and secret else None


def refresh(owner):
    token = decrypt_secret(owner.google_refresh_token)
    if not token:
        raise CalendarError('reconnect', reconnect=True)
    # Pre-rollout tokens have no provenance. Try only this project's configured
    # clients, then remember the successful audience. Never discard old secrets.
    kinds = [owner.google_oauth_client_type] if owner.google_oauth_client_type else ['web', 'desktop']
    configured = False
    for kind in kinds:
        config = credentials(kind)
        if not config:
            continue
        configured = True
        response = requests.post('https://oauth2.googleapis.com/token', data={**config,
            'grant_type': 'refresh_token', 'refresh_token': token}, timeout=10)
        if response.ok:
            data = response.json()
            if not data.get('access_token'):
                raise CalendarError('provider_unavailable')
            owner.google_access_token = encrypt_secret(data['access_token'])
            if data.get('refresh_token'):
                owner.google_refresh_token = encrypt_secret(data['refresh_token'])
            owner.google_oauth_client_type = kind
            owner.google_token_expiry = now() + timedelta(seconds=int(data.get('expires_in', 3600)))
            return data['access_token']
        error = response.json().get('error', '')
        if response.status_code == 429 or response.status_code >= 500:
            raise CalendarError('provider_unavailable')
        if error not in ('invalid_grant', 'invalid_client', 'unauthorized_client'):
            raise CalendarError('provider_rejected', retry=False)
    if not configured:
        raise CalendarError('not_configured', retry=False)
    raise CalendarError('reconnect', reconnect=True)


def calendar_request(owner, method, url, **kwargs):
    if not owner or not owner.is_active or not owner.google_account_connected:
        raise CalendarError('reconnect', reconnect=True)
    expiry = owner.google_token_expiry
    if expiry and expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    token = decrypt_secret(owner.google_access_token)
    # Legacy tokens remain usable until Google rejects them; their real expiry
    # must not be invented. Known expired tokens refresh before the API call.
    if not token or expiry and expiry <= now() + timedelta(seconds=60):
        token = refresh(owner)
    def send(access):
        return requests.request(method, url, headers={'Authorization': 'Bearer ' + access},
            params={'sendUpdates': 'none'}, timeout=15, **kwargs)
    response = send(token)
    if response.status_code == 401:
        response = send(refresh(owner))
    if response.status_code == 401:
        raise CalendarError('reconnect', reconnect=True)
    if response.status_code == 403:
        reasons = [e.get('reason') for e in response.json().get('error', {}).get('errors', [])]
        if set(reasons) & {'rateLimitExceeded', 'userRateLimitExceeded', 'quotaExceeded'}:
            raise CalendarError('provider_unavailable')
        raise CalendarError('permission', reconnect=True)
    if response.status_code == 429 or response.status_code >= 500:
        raise CalendarError('provider_unavailable')
    return response


def event_id(appointment_id, owner_id, generation):
    return hashlib.sha256(f'prysm:{appointment_id}:{owner_id}:{generation}'.encode()).hexdigest()


def enqueue(db, appointment, previous_owner_id=None, previous_event_id=None, *, force=False):
    """Caller commits queue intent atomically with the appointment mutation."""
    db.flush()
    # Serialize the mapping lookup, including first creation, on its parent row.
    db.query(Appointment).filter_by(id=appointment.id).with_for_update().execution_options(include_deleted=True).first()
    owners = {value for value in (appointment.user_id, previous_owner_id) if value}
    for owner_id in owners:
        owner = db.get(User, owner_id)
        if not owner or owner.company_id != appointment.company_id:
            continue
        row = db.query(GoogleCalendarSync).filter_by(appointment_id=appointment.id, user_id=owner_id).with_for_update().first()
        deleting = bool(appointment.deleted_at or owner_id != appointment.user_id)
        legacy_id = previous_event_id if owner_id == previous_owner_id else appointment.google_calendar_event_id
        if not row:
            if not legacy_id and (deleting or not owner.google_account_connected or not (force or owner.google_calendar_sync_enabled)):
                continue
            row = GoogleCalendarSync(appointment_id=appointment.id, user_id=owner_id,
                account_email=owner.google_account_email, event_id=legacy_id or event_id(appointment.id, owner_id, 0), generation=0)
            db.add(row)
        if not deleting and not force and not owner.google_calendar_sync_enabled:
            continue
        if row.status == 'deleted' and not deleting:
            row.generation += 1
            row.event_id = event_id(appointment.id, owner_id, row.generation)
        row.action = 'delete' if deleting else 'upsert'
        row.status, row.attempts, row.available_at, row.error_code = 'pending', 0, now(), None
    if previous_owner_id and previous_owner_id != appointment.user_id:
        appointment.google_calendar_event_id = None
    appointment.calendar_sync_owned = True


def payload(db, appointment):
    start = datetime.combine(appointment.date, datetime.strptime(str(appointment.time)[:5], '%H:%M').time()).replace(tzinfo=ZoneInfo('Asia/Jerusalem'))
    client = db.get(Client, appointment.client_id)
    clinic = db.get(Clinic, appointment.clinic_id)
    name = ' '.join(filter(None, (client.first_name, client.last_name))) if client else ''
    return {'summary': ' — '.join(filter(None, (name, appointment.exam_name))) or 'Prysm',
        'description': appointment.note or '', 'location': clinic.name if clinic else '',
        'start': {'dateTime': start.isoformat(), 'timeZone': 'Asia/Jerusalem'},
        'end': {'dateTime': (start + timedelta(minutes=appointment.duration or 30)).isoformat(), 'timeZone': 'Asia/Jerusalem'},
        'extendedProperties': {'private': {'prysmAppointmentId': str(appointment.id)}},
        'visibility': 'private'}


def process(db, row):
    appointment = db.query(Appointment).filter_by(id=row.appointment_id).execution_options(include_deleted=True).with_for_update().first()
    owner = db.query(User).filter_by(id=row.user_id).with_for_update().first()
    if not appointment or not owner or appointment.company_id != owner.company_id:
        raise CalendarError('scope', retry=False)
    if row.account_email and row.account_email != owner.google_account_email:
        # Never apply an old account's event IDs to a newly connected account.
        raise CalendarError('account_changed', retry=False)
    deleting = row.action == 'delete' or appointment.deleted_at or appointment.user_id != owner.id
    if deleting:
        response = calendar_request(owner, 'DELETE', f'{BASE}/{row.event_id}')
        if response.status_code not in (200, 204, 404, 410):
            raise CalendarError('provider_rejected', retry=False)
        row.status = 'deleted'
        if appointment.user_id == owner.id and appointment.google_calendar_event_id == row.event_id:
            appointment.google_calendar_event_id = None
    else:
        if not appointment.date or not appointment.time:
            raise CalendarError('invalid_appointment', retry=False)
        body = payload(db, appointment)
        response = calendar_request(owner, 'PUT', f'{BASE}/{row.event_id}', json=body)
        if response.status_code in (404, 410):
            # A deleted event ID cannot be reused. Only rotate after a confirmed
            # tombstone; uncertain inserts always retry the SAME deterministic ID.
            if response.status_code == 410:
                row.generation += 1
                row.event_id = event_id(appointment.id, owner.id, row.generation)
            response = calendar_request(owner, 'POST', BASE, json={**body, 'id': row.event_id})
            if response.status_code == 409:
                response = calendar_request(owner, 'PUT', f'{BASE}/{row.event_id}', json=body)
        if response.status_code not in (200, 201):
            raise CalendarError('provider_rejected', retry=False)
        appointment.google_calendar_event_id = row.event_id
        row.account_email = owner.google_account_email
        row.status = 'synced'
    row.synced_at, row.error_code = now(), None


def run_once(db):
    # Parent then mapping then user locks: same order as enqueues and concurrent
    # mutations. One network operation group per transaction, skip busy records.
    parent = db.query(Appointment).join(GoogleCalendarSync, GoogleCalendarSync.appointment_id == Appointment.id).filter(
        GoogleCalendarSync.status == 'pending', GoogleCalendarSync.available_at <= now()).order_by(
        GoogleCalendarSync.available_at, GoogleCalendarSync.id).execution_options(include_deleted=True).with_for_update(
        of=Appointment, skip_locked=True).first()
    if not parent:
        db.rollback()
        return False
    row = db.query(GoogleCalendarSync).filter_by(appointment_id=parent.id, status='pending').filter(
        GoogleCalendarSync.available_at <= now()).order_by(GoogleCalendarSync.id).with_for_update(skip_locked=True).first()
    if not row:
        db.rollback()
        return False
    row.attempts += 1
    try:
        process(db, row)
    except (CalendarError, requests.RequestException, ValueError) as error:
        if not isinstance(error, CalendarError):
            error = CalendarError('provider_unavailable')
        row.error_code = error.code
        row.status = 'reconnect' if error.reconnect else ('pending' if error.retry and row.attempts < 10 else 'failed')
        row.available_at = now() + timedelta(seconds=min(3600, 15 * 2 ** min(row.attempts, 8)))
    db.commit()
    return True
