"""Staged permanent-file indexing; Agents24 owns extraction and vector retrieval."""
import hashlib
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from uuid import uuid4
from datetime import timedelta
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from models import File, User
from security.scope import assert_clinic_scope
from services.clinic_catalog import scoped_query
from .models import AgentJob, DocumentIndex
from .authority import Authority
from .config import setting, now, data_directory
from .runtime import client, target, integration
from .failures import PlatformOperationFailed


def enabled():
    return setting('PRYSM_DOCUMENT_LIBRARY_ENABLED', 'false').lower() == 'true'


def revision(file):
    payload = [file.storage_bucket, file.storage_key, file.file_size, file.file_type,
        file.upload_date.isoformat() if file.upload_date else None]
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False).encode()).hexdigest()


def namespace(clinic_id):
    return f'prysm-clinic-{clinic_id}-files'


def authorized_file(db, auth, file_id):
    file = scoped_query(db, auth, 'files').filter(File.id == file_id).first()
    if not file:
        raise HTTPException(404, 'agent.recordNotFound')
    return file


def enqueue(db, auth, file_id):
    if not enabled():
        raise HTTPException(409, 'agent.documentLibraryDisabled')
    file = authorized_file(db, auth, file_id)
    fingerprint = revision(file)
    current = db.query(DocumentIndex).filter_by(file_id=file.id, revision=fingerprint).first()
    if current:
        if current.status == 'failed' and current.job_id:
            job = db.get(AgentJob, current.job_id)
            # Retained platform upload/job IDs are reused, not redispatched blindly.
            if job and not job.definition.get('retention_cleaned'):
                job.status, current.status = 'queued', 'queued'
                db.commit()
        return {'id': current.id, 'status': current.status}
    entry = DocumentIndex(file_id=file.id, clinic_id=auth.clinic_id, client_id=file.client_id, revision=fingerprint)
    db.add(entry)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        return enqueue(db, auth, file_id)
    job = AgentJob(unique_key=f'library:{file.id}:{fingerprint}', company_id=auth.company_id or auth.user.company_id,
        clinic_id=auth.clinic_id, user_id=auth.user.id, kind='library_document', status='queued',
        definition={'title': file.file_name, 'file_id': file.id, 'mapping_id': entry.id, 'revision': fingerprint},
        expires_at=now() + timedelta(days=7))
    db.add(job); db.flush()
    entry.job_id = job.id
    db.commit()
    return {'id': entry.id, 'status': entry.status}


def process(db, job):
    if not enabled():
        raise HTTPException(409, 'agent.documentLibraryDisabled')
    user = db.get(User, job.user_id)
    if not user or not user.is_active:
        raise HTTPException(403, 'agent.scopeDenied')
    assert_clinic_scope(db, user, job.clinic_id)
    auth = Authority(user, job.clinic_id, 'library:' + job.id)
    entry = db.get(DocumentIndex, job.definition['mapping_id'])
    file = authorized_file(db, auth, job.definition['file_id'])
    if not entry or revision(file) != entry.revision:
        raise HTTPException(409, 'agent.staleChange')
    sdk = client()
    if not job.definition.get('input_ref'):
        from .documents import upload_document, TYPES
        from services.file_storage_service import get_file_storage_service
        media_type = file.file_type
        if media_type not in TYPES or not file.storage_bucket or not file.storage_key:
            raise HTTPException(422, 'agent.invalidDocument')
        if file.file_size and file.file_size > 25 * 1024 * 1024:
            raise HTTPException(422, 'agent.invalidDocument')
        with TemporaryDirectory(prefix='prysm-file-index-') as directory:
            path = Path(directory) / 'source'
            get_file_storage_service().download_to_path(file.storage_bucket, file.storage_key, path)
            data = path.read_bytes()
        if not data or len(data) > 25 * 1024 * 1024:
            raise HTTPException(422, 'agent.invalidDocument')
        job.definition = {**job.definition, 'media_type': media_type, 'source_content_id': 'file:' + str(file.id),
            'source_revision': entry.revision, 'knowledge_namespace': namespace(job.clinic_id)}
        db.commit()
        upload_document(db, job, sdk, file.file_name, media_type, data)
    from .documents import process_document
    process_document(db, job)
    db.refresh(job)
    if job.status == 'completed':
        db.refresh(file)
        # A replacement/deletion during provider processing must not publish the old revision.
        active = authorized_file(db, auth, file.id)
        outcomes = (job.result or {}).get('source_outcomes', [])
        entry.status = 'ready' if revision(active) == entry.revision and outcomes and all(
            outcome.get('completeness') == 'complete' for outcome in outcomes) else 'partial'
        entry.metadata_json = {'processing_request': job.definition.get('processing_request'),
            'platform_job_id': job.definition.get('platform_job_id'), 'source_outcomes': outcomes}
        entry.updated_at = now()
        db.commit()


