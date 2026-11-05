"""Signup verification against disposable databases; email delivery is intercepted."""
import importlib.util
import re
from datetime import datetime, timedelta
from pathlib import Path

import httpx
import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from auth import new_secret_token, token_hash, utcnow
from database import Base, get_db
from EndPoints import web_auth
from models import AuthActionToken, PendingCompanySetup


@pytest.fixture()
def signup(monkeypatch):
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False)
    mail = []
    monkeypatch.setattr(web_auth, 'send_email', lambda **kwargs: mail.append(kwargs) or True)
    values = iter(range(123456, 123556))
    monkeypatch.setattr(web_auth.secrets, 'randbelow', lambda _: next(values))
    app = FastAPI()
    app.include_router(web_auth.router, prefix='/api/v1')

    def get_test_db():
        with sessions() as db:
            yield db
    app.dependency_overrides[get_db] = get_test_db
    with TestClient(app) as client:
        yield client, sessions, mail
    engine.dispose()


def start(client, email='owner@example.test', **extra):
    return client.post('/api/v1/auth/web/register/start', json={
        'email': email, 'password': 'test-password', 'full_name': 'Test Owner', 'plan_code': 'growth', 'verification_method': 'code', **extra,
    })


def code(mail):
    return re.search(r'>([0-9]{6})</p>', mail[-1]['html']).group(1)


def verify(client, setup, value):
    return client.post('/api/v1/auth/web/verify-email', json={'setup_token': setup, 'code': value})


def allow_resend(sessions):
    with sessions() as db:
        for action in db.query(AuthActionToken).all():
            action.created_at = utcnow() - timedelta(seconds=61)
        db.commit()


@pytest.mark.parametrize('language', ['he', 'en', 'fr'])
def test_signup_sends_localized_code_without_a_link(signup, language):
    client, sessions, mail = signup
    response = start(client, language=language)
    assert response.status_code == 200, response.text
    state = response.json()
    assert state['status'] == 'verification_required'
    assert state['verification']['method'] == 'code'
    assert state['verification']['attempts_remaining'] == 5
    assert datetime.fromisoformat(state['verification']['expires_at']).utcoffset() == timedelta(0)
    assert 'href=' not in mail[-1]['html']
    assert f'lang="{language}"' in mail[-1]['html']
    assert f'dir="{"rtl" if language == "he" else "ltr"}"' in mail[-1]['html']
    assert code(mail) not in response.text
    with sessions() as db:
        action = db.query(AuthActionToken).one()
        pending = db.query(PendingCompanySetup).one()
        assert action.token_hash != token_hash(code(mail))
        assert action.token_hash != code(mail)
        assert pending.password_hash != 'test-password'
        assert pending.email_verified_at is None
    refreshed = client.get('/api/v1/auth/web/onboarding', params={'setup_token': state['setup_token']})
    assert refreshed.json()['verification'] == state['verification']


def test_code_verifies_once_rotates_setup_and_unlocks_onboarding(signup):
    client, sessions, mail = signup
    setup = start(client).json()['setup_token']
    blocked = client.put('/api/v1/auth/web/onboarding', json={'setup_token': setup, 'wizard_state': 'company'})
    assert blocked.status_code == 403
    response = verify(client, setup, code(mail))
    assert response.status_code == 200, response.text
    state = response.json()
    assert state['status'] == 'onboarding_required'
    assert state['wizard_state'] == 'company'
    assert state['setup_token'] != setup
    assert verify(client, setup, code(mail)).status_code == 401
    assert verify(client, state['setup_token'], code(mail)).status_code == 400
    assert client.put('/api/v1/auth/web/onboarding', json={
        'setup_token': state['setup_token'], 'wizard_state': 'clinic', 'company': {'name': 'Test Company'},
    }).status_code == 200
    with sessions() as db:
        assert db.query(AuthActionToken).one().consumed_at is not None
        assert db.query(PendingCompanySetup).one().email_verified_at is not None


