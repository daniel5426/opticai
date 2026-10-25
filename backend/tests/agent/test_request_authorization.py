"""Joined authorization keeps the canonical policy and performs no read-path writes."""
import asyncio
from datetime import timedelta
from types import SimpleNamespace
import pytest
from fastapi import HTTPException
from sqlalchemy import event
from auth import issue_access_token
from models import AuthSession, User, Clinic
from agent.authority import resolve_request
from agent.config import now


def request(db, auth, **headers):
    session = db.query(AuthSession).first()
    token = issue_access_token(session, db.get(User, auth.user.id))
    return SimpleNamespace(headers={'authorization': f'Bearer {token}', 'x-prysm-clinic-id': str(auth.clinic_id), **headers})


def test_established_scope_has_two_selects_and_no_write(clinic):
    db, auth, _, sessions = clinic
    req = request(db, auth)
    queries = []
    engine = db.get_bind()
    def record(conn, cursor, statement, *args):
        queries.append(statement.split()[0].upper())
    event.listen(engine, 'before_cursor_execute', record)
    try:
        with sessions() as fresh:
            result = resolve_request(fresh, req)
            assert result.clinic_id == auth.clinic_id
        assert queries == ['SELECT', 'SELECT']
    finally:
        event.remove(engine, 'before_cursor_execute', record)


@pytest.mark.parametrize('case,status', [('revoked', 401), ('expired', 401), ('inactive', 401),
    ('company', 403), ('foreign_clinic', 403), ('maintenance', 423), ('foreign_patient', 403), ('deleted_patient', 404)])
def test_joined_authorization_preserves_current_policy(clinic, case, status):
    db, auth, patients, sessions = clinic
    headers = {}
    req = request(db, auth)
    session = db.query(AuthSession).first()
    if case == 'revoked': session.revoked_at = now()
    if case == 'expired': session.expires_at = now() - timedelta(seconds=1)
    if case == 'inactive': auth.user.is_active = False
    if case == 'company': session.company_id += 100
    if case == 'foreign_clinic': headers['x-prysm-clinic-id'] = str(patients[-1].clinic_id)
    if case == 'maintenance': db.get(Clinic, auth.clinic_id).maintenance_mode = True
    if case == 'foreign_patient': headers['x-prysm-client-id'] = str(patients[-1].id)
    if case == 'deleted_patient':
        patients[0].deleted_at = now()
        headers['x-prysm-client-id'] = str(patients[0].id)
    db.commit()
    req.headers.update(headers)
    with sessions() as fresh, pytest.raises(HTTPException) as failure:
        resolve_request(fresh, req)
    assert failure.value.status_code == status


def test_new_patient_context_can_be_read_by_a_new_session(clinic):
    db, auth, patients, sessions = clinic
    req = request(db, auth, **{'x-prysm-client-id': str(patients[0].id)})
    with sessions() as first:
        created = resolve_request(first, req).context_id
    with sessions() as second:
        assert resolve_request(second, req).context_id == created


@pytest.mark.asyncio
async def test_slow_database_authorization_does_not_block_async_loop(monkeypatch):
    import threading
    from agent import runtime
    started, release = threading.Event(), threading.Event()
    def slow(request):
        started.set()
        release.wait(2)
        return runtime.PrincipalScope('1:1', 'context', 'clinic:1:patient:0', 'bound')
    monkeypatch.setattr(runtime, 'load_principal_scope', slow)
    task = asyncio.create_task(runtime.resolve_bff_principal(object()))
    try:
        for _ in range(100):
            if started.is_set(): break
            await asyncio.sleep(.001)
        assert started.is_set()
        assert not task.done()
        await asyncio.wait_for(asyncio.sleep(.001), timeout=.1)
    finally:
        release.set()
    await task


def test_concurrent_first_context_creation_has_one_owner(clinic, tmp_path):
    from concurrent.futures import ThreadPoolExecutor
    import sqlite3
    import threading
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    db, auth, patients, _ = clinic
    req = request(db, auth, **{'x-prysm-client-id': str(patients[0].id)})
    path = str(tmp_path / 'authorization-race.sqlite')
    with sqlite3.connect(path) as target:
        db.connection().connection.driver_connection.backup(target)
    engine = create_engine('sqlite:///' + path, connect_args={'check_same_thread': False, 'timeout': 10})
    sessions = sessionmaker(bind=engine)
    barrier = threading.Barrier(2)
    def synchronize(conn, cursor, statement, *args):
        if statement.startswith('INSERT INTO prysm_agent_contexts'):
            barrier.wait(timeout=5)
    event.listen(engine, 'before_cursor_execute', synchronize)
    def authorize(_):
        with sessions() as fresh:
            return resolve_request(fresh, req).context_id
    try:
        with ThreadPoolExecutor(max_workers=2) as workers:
            ids = list(workers.map(authorize, range(2)))
        assert ids[0] == ids[1]
    finally:
        event.remove(engine, 'before_cursor_execute', synchronize)
        engine.dispose()


@pytest.mark.asyncio
async def test_cold_binding_closes_db_during_remote_await_and_reauthorizes(clinic, monkeypatch):
    from agent import runtime
    db, auth, _, sessions = clinic
    req = request(db, auth)
    checked_out = []
    engine = db.get_bind()
    db.rollback()  # Release fixture's read connection before the async request.
    def checkout(*args): checked_out.append(1)
    def checkin(*args): checked_out.pop()
    event.listen(engine, 'checkout', checkout)
    event.listen(engine, 'checkin', checkin)
    async def resolve(_):
        assert not checked_out
        with sessions() as revoke:
            revoke.query(AuthSession).first().revoked_at = now()
            revoke.commit()
        return {'customer_principal_ref': 'bound'}
    monkeypatch.setattr(runtime, 'SessionLocal', sessions)
    monkeypatch.setattr(runtime, 'async_client', lambda: SimpleNamespace(embed=SimpleNamespace(resolve_customer_principal=resolve)))
    try:
        with pytest.raises(HTTPException) as failure:
            await runtime.resolve_bff_principal(req)
        assert failure.value.status_code == 401
        assert not checked_out
    finally:
        event.remove(engine, 'checkout', checkout)
        event.remove(engine, 'checkin', checkin)


def test_legacy_company_fallback_uses_the_assigned_clinic(clinic):
    db, auth, _, sessions = clinic
    req = request(db, auth)
    expected_company = auth.user.company_id
    # Canonical policy supports legacy/transient users; current schema disallows persisting NULL.
    from sqlalchemy.orm.attributes import set_committed_value
    set_committed_value(auth.user, 'company_id', None)
    result = resolve_request(db, req)
    assert result.company_id == expected_company
