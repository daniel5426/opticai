from __future__ import annotations

import logging
import os
import socket
import time
from uuid import uuid4

from sqlalchemy import inspect

from database import SessionLocal
import config
from models import SoftOpticMigrationJob
from services.file_storage_service import get_file_storage_service
from services.inventory_discovery_service import claim_next_discovery_job, run_discovery_job
from services.migration_service import run_migration_import
from services.clinic_data_prune_service import claim_next_prune_job, run_prune_job
from services.softoptic_migration_service import claim_next_job, update_job
from services.trash_service import claim_next_job as claim_next_trash_job, enqueue_expired_items, run_job as run_trash_job


logger = logging.getLogger("softoptic_migration_worker")
logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))


POLL_SECONDS = float(os.environ.get("SOFTOPTIC_WORKER_POLL_SECONDS", "5"))


def worker_id() -> str:
    return f"{socket.gethostname()}-{os.getpid()}-{uuid4().hex[:8]}"


def run_once(worker_name: str) -> bool:
    db = SessionLocal()
    try:
        job = claim_next_job(db, worker_name)
        if not job:
            return False

        storage = get_file_storage_service()

        def on_progress(**kwargs):
            current = db.get(SoftOpticMigrationJob, job.id)
            if current:
                update_job(db, current, **kwargs)

        logger.info("Running %s migration job %s", getattr(job, "source_system", "softoptic"), job.id)
        run_migration_import(db, job=job, storage=storage, on_progress=on_progress)
        logger.info("Finished migration job %s status=%s", job.id, job.status)
        return True
    except Exception:
        logger.exception("SoftOptic worker iteration failed")
        return False
    finally:
        db.close()


def run_prune_once(worker_name: str) -> bool:
    db = SessionLocal()
    try:
        job = claim_next_prune_job(db, worker_name)
        if not job:
            return False
        storage = get_file_storage_service()
        logger.info("Running clinic data prune job %s", job.id)
        run_prune_job(db, job, storage)
        return True
    except Exception:
        logger.exception("Clinic data prune worker iteration failed")
        return False
    finally:
        db.close()


def run_catalog_discovery_once(worker_name: str) -> bool:
    db = SessionLocal()
    try:
        job = claim_next_discovery_job(db, worker_name)
        if not job:
            return False
        logger.info("Running catalog discovery job %s status=%s", job.id, job.status)
        run_discovery_job(db, job)
        logger.info("Finished catalog discovery job %s status=%s", job.id, job.status)
        return True
    except Exception:
        logger.exception("Catalog discovery worker iteration failed")
        return False
    finally:
        db.close()


def run_trash_once(worker_name: str) -> bool:
    db = SessionLocal()
    try:
        if config.settings.TRASH_PURGE_ENABLED:
            enqueue_expired_items(db)
        job = claim_next_trash_job(db, worker_name, allow_purge=config.settings.TRASH_PURGE_ENABLED)
        if not job:
            return False
        run_trash_job(db, job, get_file_storage_service())
        return True
    except Exception:
        logger.exception("Trash maintenance worker iteration failed")
        return False
    finally:
        db.close()


def available_optional_queues(bind) -> set[str]:
    tables = set(inspect(bind).get_table_names())
    requirements = {
        "trash": {"trash_items", "trash_members", "trash_jobs", "trash_audit_events"},
        "catalog": {"catalog_discovery_runs", "catalog_discovery_candidates", "catalog_discovery_sources", "catalog_order_observations"},
    }
    available = set()
    for queue, required in requirements.items():
        if required <= tables:
            available.add(queue)
        else:
            logger.warning("Skipping %s queue until migrations finish and worker restarts; missing tables: %s", queue, sorted(required - tables))
    return available


def poll_once(worker_name: str, optional_queues: set[str]) -> bool:
    return (
        ("trash" in optional_queues and run_trash_once(worker_name))
        or run_prune_once(worker_name)
        or ("catalog" in optional_queues and run_catalog_discovery_once(worker_name))
        or run_once(worker_name)
    )


def main() -> None:
    name = os.environ.get("SOFTOPTIC_WORKER_ID") or worker_id()
    with SessionLocal() as db:
        optional_queues = available_optional_queues(db.get_bind())
    logger.info("SoftOptic migration worker started id=%s", name)
    while True:
        did_work = poll_once(name, optional_queues)
        if not did_work:
            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
