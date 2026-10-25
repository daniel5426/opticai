"""Application-owned originals and managed Agents24 document processing."""
import hashlib
import requests
import time
from pathlib import Path
from urllib.parse import urlsplit
from uuid import uuid4
from fastapi import HTTPException
from .runtime import client
from .models import AgentJob
from .config import now, data_directory, setting
from datetime import timedelta
from .failures import PlatformOperationFailed, job_failure

TYPES = {'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'text/plain', 'image/png', 'image/jpeg', 'image/webp'}


def submit_document(db, authority, filename, media_type, data):
    if media_type not in TYPES or not data or len(data) > 25 * 1024 * 1024:
        raise HTTPException(422, 'agent.invalidDocument')
    sdk = client()
    job = AgentJob(unique_key='document:' + str(uuid4()), company_id=authority.user.company_id,
                  clinic_id=authority.clinic_id, user_id=authority.user.id, context_id=authority.context_id,
                  kind='document', status='uploading', expires_at=now() + timedelta(days=7), definition={'title': Path(filename.replace('\\', '/')).name[:200], 'media_type': media_type})
    db.add(job); db.commit()
    try:
        return upload_document(db, job, sdk, filename, media_type, data)
    except Exception as error:
        db.rollback()
        db.refresh(job)
        if job.status != 'cancelled':
            job.status, job.result, job.updated_at = 'failed', job_failure(error, 'agent.documentUnavailable'), now()
            db.commit()
        raise


def upload_document(db, job, sdk, filename, media_type, data):
    path = data_directory() / (job.id + '.original')
    path.write_bytes(data)
    path.chmod(0o600)
    job.definition = {**job.definition, 'original_name': path.name, 'digest': hashlib.sha256(data).hexdigest()}
    db.commit()
    upload = sdk.ingestion_jobs.create_upload({'filename': Path(filename.replace('\\', '/')).name[:200], 'mime_type': media_type,
                                              'byte_size': len(data)}, options={'idempotency_key': job.id + '-upload'})
    job.definition = {**job.definition, 'upload_id': upload['id']}
    db.commit()
    part_bytes = upload['part_bytes']
    for part in upload['parts']:
        if part['completed']:
            continue
        db.refresh(job)
        if job.status == 'cancelled':
            sdk.ingestion_jobs.abort_upload(upload['id'], options={'idempotency_key': job.id + '-abort'})
            return {'job_id': job.id, 'status': 'cancelled', 'title': job.definition['title']}
        offset = (part['part_number'] - 1) * part_bytes
        body = data[offset:offset + part_bytes]
        location = urlsplit(part['upload_url'])
        if location.scheme in {'http', 'https'}:
            if location.scheme == 'http' and (urlsplit(setting('AGENTS24_BASE_URL')).hostname not in {'localhost', '127.0.0.1'} or location.hostname not in {'localhost', '127.0.0.1', 'minio'}):
                raise HTTPException(422, 'agent.invalidDocument')
            # Managed signed object-storage URLs never receive the organization key.
            response = requests.put(part['upload_url'], data=body, timeout=90, allow_redirects=False)
            response.raise_for_status()
        else:
            sdk.ingestion_jobs.put_upload_part(upload['id'], str(part['part_number']), body)
    upload = sdk.ingestion_jobs.complete_upload(upload['id'], options={'idempotency_key': job.id + '-complete'})
    job = db.query(AgentJob).filter_by(id=job.id).populate_existing().with_for_update().one()
    if job.status == 'cancelled':
        return {'job_id': job.id, 'status': 'cancelled', 'title': job.definition['title']}
    job.definition = {**job.definition, 'input_ref': upload['input_ref']}
    job.status, job.updated_at = ('running' if job.kind == 'library_document' else 'queued'), now()
    db.commit()
    return {'job_id': job.id, 'status': job.status, 'title': job.definition['title']}


def process_document(db, job):
    sdk = client()
    native = job.definition.get('media_type') in {'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}
    executable = setting('AGENTS24_NATIVE_DOCUMENT_PIPELINE_ID' if native else 'AGENTS24_DOCUMENT_PIPELINE_ID')
    if not executable:
        raise RuntimeError('Document pipeline is not configured')
    definition = job.definition
    if not definition.get('input_ref'):
        raise RuntimeError('Document upload is incomplete')
    if not definition.get('platform_job_id'):
        schema = sdk.pipelines.get_input_schema(executable)
        sources = [step for step in schema['steps'] if step['operator_id'] == 'file_source']
        if len(sources) != 1:
            raise RuntimeError('Document source contract is invalid')
        namespaces = {item['knowledge_store_id']: definition.get('knowledge_namespace', 'intake-' + job.id) for item in schema.get('knowledge_namespace_inputs', [])}
        request = {'executable_pipeline_id': executable, 'name': 'Prysm document',
            'input_params': {sources[0]['step_id']: {'files': [{'input_ref': definition['input_ref'], 'source': {
                'content_id': definition.get('source_content_id', job.id), 'revision_id': definition.get('source_revision', definition['digest']), 'title': definition['title']}}]}},
            'knowledge_namespaces': namespaces}
        job.definition = {**definition, 'processing_request': request}
        db.commit()
        result = sdk.ingestion_jobs.start(request, options={'idempotency_key': job.id + '-processing'})
        job.definition = {**job.definition, 'platform_job_id': result['job_id']}
        db.commit()
    platform_id = job.definition['platform_job_id']
    deadline = time.monotonic() + 480
    while time.monotonic() < deadline:
        db.refresh(job)
        if job.status == 'cancelled':
            sdk.ingestion_jobs.cancel(platform_id, options={'idempotency_key': job.id + '-cancel'})
            return
        state = sdk.ingestion_jobs.get(platform_id, lite=True)
        if state['status'] == 'completed':
            steps = sdk.ingestion_jobs.list_steps(platform_id)['steps']
            outcomes = [value for step in steps if step['operator_id'] in {'document_extract', 'ocr'}
                        for value in step.get('metadata', {}).get('source_outcomes', [])
                        if value.get('source', {}).get('content_id') == job.definition.get('source_content_id', job.id) and value.get('source', {}).get('revision_id') == job.definition.get('source_revision', job.definition['digest'])]
            if not outcomes or any(not value.get('processed_ref') for value in outcomes):
                raise RuntimeError('Document source evidence is unavailable')
            documents = [sdk.ingestion_jobs.get_processed_content(platform_id, reference=value['processed_ref']) for value in outcomes]
            result = {'documents': documents, 'source_outcomes': outcomes, 'original_path': f'/api/v1/agent/jobs/{job.id}/original'}
            job = db.query(AgentJob).filter_by(id=job.id).populate_existing().with_for_update().one()
            if job.status == 'cancelled':
                return
            job.result, job.status, job.updated_at = result, 'completed', now()
            db.commit()
            return
        if state['status'] == 'cancelled':
            job.status, job.updated_at = 'cancelled', now()
            db.commit()
            return
        if state['status'] in {'failed', 'partial_failed'}:
            raise PlatformOperationFailed(state.get('failure'))
        time.sleep(2)
    raise RuntimeError('Document processing timed out')
