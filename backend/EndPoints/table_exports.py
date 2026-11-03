"""Authenticated manual table exports. No AI entitlement or chat context required."""
from urllib.parse import quote
from datetime import timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from auth import get_current_user
from database import get_db
from models import User
from agent.models import AgentJob
from agent.config import now
from services import table_exports as exports

router = APIRouter(prefix='/table-exports', tags=['table-exports'])


@router.post('/count')
def count(payload: exports.ExportRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return {'rows': exports.count(db, user, payload)}


@router.post('')
def create(payload: exports.ExportRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return exports.status(exports.enqueue(db, user, payload))


def owned(db, user, job_id):
    row = db.get(AgentJob, job_id)
    request = exports.validate_job(db, user, row)
    if exports.is_expired(row):
        raise HTTPException(410, 'tableExport.expired')
    return row, request


@router.get('/{job_id}')
def status(job_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row, _ = owned(db, user, job_id)
    return exports.status(row)


@router.post('/{job_id}/cancel')
def cancel(job_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row, _ = owned(db, user, job_id)
    # Conditional update prevents a racing completion from being overwritten.
    db.query(AgentJob).filter(AgentJob.id == row.id, AgentJob.status.in_(['queued', 'running'])).update(
        {'status': 'cancelled', 'updated_at': now()}, synchronize_session=False)
    db.commit(); db.refresh(row)
    return exports.status(row)


@router.get('/{job_id}/download')
def download(job_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row, request = owned(db, user, job_id)
    if row.status != 'completed':
        raise HTTPException(409, 'tableExport.unavailable')
    path = exports.paths(row)[0 if request.format == 'xlsx' else 1]
    if not path.is_file():
        raise HTTPException(410, 'tableExport.expired')
    created = row.created_at if row.created_at.tzinfo else row.created_at.replace(tzinfo=timezone.utc)
    filename = f'{exports.text(request.locale, "table." + request.table)}-{created.astimezone(exports.ZONE).date().isoformat()}.{request.format}'
    return FileResponse(path, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' if request.format == 'xlsx' else 'text/csv; charset=utf-8',
        headers={'Content-Disposition': "attachment; filename*=UTF-8''" + quote(filename), 'Cache-Control': 'no-store'})
