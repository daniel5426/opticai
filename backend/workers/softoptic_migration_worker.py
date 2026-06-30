from __future__ import annotations

import logging
import os
import socket
import time
from uuid import uuid4

from database import SessionLocal
from models import SoftOpticMigrationJob
from services.file_storage_service import get_file_storage_service
from services.softoptic_migration_service import claim_next_job, run_softoptic_import, update_job


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

        logger.info("Running SoftOptic migration job %s", job.id)
        run_softoptic_import(db, job=job, storage=storage, on_progress=on_progress)
        logger.info("Finished SoftOptic migration job %s status=%s", job.id, job.status)
        return True
    except Exception:
        logger.exception("SoftOptic worker iteration failed")
        return False
    finally:
        db.close()


def main() -> None:
    name = os.environ.get("SOFTOPTIC_WORKER_ID") or worker_id()
    logger.info("SoftOptic migration worker started id=%s", name)
    while True:
        did_work = run_once(name)
        if not did_work:
            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
