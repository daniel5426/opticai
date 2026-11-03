"""Authenticated supply intake and explicit staff approval."""
import json
from datetime import timedelta
from pathlib import Path
from uuid import uuid4
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from EndPoints.agent import authorized, get_db, owned_job
from agent.config import now, setting
from agent.models import AgentJob
from services import supply_intake as supply

router = APIRouter(prefix='/supply', tags=['agent-supply'])


@router.post('/extract')
async def extract(file: UploadFile = File(...), auth=Depends(authorized)):
    supply.check_authority(auth)
    data = await file.read(25 * 1024 * 1024 + 1)
    if len(data) > 25 * 1024 * 1024: raise HTTPException(422, 'supply.tooLarge')
    if Path(file.filename or '').suffix.lower() not in {'.xlsx', '.xls'}: raise HTTPException(422, 'supply.invalidFile')
    from starlette.concurrency import run_in_threadpool
    try: rows = await run_in_threadpool(supply.spreadsheet, file.filename, data)
    except HTTPException: raise
    except Exception: raise HTTPException(422, 'supply.invalidFile') from None
    return {'text': json.dumps({'filename': file.filename, 'spreadsheet_rows': rows}, ensure_ascii=False)}


@router.post('')
async def intake(file: UploadFile | None = File(None), text: str = Form(''), operation: str = Form('catalog'),
                 auth=Depends(authorized), db=Depends(get_db)):
    supply.check_authority(auth)
    if operation not in supply.OPERATIONS: raise HTTPException(422, 'supply.invalidRows')
    if not setting('AGENTS24_SUPPLY_AGENT_ID'): raise HTTPException(503, 'supply.notConfigured')
    sources, document_id = [], None
    content_digest = None
    title = (Path((file.filename or 'Supply').replace('\\', '/')).name if file else 'Supply text')[:200]
    original = None
    if file:
        data = await file.read(25 * 1024 * 1024 + 1)
        if not data or len(data) > 25 * 1024 * 1024: raise HTTPException(422, 'supply.tooLarge')
        content_digest = supply.fingerprint({'digest': supply.hashlib.sha256(data).hexdigest(), 'operation': operation})
        prior = db.query(AgentJob).filter_by(kind='supply', clinic_id=auth.clinic_id, user_id=auth.user.id).filter(AgentJob.definition['source_digest'].as_string() == content_digest).first()
        if prior: return {'job_id': prior.id}
        original = data
        if Path(file.filename or '').suffix.lower() in {'.xlsx', '.xls', '.csv'}:
            from starlette.concurrency import run_in_threadpool
            try: sources = await run_in_threadpool(supply.spreadsheet, file.filename, data)
            except HTTPException: raise
            except Exception: raise HTTPException(422, 'supply.invalidFile') from None
        else:
            from agent.documents import submit_document
            from starlette.concurrency import run_in_threadpool
            result = await run_in_threadpool(submit_document, db, auth, file.filename, (file.content_type or '').split(';')[0], data)
            document_id = result['job_id']
    elif text.strip():
        if len(text) > 200000: raise HTTPException(422, 'supply.tooLarge')
        content_digest = supply.fingerprint({'text': text, 'operation': operation})
        prior = db.query(AgentJob).filter_by(kind='supply', clinic_id=auth.clinic_id, user_id=auth.user.id).filter(AgentJob.definition['source_digest'].as_string() == content_digest).first()
        if prior: return {'job_id': prior.id}
        sources = [{'row': index + 1, 'text': line} for index, line in enumerate(text.splitlines()) if line.strip()]
    else: raise HTTPException(422, 'supply.invalidFile')
    job = AgentJob(unique_key=f'supply:{auth.clinic_id}:{auth.user.id}:{content_digest}', company_id=auth.user.company_id, clinic_id=auth.clinic_id,
        user_id=auth.user.id, context_id=auth.context_id, kind='supply', status='queued', expires_at=now() + timedelta(days=7),
        definition={'title': title, 'sources': sources, 'document_id': document_id, 'operation': operation, 'source_digest': content_digest})
    db.add(job)
    from sqlalchemy.exc import IntegrityError
    try: db.flush()
    except IntegrityError:
        db.rollback()
        existing = db.query(AgentJob).filter_by(unique_key=f'supply:{auth.clinic_id}:{auth.user.id}:{content_digest}').one()
        return {'job_id': existing.id}
    if original is not None and not document_id:
        path = supply.data_directory() / (job.id + '.original')
        path.write_bytes(original); path.chmod(0o600)
        job.definition = {**job.definition, 'original_name': path.name, 'media_type': file.content_type or 'application/octet-stream'}
    db.commit()
    return {'job_id': job.id}


