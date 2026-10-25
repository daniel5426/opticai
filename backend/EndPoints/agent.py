"""Prysm product endpoints; Agents24 BFF owns conversation operations."""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from database import SessionLocal
from auth import get_current_user
from agent.authority import resolve_request
from agent.models import AgentJob, PreparedChange, FollowupTask
from agent.config import enabled, now, data_directory
from agent import records, reports
from agent.report_definitions import SavedReportRequest

router = APIRouter(prefix='/agent', tags=['agent'])


@router.get('/availability')
async def availability(current_user=Depends(get_current_user)):
    # Use ordinary app authentication; discovery must not create agent contexts.
    from agent.availability import platform_available
    return {'available': await platform_available()}


def get_db():
    with SessionLocal() as db:
        yield db


def authorized(request: Request, db: Session = Depends(get_db)):
    if not enabled():
        raise HTTPException(503, 'agent.unavailable')
    return resolve_request(db, request)


@router.get('/context')
def context(auth=Depends(authorized)):
    return {'context_id': auth.context_id, 'patient_id': auth.patient_id, 'clinic_id': auth.clinic_id}


@router.get('/brief')
def brief(locale: str = 'he', auth=Depends(authorized), db: Session = Depends(get_db)):
    if locale not in {'he', 'en', 'fr'}:
        raise HTTPException(422, 'agent.invalidLocale')
    day = now().astimezone(ZoneInfo('Asia/Jerusalem')).date()
    job = db.query(AgentJob).filter_by(kind='brief', clinic_id=auth.clinic_id, business_date=day, locale=locale).first()
    return {'date': day.isoformat(), 'status': job.status if job else 'pending',
            'brief': job.result if job and job.status == 'completed' else None}


@router.post('/brief/retry')
def retry_brief(locale: str = 'he', auth=Depends(authorized), db: Session = Depends(get_db)):
    from uuid import uuid4
    if locale not in {'he', 'en', 'fr'}:
        raise HTTPException(422, 'agent.invalidLocale')
    day = now().astimezone(ZoneInfo('Asia/Jerusalem')).date()
    row = db.query(AgentJob).filter_by(kind='brief', clinic_id=auth.clinic_id, business_date=day, locale=locale).with_for_update().first()
    if not row or row.status != 'failed':
        raise HTTPException(409, 'agent.retryUnavailable')
    row.status, row.result, row.run_id = 'queued', None, None
    row.definition = {'attempt_key': str(uuid4())}
    db.commit()
    return {'status': row.status}


@router.get('/jobs')
def jobs(auth=Depends(authorized), db: Session = Depends(get_db)):
    rows = db.query(AgentJob).filter(AgentJob.user_id == auth.user.id, AgentJob.clinic_id == auth.clinic_id,
        AgentJob.kind.in_(['report', 'document']))
    if auth.patient_id:
        from agent.models import AgentContext
        rows = rows.join(AgentContext, AgentContext.id == AgentJob.context_id).filter(AgentContext.patient_scope == auth.patient_id)
    rows = rows.order_by(AgentJob.created_at.desc()).limit(30).all()
    return [{'id': row.id, 'kind': row.kind, 'status': row.status, 'title': row.definition.get('title', ''),
             'result': row.result, 'download_path': f'/api/v1/agent/jobs/{row.id}/download' if row.file_name else None,
             'original_path': f'/api/v1/agent/jobs/{row.id}/original' if row.definition.get('original_name') else None} for row in rows]


@router.get('/jobs/history')
def job_history(q: str = Query('', max_length=200), cursor: str | None = Query(None, max_length=512),
                limit: int = Query(20, ge=1, le=50), auth=Depends(authorized), db: Session = Depends(get_db)):
    from agent.job_listing import history
    return history(db, auth, q, cursor, limit)


@router.get('/jobs/activity')
def job_activity(since: datetime | None = None, auth=Depends(authorized), db: Session = Depends(get_db)):
    from agent.job_listing import activity
    if since is not None and since.tzinfo is None:
        raise HTTPException(422, 'agent.invalidDate')
    since = since or now()
    return {'items': activity(db, auth, since), 'since': since.isoformat()}


def owned_job(db, auth, job_id, lock=False):
    query = db.query(AgentJob).filter_by(id=job_id)
    row = query.with_for_update().first() if lock else query.first()
    if not row or row.user_id != auth.user.id or row.clinic_id != auth.clinic_id:
        raise HTTPException(404, 'agent.recordNotFound')
    if row.context_id:
        from agent.models import AgentContext
        binding = db.get(AgentContext, row.context_id)
        if auth.patient_id and (not binding or binding.patient_scope != auth.patient_id):
            raise HTTPException(403, 'agent.scopeDenied')
    elif auth.patient_id:
        raise HTTPException(403, 'agent.scopeDenied')
    return row


def require_live_report(row):
    expiry = row.expires_at
    if expiry and expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=now().tzinfo)
    if row.kind != 'report' or row.definition.get('version') != 2 or expiry and expiry <= now():
        raise HTTPException(410, 'agent.downloadUnavailable')


@router.get('/saved-reports')
def saved_report_list(auth=Depends(authorized), db: Session = Depends(get_db)):
    from agent.report_definitions import saved
    return saved(db, auth, 'list')


@router.post('/saved-reports')
def saved_report_action(payload: SavedReportRequest, auth=Depends(authorized), db: Session = Depends(get_db)):
    from agent.report_definitions import saved
    return saved(db, auth, **payload.model_dump(mode='json'))