def test_wrong_attempts_persist_across_requests_and_lock_the_code(signup):
    client, sessions, mail = signup
    setup = start(client).json()['setup_token']
    for index in range(5):
        response = verify(client, setup, '999999')
        assert response.status_code == 400
        assert response.json()['detail']['attempts_remaining'] == 4 - index
    assert response.json()['detail']['code'] == 'verification_attempts_exhausted'
    assert verify(client, setup, code(mail)).status_code == 400
    with sessions() as db:
        assert db.query(AuthActionToken).one().failed_attempts == 5
        assert db.query(PendingCompanySetup).one().email_verified_at is None
    state = client.get('/api/v1/auth/web/onboarding', params={'setup_token': setup}).json()
    assert state['verification']['attempts_remaining'] == 0


def test_resend_cooldown_is_enforced_on_registration_and_resend(signup):
    client, sessions, mail = signup
    setup = start(client).json()['setup_token']
    for response in [start(client), client.post('/api/v1/auth/web/register/resend', json={'setup_token': setup})]:
        assert response.status_code == 429, response.text
        assert response.json()['detail']['code'] == 'verification_cooldown'
        assert 1 <= int(response.headers['retry-after']) <= 60
    assert len(mail) == 1
    assert verify(client, setup, code(mail)).status_code == 200


def test_resend_replaces_code_and_resets_attempt_budget(signup):
    client, sessions, mail = signup
    setup = start(client).json()['setup_token']
    old = code(mail)
    verify(client, setup, '999999')
    allow_resend(sessions)
    response = client.post('/api/v1/auth/web/register/resend', json={'setup_token': setup, 'language': 'fr'})
    assert response.status_code == 200, response.text
    assert response.json()['verification']['attempts_remaining'] == 5
    assert len(mail) == 2
    assert code(mail) != old
    assert verify(client, setup, old).status_code == 400
    assert verify(client, setup, code(mail)).status_code == 200


def test_expired_code_cannot_verify(signup):
    client, sessions, mail = signup
    setup = start(client).json()['setup_token']
    with sessions() as db:
        db.query(AuthActionToken).one().expires_at = utcnow() - timedelta(seconds=1)
        db.commit()
    assert verify(client, setup, code(mail)).status_code == 400


def test_code_requires_its_own_signup_session(signup):
    client, _, mail = signup
    start(client)
    first = code(mail)
    other = start(client, email='other@example.test').json()['setup_token']
    assert verify(client, other, first).status_code == 400
    assert client.post('/api/v1/auth/web/verify-email', json={'code': code(mail)}).status_code == 422
    assert client.post('/api/v1/auth/web/verify-email', json={'token': code(mail)}).status_code == 422
    assert verify(client, other, code(mail)).status_code == 200


def test_reregistering_requires_fresh_email_proof_and_clears_previous_drafts(signup):
    client, sessions, mail = signup
    setup = start(client).json()['setup_token']
    state = verify(client, setup, code(mail)).json()
    with sessions() as db:
        db.query(PendingCompanySetup).one().company_payload = {'name': 'Private draft'}
        db.commit()
    allow_resend(sessions)
    replacement = start(client, password='replacement-password').json()
    assert replacement['status'] == 'verification_required'
    assert replacement['company'] is None
    assert client.get('/api/v1/auth/web/onboarding', params={'setup_token': state['setup_token']}).status_code == 401
    assert client.put('/api/v1/auth/web/onboarding', json={
        'setup_token': replacement['setup_token'], 'wizard_state': 'clinic',
    }).status_code == 403


@pytest.mark.parametrize('failure', ['missing_key', 'timeout'])
def test_delivery_failure_does_not_claim_success_or_persist_signup(signup, monkeypatch, failure):
    client, sessions, _ = signup
    def fail(**kwargs):
        if failure == 'timeout':
            raise httpx.ReadTimeout('simulated provider timeout')
        return False
    monkeypatch.setattr(web_auth, 'send_email', fail)
    response = start(client)
    assert response.status_code == 503
    assert response.json()['detail']['code'] == 'email_delivery_unavailable'
    with sessions() as db:
        assert db.query(PendingCompanySetup).count() == 0
        assert db.query(AuthActionToken).count() == 0


