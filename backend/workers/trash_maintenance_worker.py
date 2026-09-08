from __future__ import annotations

import logging
import os
import socket
import time
from uuid import uuid4

import config
from database import SessionLocal
from services.file_storage_service import get_file_storage_service
from services.trash_service import claim_next_job, enqueue_expired_items, run_job


logger = logging.getLogger("trash_maintenance_worker")
logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))

POLL_SECONDS = float(os.environ.get("TRASH_WORKER_POLL_SECONDS", "5"))


def worker_id() -> str:
    return os.environ.get("TRASH_WORKER_ID") or f"trash-{socket.gethostname()}-{os.getpid()}-{uuid4().hex[:8]}"


def run_once(worker_name: str) -> bool:
    db = SessionLocal()
    try:
        if config.settings.TRASH_PURGE_ENABLED:
            enqueue_expired_items(db)
        job = claim_next_job(db, worker_name, allow_purge=config.settings.TRASH_PURGE_ENABLED)
        if not job:
            return False
        run_job(db, job, get_file_storage_service())
        return True
    except Exception:
        logger.exception("Trash maintenance worker iteration failed")
        return False
    finally:
        db.close()


def main() -> None:
    name = worker_id()
    logger.info("Trash maintenance worker started id=%s purge_enabled=%s", name, config.settings.TRASH_PURGE_ENABLED)
    while True:
        if not run_once(name):
            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