@router.get('/reports/{job_id}/page')
def report_page(job_id: str, offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100),
                auth=Depends(authorized), db: Session = Depends(get_db)):
    from agent.report_runs import page
    row = owned_job(db, auth, job_id)
    require_live_report(row)
    if row.status != 'completed':
        return {'job_id': row.id, 'status': row.status}
    return {**(row.result or {}), **page(row, offset, limit)}


@router.get('/reports/{job_id}/export')
def report_export(job_id: str, format: str = Query('xlsx', pattern='^(xlsx|csv)$'),
                  auth=Depends(authorized), db: Session = Depends(get_db)):
    from agent.report_runs import paths
    row = owned_job(db, auth, job_id)
    require_live_report(row)
    file = paths(row)[1 if format == 'xlsx' else 2]
    if row.status != 'completed' or not file.is_file():
        raise HTTPException(410, 'agent.downloadUnavailable')
    return FileResponse(file, media_type='text/csv' if format == 'csv' else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename=f'prysm-report-{row.created_at.date()}.{format}')


@router.get('/jobs/{job_id}')
def job(job_id: str, auth=Depends(authorized), db: Session = Depends(get_db), metadata_only: bool = False):
    row = owned_job(db, auth, job_id)
    if row.kind == 'report' and row.definition.get('version') == 2:
        require_live_report(row)
    if metadata_only:
        expiry = row.expires_at
        if expiry and expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=now().tzinfo)
        expired = bool(expiry and expiry <= now() or row.definition.get('retention_cleaned'))
        return {'id': row.id, 'kind': row.kind, 'title': row.definition.get('title'), 'status': row.status,
            'expired': expired, 'download_path': f'/api/v1/agent/jobs/{row.id}/download'
                if row.status == 'completed' and row.file_name and not expired else None}
    return {'id': row.id, 'kind': row.kind, 'status': row.status, 'result': row.result}


@router.post('/jobs/{job_id}/cancel')
def cancel(job_id: str, auth=Depends(authorized), db: Session = Depends(get_db)):
    row = owned_job(db, auth, job_id, lock=True)
    if row.status in {'uploading', 'queued', 'running'}:
        row.status = 'cancelled'
        row.updated_at = now()
        db.commit()
    return {'status': row.status}


@router.get('/jobs/{job_id}/download')
def download(job_id: str, auth=Depends(authorized), db: Session = Depends(get_db)):
    row = owned_job(db, auth, job_id)
    expiry = row.expires_at
    if expiry and expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=now().tzinfo)
    if row.status != 'completed' or not row.file_name or expiry and expiry <= now():
        raise HTTPException(410, 'agent.downloadUnavailable')
    path = data_directory() / row.file_name
    if path.parent != data_directory() or not path.is_file():
        raise HTTPException(410, 'agent.downloadUnavailable')
    kind = 'text/csv' if row.file_name.endswith('.csv') else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    return FileResponse(path, media_type=kind, filename=f'prysm-report-{row.created_at.date()}{path.suffix}')


@router.get('/tasks')
def tasks(auth=Depends(authorized), db: Session = Depends(get_db)):
    return records.list_records(db, auth, 'tasks', auth.patient_id)


@router.post('/documents')
async def document(file: UploadFile = File(...), auth=Depends(authorized), db: Session = Depends(get_db)):
    from agent.documents import submit_document
    import asyncio
    data = await file.read(25 * 1024 * 1024 + 1)
    try:
        return await asyncio.to_thread(submit_document, db, auth, file.filename or 'document', file.content_type, data)
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise HTTPException(502, 'agent.documentUnavailable') from None


@router.get('/changes/{change_id}')
def change(change_id: str, auth=Depends(authorized), db: Session = Depends(get_db)):
    from agent.authority import owned_change
    row = owned_change(db, auth, change_id)
    if not row:
        raise HTTPException(404, 'agent.recordNotFound')
    client_id = row.payload['fields'].get('client_id') or (row.payload['record_id'] if row.kind == 'clients' else row.expected.get('client_id'))
    label = None
    if client_id:
        from agent.authority import patient
        client = patient(db, auth, client_id)
        label = {'label': ' '.join(value for value in (client.first_name, client.last_name) if value), 'path': f'/clients/{client.id}'}
    from agent.changes import preview
    return {'id': row.id, 'kind': row.kind, 'action': row.action, **preview(row), 'status': row.status, 'patient': label}


@router.post('/changes/{change_id}/approve')
def approve_change(change_id: str, auth=Depends(authorized), db: Session = Depends(get_db)):
    from agent.changes import approve
    return approve(db, auth, change_id)


@router.get('/jobs/{job_id}/original')
def original(job_id: str, auth=Depends(authorized), db: Session = Depends(get_db)):
    row = owned_job(db, auth, job_id)
    expiry = row.expires_at
    if expiry and expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=now().tzinfo)
    if row.kind != 'document' or expiry and expiry <= now():
        raise HTTPException(410, 'agent.downloadUnavailable')
    name = row.definition.get('original_name', '')
    if name != row.id + '.original':
        raise HTTPException(410, 'agent.downloadUnavailable')
    path = data_directory() / name
    if not path.is_file():
        raise HTTPException(410, 'agent.downloadUnavailable')
    return FileResponse(path, media_type=row.definition['media_type'], filename=row.definition['title'])
