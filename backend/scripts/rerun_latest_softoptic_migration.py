"""Queue the latest completed SoftOptic bundle for a different staging clinic.

Usage:
    PYTHONPATH=backend backend/.venv/bin/python \
      backend/scripts/rerun_latest_softoptic_migration.py --clinic-id 59 --execute
"""
from __future__ import annotations

import argparse
import sys
import uuid
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from database import SessionLocal  # noqa: E402
from models import Clinic, SoftOpticMigrationJob, User  # noqa: E402
from services.file_storage_service import get_file_storage_service  # noqa: E402
from services.softoptic_migration_service import (  # noqa: E402
    SOFTOPTIC_SOURCE_SYSTEM,
    create_job,
    mark_bundle_uploaded,
)


def latest_reusable_job(db):
    return (
        db.query(SoftOpticMigrationJob)
        .filter(SoftOpticMigrationJob.source_system == SOFTOPTIC_SOURCE_SYSTEM)
        .filter(SoftOpticMigrationJob.status == "completed")
        .filter(SoftOpticMigrationJob.bundle_storage_bucket.isnot(None))
        .filter(SoftOpticMigrationJob.bundle_storage_key.isnot(None))
        .order_by(
            SoftOpticMigrationJob.updated_at.desc(),
            SoftOpticMigrationJob.created_at.desc(),
        )
        .first()
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Queue the latest completed SoftOptic migration bundle for a target clinic."
    )
    parser.add_argument("--clinic-id", required=True, type=int)
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Create and queue the job. Without this flag, only validate and preview.",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        source = latest_reusable_job(db)
        clinic = db.get(Clinic, args.clinic_id)
        if not source:
            raise SystemExit("No completed SoftOptic migration job with a reusable bundle was found.")
        if not clinic:
            raise SystemExit(f"Clinic {args.clinic_id} was not found.")
        if not clinic.is_active:
            raise SystemExit(f"Clinic {args.clinic_id} is inactive.")
        if source.company_id != clinic.company_id:
            raise SystemExit("The source bundle and target clinic belong to different companies.")
        if db.query(SoftOpticMigrationJob.id).filter(
            SoftOpticMigrationJob.clinic_id == clinic.id,
            SoftOpticMigrationJob.status.in_(("awaiting_upload", "queued", "running", "paused")),
        ).first():
            raise SystemExit(f"Clinic {clinic.id} already has an active migration job.")

        user = db.get(User, source.user_id) if source.user_id else None
        if not user or user.company_id != clinic.company_id or not user.is_active:
            raise SystemExit("The latest migration's user is unavailable for the target company.")

        storage = get_file_storage_service()
        if not storage.exists(source.bundle_storage_bucket, source.bundle_storage_key):
            raise SystemExit("The latest migration bundle is no longer available in storage.")

        print(
            f"source job {source.id} -> clinic {clinic.id} ({clinic.name}); "
            f"documents={source.include_documents}; limit={source.client_import_limit}"
        )
        if not args.execute:
            print("Preview only. Re-run with --execute to queue the migration.")
            return

        job = create_job(
            db,
            job_id=uuid.uuid4().hex,
            clinic=clinic,
            current_user=user,
            source_metadata=dict(source.source_metadata or {}),
            export_summary=dict(source.export_summary or {}),
            include_documents=bool(source.include_documents),
            client_import_limit=source.client_import_limit,
            source_system=source.source_system,
            bundle_format_version=source.bundle_format_version,
            source_fingerprint=source.source_fingerprint,
        )
        mark_bundle_uploaded(
            db,
            job=job,
            bucket=source.bundle_storage_bucket,
            key=source.bundle_storage_key,
        )
        print(f"Queued job {job.id} for clinic {clinic.id}.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
