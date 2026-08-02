from __future__ import annotations

import csv
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
from typing import Any, Callable, Optional

from sqlalchemy.orm import Session

from models import SoftOpticMigrationJob
from services.file_storage_service import FileStorageService
from services.softoptic_migration_service import (
    _safe_extract_zip,
    pause_if_requested,
    run_softoptic_import,
    update_job,
)


SUPPORTED_SOURCE_SYSTEMS = {"softoptic", "optitech"}


def _count_manifest_rows(path: Path) -> int:
    delimiter = "\t" if path.suffix.lower() == ".tsv" else ","
    with path.open("r", newline="", encoding="utf-8-sig") as handle:
        reader = csv.reader(handle, delimiter=delimiter)
        return max(0, sum(1 for _ in reader) - 1)


def read_bundle_manifest(root: Path) -> dict[str, Any]:
    path = root / "manifest.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8-sig"))


def validate_versioned_manifest(root: Path, expected_source: str) -> dict[str, Any]:
    manifest = read_bundle_manifest(root)
    if not manifest:
        if expected_source == "softoptic":
            return {"legacy": True}
        raise RuntimeError("Migration bundle is missing manifest.json")
    source_system = manifest.get("source_system")
    if source_system and source_system != expected_source:
        raise RuntimeError("Migration bundle source does not match the job")
    format_version = manifest.get("format_version")
    if format_version not in (None, 1):
        raise RuntimeError(f"Unsupported migration bundle format: {format_version}")
    for table in manifest.get("tables") or []:
        relative = table.get("file")
        if not isinstance(relative, str) or not relative:
            raise RuntimeError("Migration manifest contains an invalid table path")
        file_path = (root / relative).resolve()
        if root.resolve() not in file_path.parents or not file_path.is_file():
            raise RuntimeError(f"Migration table is missing: {relative}")
        expected_hash = table.get("sha256")
        if expected_hash:
            actual = hashlib.sha256(file_path.read_bytes()).hexdigest()
            if actual.lower() != str(expected_hash).lower():
                raise RuntimeError(f"Migration table checksum mismatch: {relative}")
        expected_rows = table.get("row_count")
        if isinstance(expected_rows, int) and _count_manifest_rows(file_path) != expected_rows:
            raise RuntimeError(f"Migration table row count mismatch: {relative}")
    return manifest


def run_optitech_import(
    db: Session,
    *,
    job: SoftOpticMigrationJob,
    storage: Optional[FileStorageService],
    on_progress: Callable[..., None],
) -> None:
    from migration.optitech.src.phase2 import execute_phase2
    from migration.optitech.src.phase3 import execute_phase3
    from migration.optitech.src.reader import use_bundle_paths

    temp_dir = Path(tempfile.mkdtemp(prefix=f"optitech_{job.id}_"))
    try:
        bundle_path = temp_dir / "bundle.zip"
        if job.bundle_storage_bucket and job.bundle_storage_key:
            if not storage:
                raise RuntimeError("Storage service is required to download migration bundle")
            storage.download_to_path(job.bundle_storage_bucket, job.bundle_storage_key, bundle_path)
        elif job.bundle_path:
            bundle_path = Path(job.bundle_path)
        else:
            raise RuntimeError("Migration bundle is missing")

        extracted = temp_dir / "bundle"
        _safe_extract_zip(bundle_path, extracted)
        manifest = validate_versioned_manifest(extracted, "optitech")
        tables_dir = extracted / "tables"
        if not tables_dir.exists():
            tables_dir = extracted
        documents_dir = extracted / "documents"
        reports_dir = temp_dir / "reports"

        on_progress(step="Validating OptiTech export", progress=18, validation_summary={"manifest": manifest}, heartbeat=True)
        checkpoint = dict(job.checkpoint or {})
        completed = set(checkpoint.get("completed_phases") or [])
        summaries: dict[str, Any] = dict(job.import_summary or {})

        with use_bundle_paths(tables_dir, documents_dir if documents_dir.exists() else None):
            if "optitech_phase2" not in completed:
                on_progress(
                    step="Importing OptiTech clients and users",
                    progress=30,
                    checkpoint={"optitech_phase2_started": True},
                    heartbeat=True,
                )
                result = execute_phase2(target_clinic_id=job.clinic_id, report_dir=reports_dir / "phase2")
                summaries["phase2"] = result["summary"]
                completed.add("optitech_phase2")
                checkpoint["completed_phases"] = sorted(completed)
                on_progress(import_summary=summaries, checkpoint=checkpoint, progress=48, heartbeat=True)
                if pause_if_requested(db, job):
                    return

            if "optitech_phase3" not in completed:
                on_progress(
                    step="Importing OptiTech clinical data",
                    progress=55,
                    checkpoint={"optitech_phase3_started": True},
                    heartbeat=True,
                )
                result = execute_phase3(
                    target_clinic_id=job.clinic_id,
                    report_dir=reports_dir / "phase3",
                    storage=storage,
                )
                summaries["phase3"] = result["summary"]
                completed.add("optitech_phase3")
                checkpoint["completed_phases"] = sorted(completed)
                on_progress(import_summary=summaries, checkpoint=checkpoint, progress=96, heartbeat=True)

        on_progress(status="completed", step="Completed", progress=100, import_summary=summaries)
    except Exception as exc:
        db.rollback()
        on_progress(
            status="failed",
            step="Failed",
            errors=[str(exc)],
            error=str(exc),
            checkpoint={**dict(job.checkpoint or {}), "failed": True},
        )
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def run_migration_import(
    db: Session,
    *,
    job: SoftOpticMigrationJob,
    storage: Optional[FileStorageService],
    on_progress: Callable[..., None],
) -> None:
    source_system = getattr(job, "source_system", None) or "softoptic"
    if source_system == "softoptic":
        run_softoptic_import(db, job=job, storage=storage, on_progress=on_progress)
        return
    if source_system == "optitech":
        run_optitech_import(db, job=job, storage=storage, on_progress=on_progress)
        return
    update_job(db, job, status="failed", step="Failed", error=f"Unsupported source system: {source_system}")