@router.get('')
def proposals(legacy_only: bool = False, auth=Depends(authorized), db=Depends(get_db)):
    supply.check_authority(auth)
    query = db.query(AgentJob).filter_by(kind='supply', user_id=auth.user.id, company_id=auth.user.company_id,
        clinic_id=auth.clinic_id).filter(AgentJob.expires_at > now())
    if legacy_only:
        query = query.filter(AgentJob.definition['origin'].as_string().is_(None))
    rows = query.order_by(AgentJob.created_at.desc()).limit(20).all()
    return [{'id': row.id, 'title': row.definition.get('title'), 'origin': row.definition.get('origin'), 'status': row.status, 'result': {'status': (row.result or {}).get('status')}} for row in rows]


@router.get('/{job_id}')
def get(job_id: str, auth=Depends(authorized), db=Depends(get_db)):
    supply.check_authority(auth)
    row = supply.owned(db, auth, job_id)
    return {'id': row.id, 'status': row.status, 'result': row.result}


@router.post('/{job_id}/review')
def review(job_id: str, payload: dict, auth=Depends(authorized), db=Depends(get_db)):
    job = supply.owned(db, auth, job_id, lock=True)
    if job.status != 'completed' or (job.result or {}).get('revision') != payload.get('revision'): raise HTTPException(409, 'agent.staleChange')
    return supply.review(db, auth, job, payload.get('operation'), payload.get('rows'))


@router.post('/{job_id}/apply')
def apply(job_id: str, payload: dict, auth=Depends(authorized), db=Depends(get_db)):
    try: return supply.commit(db, auth, job_id, payload.get('revision'))
    except Exception as error:
        db.rollback()
        from sqlalchemy.exc import IntegrityError
        if isinstance(error, IntegrityError): raise HTTPException(409, 'agent.staleChange') from None
        raise


@router.post('/{job_id}/retry')
def retry(job_id: str, auth=Depends(authorized), db=Depends(get_db)):
    """An explicit retry reuses ingestion admission keys after uncertain delivery."""
    supply.check_authority(auth)
    job = supply.owned(db, auth, job_id, lock=True)
    if job.status not in {'failed', 'cancelled'}: return {'job_id': job.id}
    pending = job.definition.get('retry_pending', False)
    attempt = job.definition.get('retry_attempt', 0) + (0 if pending else 1)
    job.definition = {**job.definition, 'retry_attempt': attempt, 'retry_pending': True}
    job.status = 'uploading'; db.commit()
    try:
        document = db.get(AgentJob, job.definition.get('document_id')) if job.definition.get('document_id') else None
        if document and document.status in {'failed', 'cancelled'}:
            from agent.runtime import client
            sdk = client()
            if document.definition.get('platform_job_id'):
                sdk.ingestion_jobs.resume(document.definition['platform_job_id'], options={'idempotency_key': f'{job.id}-source-retry-{attempt}'})
                document.status, document.lease_until = 'queued', None
            elif not document.definition.get('input_ref'):
                from agent.documents import upload_document
                original = supply.data_directory() / (document.id + '.original')
                upload_document(db, document, sdk, document.definition['title'], document.definition['media_type'], original.read_bytes())
            else:
                document.status, document.lease_until = 'queued', None
        job.definition = {**job.definition, 'retry_pending': False}
        job.status, job.result, job.lease_until, job.run_id, job.thread_id = 'queued', None, None, None, None
        db.commit()
        return {'job_id': job.id}
    except Exception:
        db.rollback(); db.refresh(job); job.status = 'failed'; db.commit()
        raise HTTPException(502, 'supply.failed') from None
