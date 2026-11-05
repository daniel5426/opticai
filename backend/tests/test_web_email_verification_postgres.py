"""Real locking and migration checks on a newly created local PostgreSQL cluster."""
import importlib.util
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from pathlib import Path
from threading import Barrier

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import event, text
from sqlalchemy.orm import sessionmaker

from auth import token_hash, utcnow
from database import Base, get_db
from EndPoints import web_auth
from models import AuthActionToken, PendingCompanySetup
from backend.tests.test_company_record_migration import pg_engine


@pytest.fixture(scope='module', autouse=True)
def schema(pg_engine):
    def use_non_utc_timezone(connection, _):
        previous = connection.autocommit
        connection.autocommit = True
        with connection.cursor() as cursor:
            cursor.execute("SET TIME ZONE 'Pacific/Auckland'")
        connection.autocommit = previous
    event.listen(pg_engine, 'connect', use_non_utc_timezone)
    Base.metadata.create_all(pg_engine)


@pytest.fixture()
def signup(pg_engine, monkeypatch):
    sessions = sessionmaker(bind=pg_engine, autoflush=False)
    mail = []
    monkeypatch.setattr(web_auth, 'send_email', lambda **kwargs: mail.append(kwargs) or True)
    app = FastAPI()
    app.include_router(web_auth.router, prefix='/api/v1')
    def local_db():
        with sessions() as db:
            yield db
    app.dependency_overrides[get_db] = local_db
    with TestClient(app) as client:
        yield client, sessions, mail


def parallel(count, operation):
    barrier = Barrier(count)
    def run(_):
        barrier.wait(timeout=10)
        return operation()
    with ThreadPoolExecutor(max_workers=count) as executor:
        return list(executor.map(run, range(count)))


def start(client, email):
    return client.post('/api/v1/auth/web/register/start', json={
        'email': email, 'password': 'test-password', 'full_name': 'Test Owner', 'plan_code': 'growth', 'verification_method': 'code',
    })


def test_migration_preserves_an_existing_link_on_postgres(pg_engine):
    path = Path(__file__).parents[1] / 'alembic/versions/0055_email_verification_codes.py'
    spec = importlib.util.spec_from_file_location('verification_pg_migration', path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    with pg_engine.begin() as connection:
        connection.execute(text('ALTER TABLE auth_action_tokens DROP COLUMN failed_attempts'))
        connection.execute(text("INSERT INTO auth_action_tokens(id,token_hash,purpose,expires_at) VALUES ('existing-link','retained-hash','verify_email',now()+interval '1 day')"))
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
        assert connection.execute(text("SELECT token_hash, failed_attempts FROM auth_action_tokens WHERE id='existing-link'")).one() == ('retained-hash', 0)


def test_simultaneous_first_registration_sends_one_email(signup):
    client, _, mail = signup
    responses = parallel(2, lambda: start(client, 'concurrent-register@example.test'))
    assert sorted(r.status_code for r in responses) == [200, 429]
    assert len(mail) == 1


def test_simultaneous_correct_verification_can_only_succeed_once(signup):
    client, sessions, _ = signup
    setup = start(client, 'concurrent-verify@example.test').json()['setup_token']
    with sessions() as db:
        pending = db.query(PendingCompanySetup).filter_by(setup_token_hash=token_hash(setup)).one()
        action = db.query(AuthActionToken).filter_by(pending_setup_id=pending.id).one()
        action.token_hash = web_auth._code_hash(pending, '123456', action.id)
        db.commit()
    responses = parallel(2, lambda: client.post('/api/v1/auth/web/verify-email', json={'setup_token': setup, 'code': '123456'}))
    assert sorted(r.status_code for r in responses) == [200, 401]


def test_parallel_wrong_codes_cannot_exceed_attempt_budget(signup):
    client, sessions, _ = signup
    setup = start(client, 'concurrent-wrong@example.test').json()['setup_token']
    with sessions() as db:
        pending = db.query(PendingCompanySetup).filter_by(setup_token_hash=token_hash(setup)).one()
        pending_id = pending.id
        action = db.query(AuthActionToken).filter_by(pending_setup_id=pending_id).one()
        action.token_hash = web_auth._code_hash(pending, '123456', action.id)
        db.commit()
    responses = parallel(8, lambda: client.post('/api/v1/auth/web/verify-email', json={'setup_token': setup, 'code': '999999'}))
    assert all(r.status_code == 400 for r in responses)
    with sessions() as db:
        assert db.query(AuthActionToken).filter_by(pending_setup_id=pending_id).one().failed_attempts == 5
        assert db.get(PendingCompanySetup, pending_id).email_verified_at is None


def test_simultaneous_resends_issue_only_one_new_code(signup):
    client, sessions, mail = signup
    setup = start(client, 'concurrent-resend@example.test').json()['setup_token']
    with sessions() as db:
        pending = db.query(PendingCompanySetup).filter_by(setup_token_hash=token_hash(setup)).one()
        db.query(AuthActionToken).filter_by(pending_setup_id=pending.id).one().created_at = utcnow() - timedelta(seconds=61)
        db.commit()
    responses = parallel(2, lambda: client.post('/api/v1/auth/web/register/resend', json={'setup_token': setup}))
    assert sorted(r.status_code for r in responses) == [200, 429]
    assert len(mail) == 2


def test_code_expiry_uses_utc_in_a_non_utc_database_session(signup, monkeypatch):
    client, sessions, _ = signup
    setup = start(client, 'timezone-expiry@example.test').json()['setup_token']
    with sessions() as db:
        pending = db.query(PendingCompanySetup).filter_by(setup_token_hash=token_hash(setup)).one()
        action = db.query(AuthActionToken).filter_by(pending_setup_id=pending.id).one()
        action.token_hash = web_auth._code_hash(pending, '123456', action.id)
        db.commit()
    future = utcnow() + timedelta(minutes=11)
    monkeypatch.setattr(web_auth, 'utcnow', lambda: future)
    response = client.post('/api/v1/auth/web/verify-email', json={'setup_token': setup, 'code': '123456'})
    assert response.status_code == 400
