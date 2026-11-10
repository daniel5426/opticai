"""Synthetic API/consumer qualification. Never call a provider or a clinic DB."""
from datetime import date, timedelta
from types import SimpleNamespace as NS
from unittest.mock import Mock
import pytest
import requests
from fastapi import FastAPI
from fastapi.testclient import TestClient
from auth import encrypt_secret, decrypt_secret, get_current_user
from database import get_db
from models import Appointment, GoogleCalendarSync, User
from services import google_calendar as calendar
from EndPoints import google_calendar as endpoints, appointments
from backend.tests.test_company_client_records import scope


def response(code=200, data=None):
    return NS(status_code=code, ok=200 <= code < 300, json=lambda: data or {})


@pytest.fixture
def setup(scope, monkeypatch):
    s = scope
    s.user.google_account_connected = True
    s.user.google_calendar_sync_enabled = True
    s.user.google_access_token = encrypt_secret('access-marker')
    s.user.google_refresh_token = encrypt_secret('refresh-marker')
    s.user.google_account_email = 'synthetic@example.com'
    s.db.commit()
    for kind in ('WEB', 'DESKTOP'):
        monkeypatch.setattr(calendar.settings, f'GOOGLE_{kind}_CLIENT_ID', kind.lower() + '-client')
        monkeypatch.setattr(calendar.settings, f'GOOGLE_{kind}_CLIENT_SECRET', 'secret-marker')
    s.network = Mock(return_value=response())
    monkeypatch.setattr(calendar.requests, 'request', s.network)
    monkeypatch.setattr(calendar.requests, 'post', Mock(side_effect=AssertionError('Unexpected token refresh')))
    app = FastAPI()
    app.include_router(endpoints.router)
    app.include_router(appointments.router)
    app.dependency_overrides[get_db] = lambda: s.db
    app.dependency_overrides[get_current_user] = lambda: s.user
    s.http = TestClient(app)
    return s


def appointment(s, **kwargs):
    row = Appointment(company_id=s.user.company_id, clinic_id=s.a.id, client_id=s.client.id,
        user_id=s.user.id, date=date.today() + timedelta(days=1), time='10:00', duration=30, **kwargs)
    s.db.add(row); s.db.flush()
    return row


def queued(s, **kwargs):
    appt = appointment(s, **kwargs)
    calendar.enqueue(s.db, appt); s.db.commit()
    return appt, s.db.query(GoogleCalendarSync).filter_by(appointment_id=appt.id).one()


def test_own_appointment_api_commits_queue_without_provider_calls(setup):
    s = setup
    r = s.http.post('/appointments/', json={'client_id':s.client.id,'clinic_id':s.b.id,'user_id':s.user.id,'date':str(date.today()+timedelta(days=1)),'time':'10:00'})
    assert r.status_code == 200, r.text
    assert r.json()['calendar_sync_owned'] is True
    assert s.db.query(GoogleCalendarSync).count() == 1
    s.network.assert_not_called()
    calendar.run_once(s.db)
    assert s.db.get(Appointment, r.json()['id']).google_calendar_event_id


def test_repeated_bulk_sync_updates_same_id_and_keeps_legacy_mapping(setup):
    s = setup
    appt, job = queued(s, google_calendar_event_id='legacy-event')
    for _ in range(2):
        result = s.http.post('/google/calendar/sync')
        assert result.status_code == 200
        assert calendar.run_once(s.db)
    assert appt.google_calendar_event_id == job.event_id == 'legacy-event'
    assert [c.args[0] for c in s.network.call_args_list] == ['PUT', 'PUT']
    assert all(c.kwargs['params']['sendUpdates'] == 'none' for c in s.network.call_args_list)
    assert 'attendees' not in s.network.call_args.kwargs['json']


def test_timeout_after_insert_retries_same_deterministic_id(setup):
    s = setup
    appt, job = queued(s)
    original = job.event_id
    s.network.side_effect = [response(404), requests.Timeout(), response(200)]
    calendar.run_once(s.db)
    assert job.status == 'pending' and job.error_code == 'provider_unavailable'
    assert not appt.google_calendar_event_id
    job.available_at = calendar.now(); s.db.commit()
    calendar.run_once(s.db)
    assert job.status == 'synced' and appt.google_calendar_event_id == original
    assert s.network.call_args_list[1].kwargs['json']['id'] == original
    assert s.network.call_args_list[2].args[1].endswith(original)