def test_failed_resend_preserves_previous_code(signup, monkeypatch):
    client, sessions, mail = signup
    setup = start(client).json()['setup_token']
    previous = code(mail)
    allow_resend(sessions)
    monkeypatch.setattr(web_auth, 'send_email', lambda **kwargs: False)
    assert client.post('/api/v1/auth/web/register/resend', json={'setup_token': setup}).status_code == 503
    assert verify(client, setup, previous).status_code == 200


@pytest.mark.parametrize('resend', [False, True])
def test_existing_links_work_until_consumed_or_replaced(signup, resend):
    client, sessions, mail = signup
    setup = new_secret_token()
    with sessions() as db:
        pending = PendingCompanySetup(id='legacy-setup', email='legacy@example.test', setup_token_hash=token_hash(setup), expires_at=utcnow() + timedelta(days=1))
        db.add(pending)
        db.flush()
        link = web_auth._issue_action_token(db, 'verify_email', pending_id=pending.id, hours=24)
        db.commit()
    if resend:
        allow_resend(sessions)
        assert client.post('/api/v1/auth/web/register/resend', json={'setup_token': setup, 'verification_method': 'code'}).status_code == 200
    response = client.post('/api/v1/auth/web/verify-email', json={'token': link})
    assert response.status_code == (400 if resend else 200)
    if resend:
        assert verify(client, setup, code(mail)).status_code == 200
    else:
        assert client.post('/api/v1/auth/web/verify-email', json={'token': link}).status_code == 400


def test_attempt_counter_migration_preserves_existing_links():
    path = Path(__file__).parents[1] / 'alembic/versions/0055_email_verification_codes.py'
    spec = importlib.util.spec_from_file_location('verification_migration', path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = create_engine('sqlite://')
    with engine.begin() as connection:
        connection.execute(text('CREATE TABLE auth_action_tokens (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL)'))
        connection.execute(text("INSERT INTO auth_action_tokens VALUES ('existing', 'retained-hash')"))
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
        assert connection.execute(text('SELECT id, token_hash, failed_attempts FROM auth_action_tokens')).one() == ('existing', 'retained-hash', 0)
        with Operations.context(MigrationContext.configure(connection)):
            migration.downgrade()
        assert connection.execute(text('SELECT id, token_hash FROM auth_action_tokens')).one() == ('existing', 'retained-hash')
    engine.dispose()


def test_old_signup_frontend_still_receives_a_verification_link(signup):
    from urllib.parse import parse_qs, urlparse
    import html
    client, sessions, mail = signup
    response = client.post('/api/v1/auth/web/register/start', json={
        'email': 'old-client@example.test', 'password': 'test-password', 'full_name': 'Old Client', 'plan_code': 'growth',
    })
    assert response.status_code == 200
    assert response.json()['verification']['method'] == 'link'
    setup = response.json()['setup_token']
    allow_resend(sessions)
    assert client.post('/api/v1/auth/web/register/resend', json={'setup_token': setup}).json()['verification']['method'] == 'link'
    url = html.unescape(re.search(r'href="([^"]+)"', mail[-1]['html']).group(1))
    token = parse_qs(urlparse(url).query)['token'][0]
    assert client.post('/api/v1/auth/web/verify-email', json={'token': token}).status_code == 200


def test_leading_zero_codes_are_accepted(signup, monkeypatch):
    client, _, mail = signup
    monkeypatch.setattr(web_auth.secrets, 'randbelow', lambda _: 7)
    setup = start(client).json()['setup_token']
    assert code(mail) == '000007'
    assert verify(client, setup, code(mail)).status_code == 200


def test_verification_state_accepts_a_private_header_without_a_secret_in_the_url(signup):
    client, _, _ = signup
    setup = start(client).json()['setup_token']
    response = client.get('/api/v1/auth/web/onboarding', headers={'X-Prysm-Setup-Token': setup})
    assert response.status_code == 200
    assert response.json()['verification']['method'] == 'code'
    assert client.get('/api/v1/auth/web/onboarding').status_code == 401
