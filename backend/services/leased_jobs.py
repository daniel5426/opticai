"""Shared leased job admission for independent app-owned queues."""
from datetime import timedelta
from sqlalchemy import or_, and_
from agent.models import AgentJob
from agent.config import now


def claim_job(db, worker, kinds, clinic_ids=None):
    query = db.query(AgentJob).filter(AgentJob.kind.in_(kinds))
    if clinic_ids is not None:
        query = query.filter(AgentJob.clinic_id.in_(clinic_ids))
    row = query.filter(or_(and_(AgentJob.status == 'queued', or_(AgentJob.lease_until.is_(None), AgentJob.lease_until < now())),
        and_(AgentJob.status == 'running', AgentJob.lease_until < now()))).order_by(AgentJob.created_at).with_for_update(skip_locked=True).first()
    if row:
        row.worker, row.status, row.lease_until = worker, 'running', now() + timedelta(minutes=12)
        row.updated_at = now()
        db.commit()
    return row

