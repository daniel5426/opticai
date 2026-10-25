"""Bounded application originals/results and managed indexed-evidence cleanup."""
from datetime import timedelta
from .config import now, data_directory
from .models import AgentJob
from .runtime import client


def cleanup_expired(db, clinic_ids=None):
    jobs = db.query(AgentJob)
    if clinic_ids is not None:
        jobs = jobs.filter(AgentJob.clinic_id.in_(clinic_ids))
    # Unfinished application upload failures are visible and eventually expire.
    jobs.filter(AgentJob.status == 'uploading', AgentJob.created_at < now() - timedelta(hours=1)).update(
        {'status': 'failed', 'result': {'code': 'agent.documentUnavailable'}}, synchronize_session=False)
    db.commit()
    rows = jobs.filter(AgentJob.expires_at < now(), AgentJob.status.in_(['completed', 'failed', 'cancelled']), AgentJob.definition['retention_cleaned'].as_boolean().is_not(True)).limit(50).all()
    for row in rows:
        if row.definition.get('retention_cleaned'):
            continue
        request = row.definition.get('processing_request', {})
        cleanup_jobs = dict(row.definition.get('cleanup_jobs', {}))
        if request.get('knowledge_namespaces') and row.kind != 'library_document':
            sdk = client()
            for store_id, namespace in request['knowledge_namespaces'].items():
                offset = 0
                while True:
                    page = sdk.knowledge_stores.list_indexed_content(store_id, namespace, content_id=row.id, skip=offset, limit=100)
                    for item in page.get('items', []):
                        if item['id'] not in cleanup_jobs:
                            result = sdk.knowledge_stores.delete_indexed_content(store_id, item['id'],
                                options={'idempotency_key': f"{row.id}-cleanup-{item['id']}"})
                            cleanup_jobs[item['id']] = {'store_id': store_id, 'job_id': result['job_id']}
                            row.definition = {**row.definition, 'cleanup_jobs': cleanup_jobs}
                            db.commit()
                    offset += len(page.get('items', []))
                    if offset >= page.get('total', offset):
                        break
            if any(sdk.knowledge_stores.get_cleanup_job(item['store_id'], item['job_id'])['status'] != 'completed' for item in cleanup_jobs.values()):
                continue
        for name in (row.file_name, row.definition.get('original_name')):
            if name and name.startswith(row.id) and '/' not in name and '\\' not in name:
                (data_directory() / name).unlink(missing_ok=True)
        if row.kind == 'report' and row.definition.get('version') == 2:
            from .report_runs import paths, temporary_paths
            for path in (*paths(row), *temporary_paths(row)):
                path.unlink(missing_ok=True)
        row.file_name, row.result = None, None
        row.definition = {**row.definition, 'retention_cleaned': True}
        db.commit()
