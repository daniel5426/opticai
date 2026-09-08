from __future__ import annotations

import logging
import os
import socket
import time
from uuid import uuid4

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


def main() -> None:
    name = os.environ.get("SOFTOPTIC_WORKER_ID") or worker_id()
    logger.info("SoftOptic migration worker started id=%s", name)
    while True:
        did_work = run_trash_once(name) or run_prune_once(name) or run_catalog_discovery_once(name) or run_once(name)
        if not did_work:
            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
