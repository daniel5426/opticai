from datetime import datetime, timezone
import pytest
from fastapi import HTTPException
from models import File, AuthSession
from agent import document_library as library
from agent.models import DocumentIndex
from agent.config import now


def ready_file(db, auth, patient):
    file = File(clinic_id=auth.clinic_id, client_id=patient.id, file_name='Synthetic.txt', file_type='text/plain',
        file_size=25, storage_bucket='test', storage_key='synthetic/first', upload_date=datetime(2026, 10, 1, tzinfo=timezone.utc))
    db.add(file); db.commit()
    mapping = DocumentIndex(file_id=file.id, clinic_id=auth.clinic_id, client_id=patient.id,
        revision=library.revision(file), status='ready', metadata_json={})
    db.add(mapping); db.commit()
    return file, mapping


def evidence(file, mapping, revision=None):
    return {'text': 'Synthetic prescription source', 'evidence': {'schema_version': 'agents24.retrieval-evidence.v1',
        'id': 'evidence', 'knowledge_store_id': 'store', 'content_id': f'file:{file.id}', 'revision_id': revision or mapping.revision,
        'generation_id': 'generation', 'chunk_id': 'chunk', 'locations': [{'kind': 'text', 'reference': 'section:1'}]}}


def test_document_search_staged_and_idempotent_enqueue(clinic, monkeypatch):
    db, auth, patients, _ = clinic
    file, mapping = ready_file(db, auth, patients[0])
    assert library.search(db, auth, 'prescription')['coverage']['enabled'] is False
    monkeypatch.setenv('PRYSM_DOCUMENT_LIBRARY_ENABLED', 'true')
    assert library.enqueue(db, auth, file.id)['id'] == mapping.id
    file.storage_key = 'synthetic/replaced'; db.commit()
    queued = library.enqueue(db, auth, file.id)
    assert queued['id'] != mapping.id and queued['status'] == 'queued'
    assert library.enqueue(db, auth, file.id)['id'] == queued['id']


def test_retrieval_reauthorizes_revision_and_patient_scope(clinic, monkeypatch):
    db, auth, patients, _ = clinic
    first, mapping = ready_file(db, auth, patients[0])
    second, foreign = ready_file(db, auth, patients[1])
    monkeypatch.setenv('PRYSM_DOCUMENT_LIBRARY_ENABLED', 'true')
    monkeypatch.setattr(library, 'retrieve_native', lambda *_: [evidence(first, mapping), evidence(second, foreign), evidence(first, mapping, 'old-revision')])
    auth.patient_id = patients[0].id
    result = library.search(db, auth, 'prescription')
    assert result['total'] == 1 and result['items'][0]['source']['id'] == first.id
    assert result['items'][0]['evidence']['locations'][0]['reference'] == 'section:1'


def test_file_deletion_during_retrieval_revokes_evidence_immediately(clinic, monkeypatch):
    db, auth, patients, _ = clinic
    file, mapping = ready_file(db, auth, patients[0])
    monkeypatch.setenv('PRYSM_DOCUMENT_LIBRARY_ENABLED', 'true')
    hit = evidence(file, mapping)
    def retrieve(*_):
        file.deleted_at = now(); db.commit()
        return [hit]
    monkeypatch.setattr(library, 'retrieve_native', retrieve)
    assert library.search(db, auth, 'prescription')['total'] == 0


def test_session_revocation_during_retrieval_blocks_response(clinic, monkeypatch):
    db, auth, patients, _ = clinic
    file, mapping = ready_file(db, auth, patients[0])
    monkeypatch.setenv('PRYSM_DOCUMENT_LIBRARY_ENABLED', 'true')
    def retrieve(*_):
        db.query(AuthSession).one().revoked_at = now(); db.commit()
        return [evidence(file, mapping)]
    monkeypatch.setattr(library, 'retrieve_native', retrieve)
    with pytest.raises(HTTPException) as error:
        library.search(db, auth, 'prescription')
    assert error.value.status_code == 401