def retrieve_native(auth, query):
    resource, store = setting('AGENTS24_DOCUMENT_SEARCH_AGENT_ID'), setting('AGENTS24_DOCUMENT_STORE_ID')
    if not resource or not store:
        raise HTTPException(409, 'agent.documentLibraryUnconfigured')
    sdk = client()
    identity = sdk.embed.resolve_customer_principal({'integration_id': integration(), 'issuer': 'prysm',
        'subject': f'{auth.company_id or auth.user.company_id}:{auth.user.id}'})
    access = {'external_user_id': identity['customer_principal_ref'], 'integration_id': integration(),
        'external_session_id': auth.context_id, 'runtime_target': target(),
        'chat_scope': f'clinic:{auth.clinic_id}:patient:{auth.patient_id or 0}'}
    admitted = sdk.embed.start_agent_run(resource, {**access, 'input': query,
        'knowledge_namespaces': {store: namespace(auth.clinic_id)}}, options={'idempotency_key': str(uuid4())})
    result = sdk.embed.wait_for_agent_run(resource, admitted['run_id'], **access, timeout_seconds=40)
    if result['status'] != 'completed' or not result.get('final_output_available'):
        raise PlatformOperationFailed(result.get('failure'))
    output = result.get('final_output')
    if not isinstance(output, dict) or not isinstance(output.get('results'), list):
        raise HTTPException(502, 'agent.documentUnavailable')
    return output['results']


def search(db, auth, text, limit=10):
    files = scoped_query(db, auth, 'files').all()
    file_map = {file.id: file for file in files}
    entries = db.query(DocumentIndex).filter(DocumentIndex.clinic_id == auth.clinic_id,
        DocumentIndex.file_id.in_(file_map)).all()
    active = {entry.file_id: entry for entry in entries if entry.revision == revision(file_map[entry.file_id])}
    ready = {entry.file_id: entry for entry in active.values() if entry.status == 'ready'}
    coverage = {'total_files': len(files), 'ready': len(ready), 'failed': sum(e.status == 'failed' for e in active.values()),
        'partial': sum(e.status == 'partial' for e in active.values()), 'pending': len(files) - len(ready), 'enabled': enabled()}
    if not enabled() or not ready:
        return {'type': 'document_search', 'items': [], 'total': 0, 'coverage': coverage}
    candidates = retrieve_native(auth, text)
    # Re-read after external I/O; neither namespace nor stale vector metadata authorizes a file.
    db.expire_all()
    from .authority import resolve_artifact
    auth = resolve_artifact(db, {'external_session_id': auth.context_id})
    current_files = {file.id: file for file in scoped_query(db, auth, 'files').filter(File.id.in_(ready)).all()}
    items = []
    for candidate in candidates:
        evidence = candidate.get('evidence')
        if not isinstance(evidence, dict) or evidence.get('schema_version') != 'agents24.retrieval-evidence.v1':
            continue
        content = str(evidence.get('content_id', ''))
        if not content.startswith('file:') or not content[5:].isdigit():
            continue
        file_id = int(content[5:])
        file = current_files.get(file_id)
        entry = ready.get(file_id)
        if not file or not entry or entry.status != 'ready' or revision(file) != entry.revision or evidence.get('revision_id') != entry.revision:
            continue
        excerpt = candidate.get('text') or candidate.get('content')
        if not isinstance(excerpt, str):
            continue
        items.append({'title': file.file_name, 'excerpt': excerpt, 'evidence': evidence,
            'source': {'kind': 'files', 'id': file.id, 'client_id': file.client_id, 'path': f'/clients/{file.client_id}?tab=files'}})
        if len(items) >= limit:
            break
    return {'type': 'document_search', 'items': items, 'total': len(items), 'coverage': coverage,
        'candidate_limit': 50, 'candidates_limited': len(candidates) >= 50}
