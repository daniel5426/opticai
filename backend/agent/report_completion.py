"""Existing report jobs carry bounded completion retry state; report execution never polls a model."""
from datetime import timedelta
from functools import lru_cache
import logging
import random
from fastapi import HTTPException
from agents24.artifacts import pending_result
from agents24.server import ArtifactInvocationError
from .config import now, setting
from .models import AgentJob

logger = logging.getLogger(__name__)
TERMINAL = {'completed', 'failed', 'cancelled'}


def _result(job, offset=0, limit=25):
    result = {'type':'report_run', 'job_id':job.id, 'status':job.status, **(job.result or {})}
    if job.status == 'completed':
        if job.definition.get('version') == 2:
            from .report_runs import page
            result.update(page(job, offset, limit))
        if job.file_name:
            result['download_path'] = f'/api/v1/agent/jobs/{job.id}/download'
    return result


def wait_for_report(db, auth, job, context, *, offset=0, limit=25):
    job = db.query(AgentJob).filter_by(id=job.id).populate_existing().with_for_update().one()
    if job.status in TERMINAL:
        return _result(job, offset, limit)
    reference = context.get('completion_reference')
    if not isinstance(reference, dict) or not all(reference.get(key) for key in ('invocation_id','completion_ref','artifact_id')):
        raise ArtifactInvocationError('The platform completion contract is required.', code='PLATFORM_COMPLETION_REQUIRED')
    callbacks = dict(job.platform_callbacks or {})
    key = str(reference['invocation_id'])
    payload = {field:str(reference[field]) for field in ('invocation_id','completion_ref','artifact_id')}
    payload.update(offset=offset, limit=limit, attempts=0, delivered=False)
    if key in callbacks:
        if any(callbacks[key].get(field) != payload[field] for field in ('completion_ref','artifact_id','offset','limit')):
            raise ArtifactInvocationError('A report completion reference was reused.', code='REPORT_COMPLETION_CONFLICT')
    else:
        if len(callbacks) >= 32:
            raise ArtifactInvocationError('Too many active report waiters.', code='REPORT_COMPLETION_LIMIT')
        callbacks[key] = payload
    job.platform_callbacks, job.completion_retry_at = callbacks, now()
    db.commit()
    return pending_result(job.id)


def queued_report(db, auth, context, enqueue):
    # Check before creating business work. No legacy polling fallback is installed.
    reference=context.get('completion_reference')
    if not isinstance(reference, dict) or not all(reference.get(key) for key in ('invocation_id','completion_ref','artifact_id')):
        raise ArtifactInvocationError('The platform completion contract is required.', code='PLATFORM_COMPLETION_REQUIRED')
    value = enqueue(db, auth)
    if value.get('job_id') is None: return value
    from EndPoints.agent import owned_job
    job = owned_job(db, auth, value['job_id'])
    return wait_for_report(db, auth, job, context)


@lru_cache(maxsize=1)
def _client():
    from agents24 import Agents24
    return Agents24(base_url=setting('AGENTS24_BASE_URL'), api_key=setting('AGENTS24_API_KEY'), timeout=5)


def deliver_one(sessions, *, clinic_ids=None, sdk=None):
    """Lease a terminal job, release its DB connection, then send one idempotent receipt."""
    with sessions() as db:
        query = db.query(AgentJob).filter(AgentJob.kind=='report', AgentJob.status.in_(TERMINAL),
            AgentJob.completion_retry_at.isnot(None), AgentJob.completion_retry_at <= now())
        if clinic_ids is not None: query=query.filter(AgentJob.clinic_id.in_(clinic_ids))
        job = query.order_by(AgentJob.completion_retry_at).with_for_update(skip_locked=True).first()
        if job is None: return False
        callbacks = dict(job.platform_callbacks or {})
        chosen = next(((key,value) for key,value in callbacks.items() if not value.get('delivered') and not value.get('blocked')), None)
        if chosen is None:
            job.completion_retry_at=None;db.commit();return False
        key, callback = chosen
        callback = dict(callback)
        if 'result' not in callback:
            try:
                callback['result'] = _result(job, callback['offset'], callback['limit'])
            except HTTPException as error:
                if error.status_code != 410: raise
                callback['result'] = {'type':'report_run','job_id':job.id,'status':'failed','code':'REPORT_RESULT_EXPIRED'}
            callbacks[key] = callback
            job.platform_callbacks = callbacks
        identity = job.id
        payload = {field:callback[field] for field in ('artifact_id','completion_ref')}
        payload.update(external_job_ref=job.id, result=callback['result'])
        job.completion_retry_at=now()+timedelta(seconds=30)
        db.commit()
    retry_hint = 0
    blocked = False
    try:
        (sdk or _client()).embed.complete_tool_invocation(key, payload)
        delivered=True
    except Exception as error:
        from agents24.errors import Agents24SDKError
        if isinstance(error, Agents24SDKError):
            blocked = error.status in {400, 401, 403, 404, 409, 422}
            hint = (error.failure or {}).get('retry_after_ms')
            if isinstance(hint, (int, float)) and 0 <= hint < float('inf'): retry_hint = hint / 1000
        # The exact immutable result will be resent. Uncertain HTTP delivery is
        # harmless because the platform compares this invocation's result digest.
        delivered=False
        logger.warning('report_completion_pending')
    with sessions() as db:
        job=db.query(AgentJob).filter_by(id=identity).with_for_update().one()
        callbacks=dict(job.platform_callbacks or {})
        current=dict(callbacks[key])
        current.update(attempts=int(current.get('attempts',0))+1, delivered=delivered, blocked=blocked)
        callbacks[key]=current;job.platform_callbacks=callbacks
        if all(item.get('delivered') or item.get('blocked') for item in callbacks.values()): job.completion_retry_at=None
        elif delivered: job.completion_retry_at=now()
        else: job.completion_retry_at=now()+timedelta(seconds=max(retry_hint, min(60,2**min(current['attempts'],5))+random.random()))
        db.commit()
    return True