def test_only_confirmed_missing_event_is_created(setup):
    s = setup
    _, job = queued(s)
    s.network.side_effect = [response(500)]
    calendar.run_once(s.db)
    assert s.network.call_count == 1 and job.status == 'pending'
    job.available_at = calendar.now(); s.db.commit()
    s.network.side_effect = [response(404), response(409), response(200)]
    calendar.run_once(s.db)
    assert job.status == 'synced'


@pytest.mark.parametrize('legacy', [False, True])
def test_refreshes_expired_or_401_access_and_remembers_client(setup, monkeypatch, legacy):
    s = setup
    _, job = queued(s)
    s.user.google_token_expiry = None if legacy else calendar.now() - timedelta(minutes=1)
    s.user.google_oauth_client_type = None if legacy else 'desktop'
    s.network.side_effect = [response(401), response(200)] if legacy else [response(200)]
    post = Mock(side_effect=[response(400, {'error':'invalid_grant'}),response(200,{'access_token':'fresh-marker','expires_in':3600})] if legacy else [response(200,{'access_token':'fresh-marker','expires_in':3600})])
    monkeypatch.setattr(calendar.requests, 'post', post)
    calendar.run_once(s.db)
    assert job.status == 'synced'
    assert s.user.google_oauth_client_type == 'desktop'
    assert decrypt_secret(s.user.google_access_token) == 'fresh-marker'
    assert s.network.call_args.kwargs['headers']['Authorization'] == 'Bearer fresh-marker'
    assert post.call_args.kwargs['data']['client_id'] == 'desktop-client'


def test_revoked_token_is_visible_and_not_retried_forever(setup, monkeypatch):
    s = setup
    _, job = queued(s)
    s.network.return_value = response(401)
    monkeypatch.setattr(calendar.requests, 'post', Mock(return_value=response(400,{'error':'invalid_grant'})))
    calendar.run_once(s.db)
    assert job.status == 'reconnect'
    assert s.http.get('/google/calendar/status').json()['reconnect'] == 1
    assert calendar.run_once(s.db) is False


def test_reassignment_removes_old_owner_event_using_only_old_owner_token(setup):
    s = setup
    appt, old = queued(s, google_calendar_event_id='old-event')
    other = User(company_id=s.user.company_id, clinic_id=s.a.id, username='other-examiner',
        google_account_connected=True,google_calendar_sync_enabled=True,google_account_email='other@example.com',google_access_token=encrypt_secret('other-marker'))
    s.db.add(other);s.db.flush()
    appt.user_id = other.id
    calendar.enqueue(s.db, appt, s.user.id, 'old-event');s.db.commit()
    assert calendar.run_once(s.db)
    assert calendar.run_once(s.db)
    assert s.network.call_args_list[0].args[0] == 'DELETE'
    assert s.network.call_args_list[0].kwargs['headers']['Authorization'] == 'Bearer access-marker'
    assert s.network.call_args_list[1].kwargs['headers']['Authorization'] == 'Bearer other-marker'
    assert old.status == 'deleted'


def test_delete_before_first_sync_never_creates_event_then_restore_rotates_id(setup):
    s = setup
    appt, job = queued(s)
    original = job.event_id
    appt.deleted_at = calendar.now(); calendar.enqueue(s.db, appt); s.db.commit()
    s.network.return_value = response(404)
    calendar.run_once(s.db)
    assert s.network.call_args.args[0] == 'DELETE' and job.status == 'deleted'
    appt.deleted_at = None; calendar.enqueue(s.db, appt); s.db.commit()
    assert job.event_id != original
    s.network.return_value = response(200)
    calendar.run_once(s.db)
    assert job.status == 'synced' and appt.google_calendar_event_id == job.event_id


