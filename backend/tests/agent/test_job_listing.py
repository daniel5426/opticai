from datetime import timedelta
from uuid import uuid4
import pytest
from fastapi import HTTPException
from agent.config import now
from agent.job_listing import history, activity
from agent.models import AgentJob, AgentContext
from agent.authority import Authority


def add_job(db, auth, **values):
    job = AgentJob(id=str(uuid4()), unique_key=str(uuid4()), company_id=auth.user.company_id,
        clinic_id=auth.clinic_id, user_id=auth.user.id, context_id=auth.context_id,
        kind='report', status='completed', definition={'title': 'Report'},
        expires_at=now() + timedelta(days=7), file_name='report.xlsx')
    for key, value in values.items():
        setattr(job, key, value)
    db.add(job)
    db.flush()
    return job


def test_history_keyset_search_scope_and_small_metadata(clinic):
    db, auth, patients, _ = clinic
    timestamp = now() - timedelta(hours=1)
    jobs = [add_job(db, auth, created_at=timestamp, definition={'title': f'Clinic report {i}'}, result={'documents': ['large private body']}) for i in range(45)]
    foreign = add_job(db, auth, clinic_id=patients[2].clinic_id, definition={'title': 'Clinic foreign'})
    another_user = add_job(db, auth, user_id=None, definition={'title': 'Clinic other user'})
    db.commit()
    first = history(db, auth, limit=20)
    assert len(first['items']) == 20 and first['next_cursor']
    add_job(db, auth, definition={'title': 'New arrival'})
    db.commit()
    second = history(db, auth, cursor=first['next_cursor'], limit=20)
    third = history(db, auth, cursor=second['next_cursor'], limit=20)
    ids = [item['id'] for page in (first, second, third) for item in page['items']]
    assert len(ids) == len(set(ids)) == 45
    assert set(ids) == {job.id for job in jobs}
    assert foreign.id not in ids and another_user.id not in ids
    assert third['next_cursor'] is None
    assert all('result' not in item and 'definition' not in item for item in first['items'])
    assert len(history(db, auth, search='report 44')['items']) == 1
    assert history(db, auth, search='%')['items'] == []
    with pytest.raises(HTTPException) as error:
        history(db, auth, cursor='invalid!')
    assert error.value.status_code == 422


def test_expired_history_disables_actions_before_cleanup_and_after(clinic):
    db, auth, *_ = clinic
    expired = add_job(db, auth, kind='document', expires_at=now() - timedelta(seconds=1),
        definition={'title': 'Expired', 'original_name': 'old.original'}, result={'documents': ['body']})
    cleaned = add_job(db, auth, definition={'title': 'Cleaned', 'retention_cleaned': True})
    valid = add_job(db, auth, kind='document', definition={'title': 'Valid', 'original_name': 'valid.original'}, result={'documents': ['body']})
    failed = add_job(db, auth, kind='document', status='failed', definition={'title': 'Failed', 'original_name': 'failed.original'})
    db.commit()
    items = {item['id']: item for item in history(db, auth)['items']}
    for job in (expired, cleaned):
        assert items[job.id]['expired']
        assert items[job.id]['download_path'] is None and items[job.id]['original_path'] is None
        assert not items[job.id]['can_analyze']
    assert items[valid.id]['can_analyze'] and items[valid.id]['original_path']
    assert items[failed.id]['original_path'] and not items[failed.id]['can_analyze']


def test_activity_only_active_or_new_terminal_jobs_and_patient_scope(clinic):
    db, auth, patients, _ = clinic
    since = now() - timedelta(minutes=1)
    old = add_job(db, auth, updated_at=since - timedelta(days=1))
    active = add_job(db, auth, status='running', updated_at=since - timedelta(days=1))
    recent = add_job(db, auth, updated_at=now())
    expired = add_job(db, auth, expires_at=now() - timedelta(days=1))
    db.commit()
    rows = activity(db, auth, since)
    assert {item['id'] for item in rows} == {active.id, recent.id}
    assert rows[0]['id'] == active.id
    context = db.get(AgentContext, auth.context_id)
    patient_context = AgentContext(session_id=context.session_id, company_id=auth.user.company_id,
        clinic_id=auth.clinic_id, user_id=auth.user.id, patient_scope=patients[0].id)
    db.add(patient_context); db.flush()
    patient_job = add_job(db, auth, context_id=patient_context.id, status='queued')
    db.commit()
    patient_auth = Authority(auth.user, auth.clinic_id, patient_context.id, patients[0].id)
    assert [item['id'] for item in activity(db, patient_auth, since)] == [patient_job.id]
    assert [item['id'] for item in history(db, patient_auth)['items']] == [patient_job.id]


def test_http_metadata_routes_validate_inputs_and_preserve_legacy_list(clinic):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from EndPoints import agent as endpoints
    db, auth, *_ = clinic
    add_job(db, auth, result={'documents': ['Private extraction']})
    no_content = add_job(db, auth, kind='document', result=None)
    db.commit()
    app = FastAPI()
    app.include_router(endpoints.router, prefix='/api/v1')
    app.dependency_overrides[endpoints.authorized] = lambda: auth
    app.dependency_overrides[endpoints.get_db] = lambda: db
    with TestClient(app) as client:
        response = client.get('/api/v1/agent/jobs/history')
        assert response.status_code == 200
        items = response.json()['items']
        assert all('result' not in item for item in items)
        assert not next(item for item in items if item['id'] == no_content.id)['can_analyze']
        assert any(item.get('result') == {'documents': ['Private extraction']} for item in client.get('/api/v1/agent/jobs').json())
        assert 'result' in client.get('/api/v1/agent/jobs').json()[0]
        assert client.get('/api/v1/agent/jobs/history', params={'limit': 0}).status_code == 422
        assert client.get('/api/v1/agent/jobs/history', params={'q': 'x' * 201}).status_code == 422
        assert client.get('/api/v1/agent/jobs/history', params={'cursor': 'invalid'}).status_code == 422
        assert client.get('/api/v1/agent/jobs/activity', params={'since': '2026-10-18T10:00:00'}).status_code == 422
        initial = client.get('/api/v1/agent/jobs/activity')
        assert initial.status_code == 200 and initial.json()['since']
        assert client.get('/api/v1/agent/jobs/activity', params={'since': initial.json()['since']}).status_code == 200
