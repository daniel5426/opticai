"""Small, authorized job listings; processed document bodies stay on detail routes."""
import base64
import json
from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy import and_, or_, case
from .config import now
from .models import AgentContext, AgentJob

ACTIVE = ('uploading', 'queued', 'running')


def scoped_jobs(db, auth):
    query = db.query(AgentJob).filter(AgentJob.user_id == auth.user.id,
        AgentJob.clinic_id == auth.clinic_id, AgentJob.kind.in_(['report', 'document']))
    if auth.patient_id:
        query = query.join(AgentContext, AgentContext.id == AgentJob.context_id).filter(AgentContext.patient_scope == auth.patient_id)
    return query


def metadata_query(query):
    return query.with_entities(AgentJob.id, AgentJob.kind, AgentJob.status,
        AgentJob.definition['title'].as_string().label('title'),
        AgentJob.definition['original_name'].as_string().label('original_name'),
        AgentJob.definition['retention_cleaned'].as_boolean().label('cleaned'),
        AgentJob.result['documents'].as_string().is_not(None).label('has_result'), AgentJob.file_name,
        AgentJob.created_at, AgentJob.updated_at, AgentJob.expires_at)


def aware(value):
    return value.replace(tzinfo=timezone.utc) if value and value.tzinfo is None else value


def metadata(row):
    expired = bool(row.cleaned or row.expires_at and aware(row.expires_at) <= now())
    completed = row.status == 'completed' and not expired
    return {'id': row.id, 'kind': row.kind, 'status': row.status, 'title': row.title or '',
        'created_at': aware(row.created_at).isoformat(), 'updated_at': aware(row.updated_at).isoformat(),
        'expires_at': aware(row.expires_at).isoformat() if row.expires_at else None, 'expired': expired,
        'can_analyze': completed and row.kind == 'document' and bool(row.has_result),
        'download_path': f'/api/v1/agent/jobs/{row.id}/download' if completed and row.file_name else None,
        'original_path': f'/api/v1/agent/jobs/{row.id}/original' if not expired and row.original_name else None}


def history(db, auth, search='', cursor=None, limit=20):
    query = scoped_jobs(db, auth)
    if search.strip():
        query = query.filter(AgentJob.definition['title'].as_string().icontains(search.strip(), autoescape=True))
    if cursor:
        try:
            value = json.loads(base64.urlsafe_b64decode(cursor.encode() + b'=' * (-len(cursor) % 4)))
            created = datetime.fromisoformat(value['created_at'])
            identifier = value['id']
            if not isinstance(identifier, str) or len(identifier) != 36 or created.tzinfo is None:
                raise ValueError()
        except (ValueError, TypeError, KeyError, UnicodeError):
            raise HTTPException(422, 'agent.invalidCursor') from None
        query = query.filter(or_(AgentJob.created_at < created,
            and_(AgentJob.created_at == created, AgentJob.id < identifier)))
    rows = metadata_query(query).order_by(AgentJob.created_at.desc(), AgentJob.id.desc()).limit(limit + 1).all()
    page = rows[:limit]
    next_cursor = None
    if len(rows) > limit:
        next_cursor = base64.urlsafe_b64encode(json.dumps({'created_at': aware(page[-1].created_at).isoformat(), 'id': page[-1].id}).encode()).decode().rstrip('=')
    return {'items': [metadata(row) for row in page], 'next_cursor': next_cursor}


def activity(db, auth, since):
    query = scoped_jobs(db, auth).filter(or_(AgentJob.expires_at.is_(None), AgentJob.expires_at > now()),
        AgentJob.definition['retention_cleaned'].as_boolean().is_not(True),
        or_(AgentJob.status.in_(ACTIVE), AgentJob.updated_at >= since))
    rows = metadata_query(query).order_by(case((AgentJob.status.in_(ACTIVE), 0), else_=1),
        AgentJob.updated_at.desc(), AgentJob.id.desc()).limit(100).all()
    return [metadata(row) for row in rows]
