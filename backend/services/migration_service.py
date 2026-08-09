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


class OptiTechPauseRequested(RuntimeError):
    pass


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
    if format_version not in (None, 1, 2):
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
    documents = manifest.get("documents") if isinstance(manifest.get("documents"), dict) else {}
    for document in documents.get("files") or []:
        relative = document.get("file")
        if not isinstance(relative, str) or not relative:
            raise RuntimeError("Migration manifest contains an invalid document path")
        file_path = (root / relative).resolve()
        if root.resolve() not in file_path.parents or not file_path.is_file():
            raise RuntimeError(f"Migration document is missing: {relative}")
        expected_hash = document.get("sha256")
        if expected_hash and hashlib.sha256(file_path.read_bytes()).hexdigest().lower() != str(expected_hash).lower():
            raise RuntimeError(f"Migration document checksum mismatch: {relative}")
    return manifest


def validate_optitech_client_selection(
    tables_dir: Path,
    manifest: dict[str, Any],
    client_limit: Optional[int],
) -> set[int]:
    clients_path = tables_dir / "tblPerData.csv"
    if not clients_path.exists():
        clients_path = tables_dir / "tblPerData.tsv"
    delimiter = "\t" if clients_path.suffix.lower() == ".tsv" else ","
    with clients_path.open("r", newline="", encoding="utf-8-sig") as handle:
        client_ids = sorted(
            {
                int(row["PerId"])
                for row in csv.DictReader(handle, delimiter=delimiter)
                if row.get("PerId") not in (None, "")
            }
        )
    if client_limit is not None and len(client_ids) > client_limit:
        raise RuntimeError("OptiTech bundle exceeds the requested client limit")
    manifest_ids = manifest.get("selected_client_ids")
    if isinstance(manifest_ids, list):
        normalized_manifest_ids = [int(value) for value in manifest_ids]
        if normalized_manifest_ids != client_ids:
            raise RuntimeError("OptiTech manifest client selection is not the ascending tblPerData selection")

    dependent = {
        "tblCrdGlassChecks": "PerId",
        "tblCrdGlassChecksPrevs": "PerId",
        "tblCrdClensChecks": "PerId",
        "tblCrdBuysWorks": "PerId",
        "tblPerPicture": "PerId",
        "tblCrdDiags": "PerId",
        "tblClndrApt": "PerID",
    }
    selected = set(client_ids)
    for table, column in dependent.items():
        path = tables_dir / f"{table}.csv"
        if not path.exists():
            path = tables_dir / f"{table}.tsv"
        if not path.exists():
            continue
        table_delimiter = "\t" if path.suffix.lower() == ".tsv" else ","
        with path.open("r", newline="", encoding="utf-8-sig") as handle:
            for row in csv.DictReader(handle, delimiter=table_delimiter):
                raw = row.get(column)
                if raw not in (None, "") and int(float(raw)) not in selected:
                    raise RuntimeError(f"{table} contains a client outside the selected import set")
    return selected


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
        if manifest.get("format_version") != 2:
            raise RuntimeError("OptiTech imports require bundle format_version 2")
        if manifest.get("mapping_version") != 2:
            raise RuntimeError("OptiTech imports require mapping_version 2")
        manifest_fingerprint = manifest.get("source_fingerprint")
        if not isinstance(manifest_fingerprint, str) or not manifest_fingerprint:
            raise RuntimeError("OptiTech bundle is missing source_fingerprint")
        if job.source_fingerprint and job.source_fingerprint != manifest_fingerprint:
            raise RuntimeError("OptiTech source fingerprint does not match the import job")
        tables_dir = extracted / "tables"
        if not tables_dir.exists():
            tables_dir = extracted
        documents_dir = extracted / "documents"
        reports_dir = temp_dir / "reports"
        selected_client_ids = validate_optitech_client_selection(
            tables_dir,
            manifest,
            job.client_import_limit,
        )

        on_progress(
            step="Validating OptiTech export",
            progress=18,
            validation_summary={"manifest": manifest, "selected_client_count": len(selected_client_ids)},
            heartbeat=True,
        )
        checkpoint = dict(job.checkpoint or {})
        completed = set(checkpoint.get("completed_phases") or [])
        summaries: dict[str, Any] = dict(job.import_summary or {})
        manifest_documents = manifest.get("documents") if isinstance(manifest.get("documents"), dict) else {}
        summaries["export"] = {
            "mapping_version": manifest.get("mapping_version", 2),
            "selected_client_count": len(selected_client_ids),
            "document_count": manifest_documents.get("file_count", 0),
            "missing_referenced_scans": manifest_documents.get("missing_referenced_count", 0),
            "unreferenced_scans": manifest_documents.get("unreferenced_file_count", 0),
        }

        with use_bundle_paths(tables_dir, documents_dir if documents_dir.exists() else None):
            if "optitech_phase2" not in completed:
                on_progress(
                    step="Importing OptiTech clients and users",
                    progress=30,
                    checkpoint={"optitech_phase2_started": True},
                    heartbeat=True,
                )
                def on_foundation_batch(domain: str, counts: dict[str, int]) -> None:
                    db.refresh(job)
                    batch_counts = dict((job.checkpoint or {}).get("optitech_batch_counts") or {})
                    batch_counts[domain] = counts
                    foundation_domains = ("families", "clients", "users")
                    domain_index = foundation_domains.index(domain) if domain in foundation_domains else 0
                    on_progress(
                        step=f"Importing OptiTech: {domain}",
                        progress=30 + round(15 * (domain_index + 1) / len(foundation_domains)),
                        checkpoint={"optitech_batch_counts": batch_counts},
                        import_summary={**summaries, "live_counts": batch_counts},
                        heartbeat=True,
                    )
                    if pause_if_requested(db, job):
                        raise OptiTechPauseRequested()

                result = execute_phase2(
                    target_clinic_id=job.clinic_id,
                    report_dir=reports_dir / "phase2",
                    migration_job_id=job.id,
                    source_fingerprint=job.source_fingerprint or manifest_fingerprint,
                    on_batch_progress=on_foundation_batch,
                )
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
                def on_clinical_batch(domain: str, counts: dict[str, int]) -> None:
                    db.refresh(job)
                    batch_counts = dict((job.checkpoint or {}).get("optitech_batch_counts") or {})
                    batch_counts[domain] = counts
                    clinical_domains = (
                        "glasses_exams", "contact_lens_exams", "orders", "files",
                        "medical_notes", "appointments", "work_shifts",
                    )
                    domain_index = clinical_domains.index(domain) if domain in clinical_domains else 0
                    on_progress(
                        step=f"Importing OptiTech: {domain}",
                        progress=55 + round(38 * (domain_index + 1) / len(clinical_domains)),
                        checkpoint={"optitech_batch_counts": batch_counts},
                        import_summary={**summaries, "live_counts": batch_counts},
                        heartbeat=True,
                    )
                    if pause_if_requested(db, job):
                        raise OptiTechPauseRequested()

                result = execute_phase3(
                    target_clinic_id=job.clinic_id,
                    report_dir=reports_dir / "phase3",
                    storage=storage,
                    migration_job_id=job.id,
                    on_batch_progress=on_clinical_batch,
                )
                summaries["phase3"] = result["summary"]
                completed.add("optitech_phase3")
                checkpoint["completed_phases"] = sorted(completed)
                on_progress(import_summary=summaries, checkpoint=checkpoint, progress=96, heartbeat=True)

        if storage and reports_dir.exists():
            report_archive = Path(shutil.make_archive(str(temp_dir / f"optitech-report-{job.id}"), "zip", reports_dir))
            report_bucket = job.bundle_storage_bucket or "migration-bundles"
            report_key = f"migration-reports/{job.company_id}/{job.clinic_id}/{job.id}.zip"
            if storage.exists(report_bucket, report_key):
                storage.remove(report_bucket, report_key)
            storage.upload_path(report_bucket, report_key, report_archive, "application/zip")
            summaries["report"] = {"available": True, "bucket": report_bucket, "key": report_key}

        db.commit()
        if storage and job.bundle_storage_bucket and job.bundle_storage_key:
            try:
                storage.remove(job.bundle_storage_bucket, job.bundle_storage_key)
                job.bundle_storage_bucket = None
                job.bundle_storage_key = None
                summaries["server_bundle_removed"] = True
            except Exception as cleanup_error:
                summaries["server_bundle_removed"] = False
                summaries["server_bundle_cleanup_warning"] = str(cleanup_error)
        on_progress(status="completed", step="Completed", progress=100, import_summary=summaries)
    except OptiTechPauseRequested:
        return
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