@pytest.mark.parametrize('day,offset,end_day', [('2026-01-10','+02:00','2026-01-11'),('2026-07-10','+03:00','2026-07-11')])
def test_payload_uses_jerusalem_dst_and_midnight(setup, day, offset, end_day):
    s = setup
    appt = appointment(s);appt.date = date.fromisoformat(day);appt.time='23:50'
    body = calendar.payload(s.db,appt)
    assert body['start']['dateTime'].endswith(offset)
    assert body['end']['dateTime'] == f'{end_day}T00:20:00{offset}'
    assert body['location'] == s.a.name and body['visibility'] == 'private'


def test_disconnect_preserves_mapping_and_pauses_writes(setup):
    s = setup
    appt, job = queued(s, google_calendar_event_id='keep-event')
    result = s.http.post('/google/calendar/disconnect')
    assert result.status_code == 200 and not result.json()['enabled']
    assert appt.google_calendar_event_id == 'keep-event' and job.status == 'reconnect'
    assert not s.user.google_access_token and not s.user.google_refresh_token
    assert calendar.run_once(s.db) is False
    assert s.http.post('/google/calendar/sync').status_code == 409


def mock_connection(monkeypatch, email='synthetic@example.com', audience='web-client', scope=calendar.CALENDAR_SCOPE):
    monkeypatch.setattr(endpoints.requests, 'get', Mock(side_effect=[response(200, {'aud':audience,'scope':scope,'expires_in':3600}),response(200, {'email':email,'verified_email':True})]))


def test_reconnect_resumes_pending_jobs_and_preserves_same_account_ids(setup, monkeypatch):
    s = setup
    appt, job = queued(s, google_calendar_event_id='keep-event')
    s.http.post('/google/calendar/disconnect')
    mock_connection(monkeypatch)
    r = s.http.post('/google/calendar/connect', json={'access_token':'new-marker','refresh_token':'new-refresh-marker'})
    assert r.status_code == 200, r.text
    assert job.event_id == appt.google_calendar_event_id == 'keep-event'
    assert job.status == 'pending'


def test_different_google_account_cannot_use_old_event_ids(setup, monkeypatch):
    s = setup
    appt, job = queued(s, google_calendar_event_id='old-account-event')
    mock_connection(monkeypatch, email='new-account@example.com')
    r = s.http.post('/google/calendar/connect', json={'access_token':'new-marker','refresh_token':'new-refresh'})
    assert r.status_code == 200, r.text
    assert job.event_id != 'old-account-event'
    calendar.run_once(s.db)
    assert all('old-account-event' not in c.args[1] for c in s.network.call_args_list)


@pytest.mark.parametrize('audience,granted_scope', [('foreign-client', calendar.CALENDAR_SCOPE),('web-client','openid email')])
def test_connect_rejects_wrong_audience_or_missing_calendar_permission(setup, monkeypatch, audience, granted_scope):
    s = setup
    mock_connection(monkeypatch,audience=audience,scope=granted_scope)
    assert s.http.post('/google/calendar/connect',json={'access_token':'marker','refresh_token':'refresh'}).status_code == 400


def test_another_company_owner_never_receives_an_event(setup):
    s = setup
    foreign = User(company_id=s.c.company_id,clinic_id=s.c.id,username='foreign',google_account_connected=True,google_calendar_sync_enabled=True)
    s.db.add(foreign);s.db.flush()
    appt = appointment(s);appt.user_id=foreign.id
    from fastapi import HTTPException
    with pytest.raises(HTTPException):
        calendar.enqueue(s.db, appt)
    s.db.rollback()
    assert s.db.query(GoogleCalendarSync).count() == 0
    assert calendar.run_once(s.db) is False


def test_queue_rolls_back_with_appointment(setup):
    s = setup
    queued(s)  # existing unrelated mapping survives
    appt = appointment(s);calendar.enqueue(s.db, appt);s.db.rollback()
    assert s.db.query(GoogleCalendarSync).count() == 1


def test_manual_sync_does_not_export_history(setup):
    s = setup
    appt=appointment(s);appt.date=date.today()-timedelta(days=1);s.db.commit()
    r=s.http.post('/google/calendar/sync')
    assert r.json()['queued']==0
    assert s.db.query(GoogleCalendarSync).count()==0
