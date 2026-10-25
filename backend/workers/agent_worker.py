"""Separate leased queues for requested work and scheduled daily summaries."""
import argparse
import json
import logging
import os
import time
import uuid
from datetime import timedelta
from sqlalchemy import or_, and_
from sqlalchemy.exc import OperationalError, DisconnectionError, TimeoutError as DatabaseTimeout
from pydantic import BaseModel, Field
from database import SessionLocal
from agent.config import now, enabled, data_directory
from agent.models import AgentJob, AgentContext
from agent.authority import resolve_artifact, Authority
from agent.daily import enqueue_daily, snapshot
from agent.reports import export_report
from agent.runtime import run_text, agent_id
from models import User
from agent.failures import job_failure

logger = logging.getLogger(__name__)


class BriefItem(BaseModel):
    category: str
    title: str
    detail: str
    sources: list[dict] = Field(default_factory=list)


class DailyBrief(BaseModel):
    greeting: str
    items: list[BriefItem] = Field(min_length=1, max_length=12)


QUEUES = {'requested': ('report', 'document', 'library_document'), 'summaries': ('brief',)}


def claim(db, worker, queue='requested', clinic_ids=None):
    query = db.query(AgentJob).filter(AgentJob.kind.in_(QUEUES[queue]))
    if clinic_ids is not None:
        query = query.filter(AgentJob.clinic_id.in_(clinic_ids))
    row = query.filter(or_(AgentJob.status == 'queued',
        and_(AgentJob.status == 'running', AgentJob.lease_until < now()))).order_by(AgentJob.created_at).with_for_update(skip_locked=True).first()
    if row:
        row.worker, row.status, row.lease_until = worker, 'running', now() + timedelta(minutes=12)
        row.updated_at = now()
        db.commit()
    return row


def run_once(worker, queue='requested', clinic_ids=None):
    with SessionLocal() as db:
        if queue == 'summaries':
            enqueue_daily(db, clinic_ids=clinic_ids)
        if int(time.time()) % 60 < 5:
            try:
                from agent.retention import cleanup_expired
                cleanup_expired(db, clinic_ids=clinic_ids)
            except Exception:
                db.rollback()
                logger.warning('agent_retention_cleanup_pending')
        row = claim(db, worker, queue, clinic_ids)
        if not row:
            return False
        try:
            if row.kind == 'report':
                # All report source queries see the same committed database snapshot.
                if row.definition.get('version') == 2 and db.get_bind().dialect.name == 'postgresql':
                    db.rollback()  # Claim was committed; discard its lazy refresh transaction.
                    db.connection(execution_options={'isolation_level': 'REPEATABLE READ'})
                auth = resolve_artifact(db, {'external_session_id': row.context_id})
                export_report(db, auth, row)
            elif row.kind == 'brief':
                auth = resolve_artifact(db, {'external_session_id': 'brief:' + row.id})
                if not row.definition.get('prompt'):
                    facts = snapshot(db, auth, row.business_date)
                    row.definition = {**row.definition, 'prompt': json.dumps({'locale': row.locale, 'clinic_day': facts,
                        'output_schema': DailyBrief.model_json_schema()}, ensure_ascii=False)}
                    db.commit()
                def admitted(value):
                    row.run_id, row.thread_id = value['run_id'], value.get('thread_id')
                    db.commit()
                def cancelled():
                    db.refresh(row)
                    return row.status == 'cancelled'
                text = run_text(agent_id('AGENTS24_BRIEF_AGENT_ID'), row.definition['prompt'],
                    subject=f'brief:{row.company_id}:{row.clinic_id}', session_id='brief:' + row.id,
                    scope=f'brief:{row.clinic_id}:{row.business_date}:{row.locale}', request_key=row.definition.get('attempt_key', row.id), on_admitted=admitted, existing_run_id=row.run_id, existing_thread_id=row.thread_id, cancel_check=cancelled)
                db.refresh(row)
                if row.status == 'cancelled':
                    return True
                result = DailyBrief.model_validate_json(text).model_dump()
                facts = json.loads(row.definition['prompt'])['clinic_day']
                allowed_paths = set()
                def collect(value):
                    if isinstance(value, dict):
                        if isinstance(value.get('path'), str):
                            allowed_paths.add(value['path'])
                        for nested in value.values(): collect(nested)
                    elif isinstance(value, list):
                        for nested in value: collect(nested)
                collect(facts)
                if any(source.get('path') not in allowed_paths for item in result['items'] for source in item['sources']):
                    raise ValueError('Brief has unsupported sources')
                row.result = result
                row.definition = {key: value for key, value in row.definition.items() if key != 'prompt'}
                row.status, row.updated_at = 'completed', now()
                db.commit()
            elif row.kind == 'document':
                from agent.documents import process_document
                process_document(db, row)
            elif row.kind == 'library_document':
                from agent.document_library import process
                process(db, row)
        except Exception as error:
            db.rollback()
            db.refresh(row)
            if row.status != 'cancelled':
                row.status, row.result, row.updated_at = 'failed', job_failure(error), now()
                db.commit()
                if row.kind == 'library_document':
                    from agent.models import DocumentIndex
                    mapping = db.get(DocumentIndex, row.definition.get('mapping_id'))
                    if mapping:
                        mapping.status, mapping.updated_at = 'failed', now()
                        db.commit()
            logger.warning('agent_job_failed kind=%s code=agent.jobFailed', row.kind)
        return True


def run_worker_loop(worker, queue, clinic_ids=None):
    from agent.process_owner import require_process_owner
    delay = 5
    while True:
        require_process_owner()
        try:
            worked = run_once(worker, queue, clinic_ids)
        except (OperationalError, DisconnectionError, DatabaseTimeout):
            # The failed session has closed. Resume polling durable leases;
            # never replay a dispatched operation directly after connection loss.
            logger.warning('agent_worker_database_unavailable queue=%s retry_seconds=%s', queue, delay)
            time.sleep(delay)
            delay = min(delay * 2, 30)
            continue
        delay = 5
        if not worked:
            time.sleep(5)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--queue', choices=QUEUES, default='requested')
    parser.add_argument('--clinic-id', type=int, action='append', dest='clinic_ids')
    args = parser.parse_args()
    if args.clinic_ids is not None and any(identifier <= 0 for identifier in args.clinic_ids):
        parser.error('--clinic-id must be positive')
    if not enabled():
        raise RuntimeError('Agents24 integration is disabled')
    worker = 'agent-' + args.queue + '-' + uuid.uuid4().hex[:12]
    run_worker_loop(worker, args.queue, args.clinic_ids)


if __name__ == '__main__':
    main()
