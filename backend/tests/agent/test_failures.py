import json
from uuid import uuid4
from types import SimpleNamespace
from unittest.mock import Mock
import pytest
from agent.failures import PlatformOperationFailed, job_failure
from agent.documents import process_document


def failure():
    return {'schema_version': 'agents24.failure.v1', 'failure_id': str(uuid4()),
            'code': 'OCR_PROVIDER_FAILED', 'retryable': False,
            'message': 'private diagnostic', 'details': {'token': 'secret'}}


def test_failure_reference_excludes_messages_and_diagnostics():
    original = failure()
    result = job_failure(PlatformOperationFailed(original))
    assert result['platform_failure']['failure_id'] == original['failure_id']
    assert result['platform_failure']['code'] == 'OCR_PROVIDER_FAILED'
    assert 'private' not in json.dumps(result) and 'secret' not in json.dumps(result)
    assert job_failure(RuntimeError('private secret')) == {'code': 'agent.jobFailed'}


@pytest.mark.parametrize('field,value', [('schema_version', 'invalid'), ('failure_id', 'invalid'),
                                       ('code', 'private diagnostic')])
def test_invalid_platform_failure_is_not_persisted(field, value):
    data = {**failure(), field: value}
    assert job_failure(PlatformOperationFailed(data)) == {'code': 'agent.jobFailed'}


def test_document_failure_keeps_support_reference_and_cancel_is_lifecycle(monkeypatch):
    monkeypatch.setenv('AGENTS24_NATIVE_DOCUMENT_PIPELINE_ID', 'synthetic')
    platform_failure = failure()
    sdk = SimpleNamespace(ingestion_jobs=SimpleNamespace(get=Mock(return_value={
        'status': 'failed', 'failure': platform_failure})))
    monkeypatch.setattr('agent.documents.client', lambda: sdk)
    db = Mock()
    job = SimpleNamespace(definition={'media_type': 'text/plain', 'input_ref': 'input',
                                     'platform_job_id': 'platform'}, status='running')
    with pytest.raises(PlatformOperationFailed) as caught:
        process_document(db, job)
    assert job_failure(caught.value)['platform_failure']['failure_id'] == platform_failure['failure_id']
    sdk.ingestion_jobs.get.return_value = {'status': 'cancelled'}
    process_document(db, job)
    assert job.status == 'cancelled'
    db.commit.assert_called_once()
