"""Exercise the signed public Artifact boundary with synthetic clinic data only."""
import asyncio
import json
import threading

import httpx
import pytest
from fastapi import HTTPException
from agents24.server import sign_artifact_payload

from agent import artifact, changes
from agent.models import FollowupTask

SECRET = 'synthetic-artifact-signing-secret'


@pytest.fixture
def app(clinic, monkeypatch):
    _, _, _, sessions = clinic
    monkeypatch.setattr(artifact, 'SessionLocal', sessions)
    monkeypatch.setenv('AGENTS24_ARTIFACT_SIGNING_SECRET', SECRET)
    return artifact.artifact_app()


async def call(app, name, inputs, context, *, secret=SECRET):
    body = json.dumps({'export_name': name, 'inputs': inputs, 'context': context})
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://clinic.test') as client:
        return await client.post('/agents24/artifact/invoke', content=body,
                                 headers=sign_artifact_payload(body=body, signing_secret=secret))


@pytest.mark.asyncio
async def test_signed_manifest_and_context_use_public_sdk(app, clinic):
    _, auth, _, _ = clinic
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://clinic.test') as client:
        manifest = (await client.get('/.well-known/agents24/artifact')).json()
    assert {group['key'] for group in manifest['toolsets']} == {'records', 'workflow', 'reporting'}
    assert manifest['invocation_auth']['mode'] == 'hmac_sha256'
    result = (await call(app, 'clinic_context', {}, {'external_session_id': auth.context_id})).json()
    assert result['status'] == 'completed'
    assert result['result']['clinic_id'] == auth.clinic_id
    assert result['result']['current_user_id'] == auth.user.id


@pytest.mark.asyncio
async def test_bad_signature_never_reaches_database(app, monkeypatch):
    def forbidden():
        pytest.fail('Invalid signature reached clinic authorization')
    monkeypatch.setattr(artifact, 'SessionLocal', forbidden)
    response = await call(app, 'clinic_context', {}, {}, secret='wrong-key')
    assert response.status_code == 401
    assert response.json()['error']['code'] == 'INVALID_SIGNATURE'


@pytest.mark.asyncio
async def test_invalid_input_is_a_failed_invocation(app, clinic):
    _, auth, _, _ = clinic
    result = (await call(app, 'search_patients', {'text': 123, 'user_id': 999}, {'external_session_id': auth.context_id})).json()
    assert result['status'] == 'failed'
    assert result['error']['code'] == 'CLINIC_INPUT_INVALID'


@pytest.mark.asyncio
async def test_foreign_patient_is_a_failed_invocation(app, clinic):
    _, auth, patients, _ = clinic
    result = (await call(app, 'patient_history', {'client_id': patients[2].id}, {'external_session_id': auth.context_id})).json()
    assert result['status'] == 'failed'
    assert result['result'] is None
    assert 'Foreign' not in json.dumps(result)


@pytest.mark.asyncio
async def test_revoked_session_cannot_execute(app, clinic):
    from models import AuthSession
    from agent.config import now
    db, auth, _, _ = clinic
    db.get(AuthSession, '00000000-0000-0000-0000-000000000001').revoked_at = now()
    db.commit()
    result = (await call(app, 'clinic_context', {}, {'external_session_id': auth.context_id})).json()
    assert result['status'] == 'failed'
    assert result['error']['code'] == 'agent.sessionRequired'


@pytest.mark.asyncio
async def test_signed_commit_requires_receipt_and_saves_exactly_once(app, clinic):
    db, auth, patients, _ = clinic
    proposal = changes.prepare(db, auth, 'tasks', 'create', {'client_id': patients[0].id,
        'title': 'Synthetic Artifact qualification', 'due_date': '2026-11-01'})
    inputs = {'change_id': proposal['change_id']}
    context = {'external_session_id': auth.context_id}
    denied = (await call(app, 'commit_change', inputs, context)).json()
    assert denied['status'] == 'failed'
    assert denied['error']['code'] == 'agent.approvalRequired'
    assert db.query(FollowupTask).count() == 0
    changes.approve(db, auth, proposal['change_id'])
    first = (await call(app, 'commit_change', inputs, context)).json()
    replay = (await call(app, 'commit_change', inputs, context)).json()
    assert first['status'] == replay['status'] == 'completed'
    assert first['result'] == replay['result']
    assert first['result']['approval']['user_id'] == auth.user.id
    assert db.query(FollowupTask).count() == 1


@pytest.mark.asyncio
@pytest.mark.parametrize('error', [RuntimeError('private SQL and credentials'), HTTPException(500, 'private diagnostics'),
                                  ValueError('private clinical value')])
async def test_failures_never_serialize_diagnostics(app, monkeypatch, error):
    def rejected(*_):
        raise error
    monkeypatch.setattr(artifact, 'resolve_artifact', rejected)
    result = (await call(app, 'clinic_context', {}, {})).json()
    assert result['status'] == 'failed'
    assert 'private' not in json.dumps(result)
    assert result['result'] is None


@pytest.mark.asyncio
async def test_slow_database_does_not_block_health_and_session_stays_on_worker(app, clinic, monkeypatch):
    _, auth, _, sessions = clinic
    entered, release = threading.Event(), threading.Event()
    threads = []
    def session():
        threads.append(threading.get_ident())
        return sessions()
    original = artifact.resolve_artifact
    def slow(db, context):
        entered.set()
        assert release.wait(3)
        threads.append(threading.get_ident())
        return original(db, context)
    monkeypatch.setattr(artifact, 'SessionLocal', session)
    monkeypatch.setattr(artifact, 'resolve_artifact', slow)
    pending = asyncio.create_task(call(app, 'clinic_context', {}, {'external_session_id': auth.context_id}))
    try:
        for _ in range(100):
            if entered.is_set():
                break
            await asyncio.sleep(.005)
        assert entered.is_set()
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://clinic.test') as client:
            health = await asyncio.wait_for(client.get('/.well-known/agents24/artifact/health'), .25)
        assert health.status_code == 200
        assert not pending.done()
    finally:
        release.set()
        response = await pending
    assert response.json()['status'] == 'completed'
    assert len(set(threads)) == 1 and threads[0] != threading.get_ident()
