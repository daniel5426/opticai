"""API-owned consumer for manual exports, with no Agents24 dependency at runtime."""
import asyncio
import logging
import threading
import uuid
from contextlib import asynccontextmanager
from datetime import timedelta

from database import SessionLocal
from agent.config import now
from agent.models import AgentJob
from services import table_exports as exports

logger = logging.getLogger(__name__)


def run_once(worker, stop, sessions=SessionLocal):
    from services.leased_jobs import claim_job
    with sessions() as db:
        job = claim_job(db, worker, ('table_export',))
        if not job:
            return False
        job_id = job.id
        if exports.is_expired(job):
            job.status = 'cancelled'
            db.commit()
            return True
        try:
            # Claim is committed. Source reads belong to a single fresh snapshot.
            db.rollback()
            if db.get_bind().dialect.name == 'postgresql':
                db.connection(execution_options={'isolation_level': 'REPEATABLE READ'})
            def cancelled():
                if stop.is_set():
                    return True
                with sessions() as control:
                    row = control.get(AgentJob, job_id)
                    if not row or row.status != 'running' or row.worker != worker:
                        return True
                    row.lease_until = now() + timedelta(minutes=12)
                    control.commit()
                return False
            result = exports.materialize(db, db.get(AgentJob, job_id), cancelled)
            db.rollback()
            with sessions() as control:
                control.query(AgentJob).filter_by(id=job_id, worker=worker, status='running').update(
                    {'status': 'completed', 'result': result, 'updated_at': now()}, synchronize_session=False)
                control.commit()
        except exports.Interrupted:
            db.rollback()
            with sessions() as control:
                if stop.is_set():
                    control.query(AgentJob).filter_by(id=job_id, worker=worker, status='running').update(
                        {'status': 'queued', 'lease_until': None}, synchronize_session=False)
                    control.commit()
        except Exception as error:
            db.rollback()
            code = getattr(error, 'detail', 'tableExport.failed')
            if not isinstance(code, str) or not code.startswith('tableExport.'):
                code = 'tableExport.failed'
            with sessions() as control:
                control.query(AgentJob).filter_by(id=job_id, worker=worker, status='running').update(
                    {'status': 'failed', 'result': {'error': code}, 'updated_at': now()}, synchronize_session=False)
                control.commit()
            logger.warning('table_export_failed job=%s type=%s', job_id, type(error).__name__)
        return True


def cleanup(sessions=SessionLocal):
    with sessions() as db:
        jobs = db.query(AgentJob).filter(AgentJob.kind == 'table_export', AgentJob.expires_at < now(), AgentJob.definition['retention_cleaned'].as_boolean().is_not(True)).limit(50).all()
        for job in jobs:
            for path in exports.paths(job):
                path.unlink(missing_ok=True)
                for temporary in path.parent.glob(path.name + '.part*'):
                    temporary.unlink(missing_ok=True)
            if job.status in ('queued', 'running'):
                job.status = 'cancelled'
            job.result = None
            job.definition = {**job.definition, 'retention_cleaned': True}
        db.commit()


def loop(stop):
    worker = 'table-export-' + uuid.uuid4().hex
    iteration = 0
    while not stop.is_set():
        try:
            if iteration % 60 == 0:
                cleanup()
            worked = run_once(worker, stop)
            iteration += 1
        except Exception:
            # A database outage is retried without taking down the web API.
            logger.warning('table_export_worker_unavailable')
            worked = False
        if not worked:
            stop.wait(5)


@asynccontextmanager
async def table_export_services():
    from database import engine
    # In-memory SQLite cannot share independent API/control transactions safely.
    # Isolated tests run the consumer explicitly against their own session factory.
    if engine.dialect.name == 'sqlite' and engine.url.database in (None, '', ':memory:'):
        yield
        return
    stop = threading.Event()
    thread = threading.Thread(target=loop, args=(stop,), name='table-exports', daemon=True)
    thread.start()
    try:
        yield
    finally:
        stop.set()
        await asyncio.to_thread(thread.join, 15)
