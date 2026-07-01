from __future__ import annotations

import csv
import json
import os
import shutil
import tempfile
import zipfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, Optional
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from models import (
    Appointment,
    Billing,
    BillingPayment,
    Client,
    Clinic,
    ContactLensOrder,
    ExamLayoutInstance,
    Family,
    File,
    LookupCleaningSolution,
    LookupCoating,
    LookupColor,
    LookupContactEyeLensType,
    LookupContactEyeMaterial,
    LookupContactLensType,
    LookupFrameModel,
    LookupLensModel,
    LookupManufacturer,
    LookupMaterial,
    LookupOrderType,
    LookupReferralType,
    LookupRinsingSolution,
    LookupSupplier,
    LookupDisinfectionSolution,
    MedicalLog,
    MigrationSourceLink,
    OpticalExam,
    Order,
    OrderLineItem,
    Referral,
    SoftOpticMigrationJob,
    User,
)
from migration.pipeline.common import get_or_create_admin_user
from migration.pipeline.steps import (
    collect_branch_codes,
    migrate_appointments,
    migrate_clients_and_families,
    migrate_contact_lens_orders,
    migrate_files,
    migrate_lookups,
    migrate_medical_logs,
    migrate_optical_exams,
    migrate_referrals,
    migrate_regular_orders,
    enrich_from_contact_lens_chk,
)
from services.file_storage_service import FileStorageService
from services.prescription_search_index import (
    delete_source_index_rows_bulk,
    rebuild_clinic_prescription_search_index,
)
import config


SOFTOPTIC_SOURCE_SYSTEM = "softoptic"
SOFTOPTIC_JOB_STATUSES = {
    "awaiting_upload",
    "queued",
    "running",
    "paused",
    "completed",
    "failed",
    "cancelled",
}
TERMINAL_JOB_STATUSES = {"completed", "failed", "cancelled"}
SOFTOPTIC_LEASE_SECONDS = int(os.environ.get("SOFTOPTIC_WORKER_LEASE_SECONDS", "120"))
SOFTOPTIC_DELETE_CHUNK_SIZE = int(os.environ.get("SOFTOPTIC_DELETE_CHUNK_SIZE", "1000"))
SOFTOPTIC_BUNDLE_CONTENT_TYPE = "application/zip"
REQUIRED_CSV_FILES = ("account.csv",)
OPTIONAL_CSV_FILES = (
    "optic_eye_tests.csv",
    "optic_glasses_presc.csv",
    "optic_contact_presc.csv",
    "optic_contact_lens_chk.csv",
    "optic_reference.csv",
    "optic_presc_prices.csv",
    "account_files.csv",
    "account_files_blob.csv",
    "account_memos.csv",
    "diary_timetab.csv",
)

TRACKED_CLINIC_MODELS: Dict[str, Any] = {
    "Client": Client,
    "Family": Family,
    "OpticalExam": OpticalExam,
    "ContactLensOrder": ContactLensOrder,
    "Order": Order,
    "Referral": Referral,
    "File": File,
    "MedicalLog": MedicalLog,
    "Appointment": Appointment,
    "LookupSupplier": LookupSupplier,
    "LookupLensModel": LookupLensModel,
    "LookupMaterial": LookupMaterial,
    "LookupColor": LookupColor,
    "LookupCoating": LookupCoating,
    "LookupFrameModel": LookupFrameModel,
    "LookupManufacturer": LookupManufacturer,
    "LookupContactLensType": LookupContactLensType,
    "LookupContactEyeLensType": LookupContactEyeLensType,
    "LookupContactEyeMaterial": LookupContactEyeMaterial,
    "LookupCleaningSolution": LookupCleaningSolution,
    "LookupDisinfectionSolution": LookupDisinfectionSolution,
    "LookupRinsingSolution": LookupRinsingSolution,
    "LookupOrderType": LookupOrderType,
    "LookupReferralType": LookupReferralType,
}

CORE_MODELS: Dict[str, Any] = {
    "Client": Client,
    "OpticalExam": OpticalExam,
    "ContactLensOrder": ContactLensOrder,
    "Order": Order,
    "Referral": Referral,
    "File": File,
    "MedicalLog": MedicalLog,
    "Appointment": Appointment,
}


def utcnow() -> datetime:
    return datetime.utcnow()


def update_job(
    db: Session,
    job: SoftOpticMigrationJob,
    *,
    status: Optional[str] = None,
    step: Optional[str] = None,
    progress: Optional[int] = None,
    warnings: Optional[list[str]] = None,
    errors: Optional[list[str]] = None,
    error: Optional[str] = None,
    validation_summary: Optional[dict[str, Any]] = None,
    import_summary: Optional[dict[str, Any]] = None,
    checkpoint: Optional[dict[str, Any]] = None,
    heartbeat: bool = False,
) -> None:
    if status is not None:
        if status not in SOFTOPTIC_JOB_STATUSES:
            raise ValueError(f"Invalid SoftOptic job status: {status}")
        job.status = status
        if status == "running" and job.started_at is None:
            job.started_at = utcnow()
        if status in TERMINAL_JOB_STATUSES:
            job.finished_at = utcnow()
            job.locked_by = None
            job.lease_until = None
        if status == "paused":
            job.locked_by = None
            job.lease_until = None
        if status == "failed":
            job.last_error_at = utcnow()
    if step is not None:
        job.step = step
    if progress is not None:
        job.progress = max(0, min(100, progress))
    if warnings is not None:
        job.warnings = warnings
    if errors is not None:
        job.errors = errors
    if error is not None:
        job.error = error
    if validation_summary is not None:
        job.validation_summary = validation_summary
    if import_summary is not None:
        job.import_summary = import_summary
    if checkpoint is not None:
        current = dict(job.checkpoint or {})
        current.update(checkpoint)
        job.checkpoint = current
    if heartbeat:
        now = utcnow()
        job.heartbeat_at = now
        job.lease_until = now + timedelta(seconds=SOFTOPTIC_LEASE_SECONDS)
    job.updated_at = utcnow()
    db.add(job)
    db.commit()
    db.refresh(job)


def should_pause(job: SoftOpticMigrationJob) -> bool:
    return bool(job.pause_requested or job.status == "paused")


def pause_if_requested(db: Session, job: SoftOpticMigrationJob) -> bool:
    db.refresh(job)
    if not should_pause(job):
        return False
    update_job(
        db,
        job,
        status="paused",
        step="מושהה",
        progress=job.progress,
        checkpoint={"paused_at": utcnow().isoformat()},
    )
    return True


def mark_checkpoint(
    db: Session,
    job: SoftOpticMigrationJob,
    *,
    phase: str,
    step: str,
    progress: int,
    extra: Optional[dict[str, Any]] = None,
) -> bool:
    checkpoint = {"phase": phase, "completed_phases": sorted(set((job.checkpoint or {}).get("completed_phases", [])) | {phase})}
    if extra:
        checkpoint.update(extra)
    update_job(db, job, step=step, progress=progress, checkpoint=checkpoint, heartbeat=True)
    return pause_if_requested(db, job)


def phase_completed(job: SoftOpticMigrationJob, phase: str) -> bool:
    return phase in set((job.checkpoint or {}).get("completed_phases", []))


def _safe_extract_zip(zip_path: Path, destination: Path) -> None:
    with zipfile.ZipFile(zip_path) as archive:
        for member in archive.infolist():
            target = destination / member.filename
            resolved = target.resolve()
            if not str(resolved).startswith(str(destination.resolve())):
                raise HTTPException(status_code=400, detail="Invalid migration archive")
        archive.extractall(destination)


def _find_csv_root(extract_dir: Path) -> Path:
    if (extract_dir / "account.csv").exists():
        return extract_dir
    matches = list(extract_dir.rglob("account.csv"))
    if not matches:
        return extract_dir
    return matches[0].parent


def _count_csv_rows(path: Path) -> int:
    if not path.exists():
        return 0
    with path.open("r", encoding="utf-8-sig", newline="", errors="replace") as handle:
        reader = csv.reader(handle)
        next(reader, None)
        return sum(1 for _ in reader)


def _read_header(path: Path) -> list[str]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="", errors="replace") as handle:
        reader = csv.reader(handle)
        return next(reader, []) or []


def validate_export_bundle(extract_dir: Path) -> dict[str, Any]:
    csv_root = _find_csv_root(extract_dir)
    warnings: list[str] = []
    errors: list[str] = []
    tables: dict[str, int] = {}

    for filename in REQUIRED_CSV_FILES:
        path = csv_root / filename
        if not path.exists():
            errors.append(f"Missing required file: {filename}")
        elif "account_code" not in {h.strip() for h in _read_header(path)}:
            errors.append("account.csv is missing account_code header")

    for filename in (*REQUIRED_CSV_FILES, *OPTIONAL_CSV_FILES):
        path = csv_root / filename
        if path.exists():
            tables[filename] = _count_csv_rows(path)
        elif filename in OPTIONAL_CSV_FILES:
            warnings.append(f"Optional file missing: {filename}")

    manifest_path = csv_root / "manifest.json"
    manifest = {}
    if manifest_path.exists():
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
        except json.JSONDecodeError:
            warnings.append("manifest.json could not be parsed")

    documents_root = next((p for p in (csv_root / "documents", extract_dir / "documents") if p.exists() and p.is_dir()), None)
    external_documents = 0
    if documents_root:
        external_documents = sum(1 for item in documents_root.rglob("*") if item.is_file())

    return {
        "csv_root": str(csv_root),
        "documents_root": str(documents_root) if documents_root else None,
        "manifest": manifest,
        "tables": tables,
        "counts": {
            "clients": tables.get("account.csv", 0),
            "exams": tables.get("optic_eye_tests.csv", 0),
            "glasses_orders": tables.get("optic_glasses_presc.csv", 0),
            "contact_lens_orders": tables.get("optic_contact_presc.csv", 0),
            "appointments": tables.get("diary_timetab.csv", 0),
            "notes": tables.get("account_memos.csv", 0),
            "referrals": tables.get("optic_reference.csv", 0),
            "embedded_files": tables.get("account_files_blob.csv", 0),
            "external_documents": external_documents,
        },
        "warnings": warnings,
        "errors": errors,
    }


def _clinic_ids(db: Session, model: Any, clinic_id: int) -> set[int]:
    return set(db.execute(select(model.id).where(model.clinic_id == clinic_id)).scalars().all())


def _snapshot_clinic_rows(db: Session, clinic_id: int) -> dict[str, set[int]]:
    return {name: _clinic_ids(db, model, clinic_id) for name, model in TRACKED_CLINIC_MODELS.items()}


def _existing_softoptic_links(db: Session, clinic_id: int) -> list[MigrationSourceLink]:
    return (
        db.query(MigrationSourceLink)
        .filter(MigrationSourceLink.source_system == SOFTOPTIC_SOURCE_SYSTEM)
        .filter(MigrationSourceLink.clinic_id == clinic_id)
        .all()
    )


def _core_counts(db: Session, clinic_id: int) -> dict[str, int]:
    return {
        name: int(db.execute(select(func.count(model.id)).where(model.clinic_id == clinic_id)).scalar() or 0)
        for name, model in CORE_MODELS.items()
    }


def assert_safe_to_import(db: Session, clinic_id: int) -> None:
    links = _existing_softoptic_links(db, clinic_id)
    if links:
        return
    counts = _core_counts(db, clinic_id)
    non_empty = {name: count for name, count in counts.items() if count > 0}
    if non_empty:
        raise RuntimeError(
            "Clinic already contains untracked data. Create an empty clinic or clean it manually before SoftOptic import. "
            f"Counts: {non_empty}"
        )


def _ids_by_model(links: Iterable[MigrationSourceLink]) -> dict[str, list[int]]:
    result: dict[str, list[int]] = {}
    for link in links:
        result.setdefault(link.target_model, []).append(link.target_id)
    return result


def cleanup_previous_softoptic_import(db: Session, clinic_id: int, storage: Optional[FileStorageService]) -> dict[str, int]:
    links = _existing_softoptic_links(db, clinic_id)
    ids_by_model = _ids_by_model(links)
    deleted: dict[str, int] = {}

    index_deleted = 0
    for target_model, source_type in [
        ("ExamLayoutInstance", "exam"),
        ("Order", "order"),
        ("ContactLensOrder", "contact_lens_order"),
        ("Referral", "referral"),
    ]:
        index_deleted += delete_source_index_rows_bulk(
            db,
            source_type,
            ids_by_model.get(target_model, []),
            batch_size=SOFTOPTIC_DELETE_CHUNK_SIZE,
        )
    if index_deleted:
        deleted["PrescriptionSearchIndex"] = index_deleted

    file_ids = ids_by_model.get("File", [])
    if file_ids:
        for file_row in db.query(File).filter(File.id.in_(file_ids)).all():
            if storage and file_row.storage_bucket and file_row.storage_key and file_row.storage_bucket != "legacy-local":
                try:
                    storage.remove(file_row.storage_bucket, file_row.storage_key)
                except Exception:
                    pass

    order_ids = ids_by_model.get("Order", [])
    contact_order_ids = ids_by_model.get("ContactLensOrder", [])
    billing_query = db.query(Billing.id)
    billing_filters = []
    if order_ids:
        billing_filters.append(Billing.order_id.in_(order_ids))
    if contact_order_ids:
        billing_filters.append(Billing.contact_lens_id.in_(contact_order_ids))
    billing_ids = []
    if billing_filters:
        billing_ids = [row[0] for row in billing_query.filter(or_(*billing_filters)).all()]
    if billing_ids:
        deleted["BillingPayment"] = db.query(BillingPayment).filter(BillingPayment.billing_id.in_(billing_ids)).delete(synchronize_session=False)
        deleted["OrderLineItem"] = db.query(OrderLineItem).filter(OrderLineItem.billings_id.in_(billing_ids)).delete(synchronize_session=False)
        deleted["Billing"] = db.query(Billing).filter(Billing.id.in_(billing_ids)).delete(synchronize_session=False)

    for target_model, model in [
        ("ExamLayoutInstance", ExamLayoutInstance),
        ("OpticalExam", OpticalExam),
        ("ContactLensOrder", ContactLensOrder),
        ("Order", Order),
        ("Referral", Referral),
        ("File", File),
        ("MedicalLog", MedicalLog),
        ("Appointment", Appointment),
        ("Client", Client),
        ("Family", Family),
        ("LookupReferralType", LookupReferralType),
        ("LookupOrderType", LookupOrderType),
        ("LookupRinsingSolution", LookupRinsingSolution),
        ("LookupDisinfectionSolution", LookupDisinfectionSolution),
        ("LookupCleaningSolution", LookupCleaningSolution),
        ("LookupContactEyeMaterial", LookupContactEyeMaterial),
        ("LookupContactEyeLensType", LookupContactEyeLensType),
        ("LookupContactLensType", LookupContactLensType),
        ("LookupManufacturer", LookupManufacturer),
        ("LookupFrameModel", LookupFrameModel),
        ("LookupCoating", LookupCoating),
        ("LookupColor", LookupColor),
        ("LookupMaterial", LookupMaterial),
        ("LookupLensModel", LookupLensModel),
        ("LookupSupplier", LookupSupplier),
    ]:
        ids = ids_by_model.get(target_model, [])
        if ids:
            deleted[target_model] = db.query(model).filter(model.id.in_(ids)).delete(synchronize_session=False)

    if links:
        deleted["MigrationSourceLink"] = (
            db.query(MigrationSourceLink)
            .filter(MigrationSourceLink.source_system == SOFTOPTIC_SOURCE_SYSTEM)
            .filter(MigrationSourceLink.clinic_id == clinic_id)
            .delete(synchronize_session=False)
        )
    db.commit()
    return deleted


def _track_new_rows(
    db: Session,
    *,
    before: dict[str, set[int]],
    clinic_id: int,
    company_id: int,
    job_id: str,
) -> dict[str, int]:
    counts: dict[str, int] = {}
    for target_model, model in TRACKED_CLINIC_MODELS.items():
        current_ids = _clinic_ids(db, model, clinic_id)
        new_ids = sorted(current_ids - before.get(target_model, set()))
        counts[target_model] = len(new_ids)
        for target_id in new_ids:
            db.add(
                MigrationSourceLink(
                    source_system=SOFTOPTIC_SOURCE_SYSTEM,
                    source_table=target_model,
                    raw_row_ref=f"{job_id}:{target_model}:{target_id}",
                    source_primary_key_parts=[["id", str(target_id)]],
                    target_model=target_model,
                    target_id=target_id,
                    clinic_id=clinic_id,
                    company_id=company_id,
                    payload={"job_id": job_id},
                )
            )

    new_exam_ids = sorted(_clinic_ids(db, OpticalExam, clinic_id) - before.get("OpticalExam", set()))
    instances = db.query(ExamLayoutInstance).filter(ExamLayoutInstance.exam_id.in_(new_exam_ids)).all() if new_exam_ids else []
    counts["ExamLayoutInstance"] = len(instances)
    for row in instances:
        db.add(
            MigrationSourceLink(
                source_system=SOFTOPTIC_SOURCE_SYSTEM,
                source_table="ExamLayoutInstance",
                raw_row_ref=f"{job_id}:ExamLayoutInstance:{row.id}",
                source_primary_key_parts=[["id", str(row.id)]],
                target_model="ExamLayoutInstance",
                target_id=row.id,
                clinic_id=clinic_id,
                company_id=company_id,
                payload={"job_id": job_id, "exam_id": row.exam_id},
            )
        )

    order_ids = sorted(_clinic_ids(db, Order, clinic_id) - before.get("Order", set()))
    contact_order_ids = sorted(_clinic_ids(db, ContactLensOrder, clinic_id) - before.get("ContactLensOrder", set()))
    billing_rows = []
    if order_ids or contact_order_ids:
        query = db.query(Billing)
        filters = []
        if order_ids:
            filters.append(Billing.order_id.in_(order_ids))
        if contact_order_ids:
            filters.append(Billing.contact_lens_id.in_(contact_order_ids))
        billing_rows = query.filter(or_(*filters)).all()
    counts["Billing"] = len(billing_rows)
    for row in billing_rows:
        db.add(
            MigrationSourceLink(
                source_system=SOFTOPTIC_SOURCE_SYSTEM,
                source_table="Billing",
                raw_row_ref=f"{job_id}:Billing:{row.id}",
                source_primary_key_parts=[["id", str(row.id)]],
                target_model="Billing",
                target_id=row.id,
                clinic_id=clinic_id,
                company_id=company_id,
                payload={"job_id": job_id},
            )
        )
    billing_ids = [row.id for row in billing_rows]
    line_items = db.query(OrderLineItem).filter(OrderLineItem.billings_id.in_(billing_ids)).all() if billing_ids else []
    counts["OrderLineItem"] = len(line_items)
    for row in line_items:
        db.add(
            MigrationSourceLink(
                source_system=SOFTOPTIC_SOURCE_SYSTEM,
                source_table="OrderLineItem",
                raw_row_ref=f"{job_id}:OrderLineItem:{row.id}",
                source_primary_key_parts=[["id", str(row.id)]],
                target_model="OrderLineItem",
                target_id=row.id,
                clinic_id=clinic_id,
                company_id=company_id,
                payload={"job_id": job_id},
            )
        )
    db.commit()
    return counts


def _list_documents(documents_root: Optional[str]) -> set[str]:
    if not documents_root:
        return set()
    root = Path(documents_root)
    if not root.exists():
        return set()
    result: set[str] = set()
    for item in root.rglob("*"):
        if item.is_file():
            try:
                result.add(str(item.relative_to(root)))
            except Exception:
                result.add(str(item))
    return result


def _merge_counts(base: dict[str, int], addition: dict[str, int]) -> dict[str, int]:
    merged = dict(base or {})
    for key, value in (addition or {}).items():
        merged[key] = int(merged.get(key, 0) or 0) + int(value or 0)
    return merged


async def save_upload_to_temp(upload: UploadFile, job_id: str) -> Path:
    base = Path(tempfile.gettempdir()) / "opticai_softoptic_imports" / job_id
    base.mkdir(parents=True, exist_ok=True)
    target = base / "bundle.zip"
    with target.open("wb") as handle:
        while True:
            chunk = await upload.read(1024 * 1024)
            if not chunk:
                break
            handle.write(chunk)
    return target


async def store_bundle_upload(
    db: Session,
    *,
    job: SoftOpticMigrationJob,
    upload: UploadFile,
    storage: FileStorageService,
) -> SoftOpticMigrationJob:
    if job.status != "awaiting_upload":
        raise HTTPException(status_code=409, detail="Migration job is not awaiting upload")
    temp_path = await save_upload_to_temp(upload, job.id)
    try:
        bucket = os.environ.get("SOFTOPTIC_MIGRATION_BUNDLE_BUCKET") or config.settings.SUPABASE_BUCKET or "opticai"
        key = f"clinics/{job.clinic_id}/softoptic-migrations/{job.id}/bundle.zip"
        storage.upload_path(bucket, key, temp_path, SOFTOPTIC_BUNDLE_CONTENT_TYPE)
        job.bundle_storage_bucket = bucket
        job.bundle_storage_key = key
        job.bundle_path = None
        job.status = "queued"
        job.step = "ממתין לעובד ייבוא"
        job.progress = 12
        job.pause_requested = False
        job.error = None
        job.errors = []
        job.updated_at = utcnow()
        db.add(job)
        db.commit()
        db.refresh(job)
        return job
    finally:
        temp_path.unlink(missing_ok=True)


def create_job(
    db: Session,
    *,
    job_id: str,
    clinic: Clinic,
    current_user: User,
    source_metadata: dict[str, Any],
    export_summary: dict[str, Any],
    include_documents: bool,
    client_import_limit: Optional[int] = None,
) -> SoftOpticMigrationJob:
    job = SoftOpticMigrationJob(
        id=job_id,
        clinic_id=clinic.id,
        company_id=clinic.company_id,
        user_id=current_user.id,
        status="awaiting_upload",
        step="ממתין להעלאת קובץ",
        progress=6,
        include_documents=include_documents,
        client_import_limit=client_import_limit,
        source_metadata=source_metadata,
        export_summary=export_summary,
        validation_summary={},
        import_summary={},
        checkpoint={},
        warnings=[],
        errors=[],
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def request_pause(db: Session, job: SoftOpticMigrationJob) -> SoftOpticMigrationJob:
    if job.status not in {"queued", "running"}:
        raise HTTPException(status_code=409, detail="Only queued or running jobs can be paused")
    job.pause_requested = True
    if job.status == "queued":
        job.status = "paused"
        job.step = "מושהה"
    job.updated_at = utcnow()
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def resume_job(db: Session, job: SoftOpticMigrationJob) -> SoftOpticMigrationJob:
    if job.status not in {"paused", "failed"}:
        raise HTTPException(status_code=409, detail="Only paused or failed jobs can be resumed")
    if not job.bundle_storage_bucket or not job.bundle_storage_key:
        raise HTTPException(status_code=409, detail="Migration bundle is missing")
    job.status = "queued"
    job.step = "ממתין לעובד ייבוא"
    job.pause_requested = False
    job.error = None
    job.errors = []
    job.locked_by = None
    job.lease_until = None
    job.finished_at = None
    job.updated_at = utcnow()
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def cancel_job(db: Session, job: SoftOpticMigrationJob) -> SoftOpticMigrationJob:
    destructive_started = bool(set((job.checkpoint or {}).get("completed_phases", [])) & {"cleanup", "clients", "clinical", "supplemental"})
    if job.status not in {"awaiting_upload", "queued", "paused"} or destructive_started:
        raise HTTPException(status_code=409, detail="Migration can no longer be cancelled safely")
    update_job(db, job, status="cancelled", step="בוטל", progress=job.progress)
    return job


def claim_next_job(db: Session, worker_id: str) -> Optional[SoftOpticMigrationJob]:
    now = utcnow()
    query = (
        db.query(SoftOpticMigrationJob)
        .filter(
            or_(
                SoftOpticMigrationJob.status == "queued",
                and_(
                    SoftOpticMigrationJob.status == "running",
                    or_(SoftOpticMigrationJob.lease_until.is_(None), SoftOpticMigrationJob.lease_until < now),
                ),
            )
        )
        .filter(SoftOpticMigrationJob.bundle_storage_bucket.isnot(None))
        .filter(SoftOpticMigrationJob.bundle_storage_key.isnot(None))
        .order_by(SoftOpticMigrationJob.created_at.asc())
    )
    try:
        job = query.with_for_update(skip_locked=True).first()
    except Exception:
        db.rollback()
        job = query.first()
    if not job:
        return None
    job.status = "running"
    job.step = "בדיקת תקינות"
    job.locked_by = worker_id
    job.heartbeat_at = now
    job.lease_until = now + timedelta(seconds=SOFTOPTIC_LEASE_SECONDS)
    job.pause_requested = False
    job.attempt_count = (job.attempt_count or 0) + 1
    if job.started_at is None:
        job.started_at = now
    job.updated_at = now
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def run_softoptic_import(
    db: Session,
    *,
    job: SoftOpticMigrationJob,
    storage: Optional[FileStorageService],
    on_progress: Callable[..., None],
) -> None:
    temp_dir = Path(tempfile.mkdtemp(prefix=f"softoptic_{job.id}_"))
    old_order_batch_size = os.environ.get("MIGRATION_ORDER_COMMIT_BATCH_SIZE")
    try:
        os.environ["MIGRATION_ORDER_COMMIT_BATCH_SIZE"] = "0"
        bundle_path = temp_dir / "bundle.zip"
        if job.bundle_storage_bucket and job.bundle_storage_key:
            if not storage:
                raise RuntimeError("Storage service is required to download migration bundle")
            storage.download_to_path(job.bundle_storage_bucket, job.bundle_storage_key, bundle_path)
        elif job.bundle_path:
            bundle_path = Path(job.bundle_path)
        else:
            raise RuntimeError("Migration bundle is missing")

        validation = job.validation_summary or {}
        if not phase_completed(job, "validation"):
            on_progress(step="בדיקת תקינות", progress=18, heartbeat=True)
            _safe_extract_zip(bundle_path, temp_dir)
            validation = validate_export_bundle(temp_dir)
            if validation["errors"]:
                raise RuntimeError("; ".join(validation["errors"]))
            on_progress(progress=28, validation_summary=validation, warnings=validation["warnings"], heartbeat=True)
            if mark_checkpoint(db, job, phase="validation", step="בדיקת תקינות", progress=28):
                return
        else:
            _safe_extract_zip(bundle_path, temp_dir)
            validation = validate_export_bundle(temp_dir)

        clinic = db.get(Clinic, job.clinic_id)
        if not clinic or not clinic.is_active:
            raise RuntimeError("Target clinic is missing or inactive")

        import_summary = dict(job.import_summary or {})
        deleted = import_summary.get("deleted_previous", {})
        if not phase_completed(job, "cleanup"):
            on_progress(step="החלפת ייבוא קודם", progress=35, heartbeat=True)
            assert_safe_to_import(db, job.clinic_id)
            deleted = cleanup_previous_softoptic_import(db, job.clinic_id, storage)
            import_summary["deleted_previous"] = deleted
            on_progress(import_summary=import_summary, heartbeat=True)
            if mark_checkpoint(db, job, phase="cleanup", step="החלפת ייבוא קודם", progress=38):
                return

        csv_root = validation["csv_root"]
        documents_root = validation["documents_root"] if job.include_documents else None
        all_documents = _list_documents(documents_root)
        matched_documents: set[str] = set()

        admin_user = get_or_create_admin_user(db, clinic.company, clinic)
        branch_codes = collect_branch_codes(csv_root)
        branch_to_clinic: Dict[Any, int] = {None: job.clinic_id, "": job.clinic_id}
        for branch_code in branch_codes:
            branch_to_clinic[branch_code] = job.clinic_id

        account_to_client: dict[str, int] = {}
        if not phase_completed(job, "clients"):
            before = _snapshot_clinic_rows(db, job.clinic_id)
            on_progress(step="ייבוא לקוחות ומשפחות", progress=42, heartbeat=True)
            migrate_lookups(db, csv_root, [job.clinic_id])
            account_to_client, _ = migrate_clients_and_families(
                db,
                csv_root,
                clinic.company,
                return_only=False,
                target_clinic_id=job.clinic_id,
                max_clients=job.client_import_limit,
            )
            tracked = _track_new_rows(
                db,
                before=before,
                clinic_id=job.clinic_id,
                company_id=job.company_id,
                job_id=job.id,
            )
            import_summary["tracked_counts"] = _merge_counts(import_summary.get("tracked_counts", {}), tracked)
            if job.client_import_limit:
                import_summary["client_import_limit"] = job.client_import_limit
                import_summary["client_imported_count"] = len(account_to_client)
            on_progress(import_summary=import_summary, heartbeat=True)
            if mark_checkpoint(db, job, phase="clients", step="ייבוא לקוחות ומשפחות", progress=52):
                return

        if not account_to_client:
            account_to_client, _ = migrate_clients_and_families(
                db,
                csv_root,
                clinic.company,
                return_only=True,
                target_clinic_id=job.clinic_id,
                max_clients=job.client_import_limit,
            )

        presc_code_to_order_id = {}
        if not phase_completed(job, "clinical"):
            before = _snapshot_clinic_rows(db, job.clinic_id)
            on_progress(step="ייבוא בדיקות והזמנות", progress=58, heartbeat=True)
            migrate_optical_exams(db, csv_root, account_to_client, branch_to_clinic, admin_user.id)
            presc_code_to_order_id = migrate_contact_lens_orders(db, csv_root, account_to_client, branch_to_clinic, admin_user.id)
            migrate_regular_orders(db, csv_root, account_to_client, branch_to_clinic, admin_user.id)
            enrich_from_contact_lens_chk(db, csv_root, account_to_client, presc_code_to_order_id)
            tracked = _track_new_rows(
                db,
                before=before,
                clinic_id=job.clinic_id,
                company_id=job.company_id,
                job_id=job.id,
            )
            import_summary["tracked_counts"] = _merge_counts(import_summary.get("tracked_counts", {}), tracked)
            on_progress(import_summary=import_summary, heartbeat=True)
            if mark_checkpoint(db, job, phase="clinical", step="ייבוא בדיקות והזמנות", progress=72):
                return

        if not phase_completed(job, "supplemental"):
            before = _snapshot_clinic_rows(db, job.clinic_id)
            on_progress(step="ייבוא מסמכים ונתונים משלימים", progress=76, heartbeat=True)
            migrate_referrals(db, csv_root, account_to_client, branch_to_clinic, admin_user.id)
            if job.include_documents:
                migrate_files(
                    db,
                    csv_root,
                    account_to_client,
                    branch_to_clinic,
                    admin_user.id,
                    storage_service=storage,
                    documents_dir=documents_root,
                    matched_documents=matched_documents,
                )
            migrate_medical_logs(db, csv_root, account_to_client, branch_to_clinic, admin_user.id)
            migrate_appointments(db, csv_root, account_to_client, branch_to_clinic, admin_user.id)
            tracked = _track_new_rows(
                db,
                before=before,
                clinic_id=job.clinic_id,
                company_id=job.company_id,
                job_id=job.id,
            )
            import_summary["tracked_counts"] = _merge_counts(import_summary.get("tracked_counts", {}), tracked)
            on_progress(import_summary=import_summary, heartbeat=True)
            if mark_checkpoint(db, job, phase="supplemental", step="ייבוא מסמכים ונתונים משלימים", progress=90):
                return

        if not phase_completed(job, "prescription_index"):
            on_progress(step="בניית אינדקס מרשמים", progress=92, heartbeat=True)
            import_summary["prescription_index"] = rebuild_clinic_prescription_search_index(
                db,
                job.clinic_id,
                commit_each_batch=True,
            )
            on_progress(import_summary=import_summary, progress=96, heartbeat=True)
            if mark_checkpoint(db, job, phase="prescription_index", step="בניית אינדקס מרשמים", progress=96):
                return

        on_progress(step="סיום", progress=98, heartbeat=True)
        unmatched_documents = sorted(all_documents - matched_documents)
        import_summary["deleted_previous"] = deleted
        import_summary["matched_external_documents"] = len(matched_documents)
        import_summary["unmatched_external_documents"] = unmatched_documents[:250]
        import_summary["unmatched_external_documents_count"] = len(unmatched_documents)
        warnings = list(validation["warnings"])
        if not job.include_documents:
            warnings.append("Document import was disabled by the user")
        if unmatched_documents:
            warnings.append(f"{len(unmatched_documents)} external documents were not matched to clients")
        on_progress(
            status="completed",
            step="סיום",
            progress=100,
            warnings=warnings,
            import_summary=import_summary,
        )
    except Exception as exc:
        db.rollback()
        on_progress(
            status="failed",
            step="שגיאה",
            progress=job.progress,
            errors=[str(exc)],
            error=str(exc),
            checkpoint={"failed_at": utcnow().isoformat()},
        )
    finally:
        if old_order_batch_size is None:
            os.environ.pop("MIGRATION_ORDER_COMMIT_BATCH_SIZE", None)
        else:
            os.environ["MIGRATION_ORDER_COMMIT_BATCH_SIZE"] = old_order_batch_size
        shutil.rmtree(temp_dir, ignore_errors=True)

def job_to_dict(job: SoftOpticMigrationJob) -> dict[str, Any]:
    return {
        "id": job.id,
        "clinic_id": job.clinic_id,
        "company_id": job.company_id,
        "user_id": job.user_id,
        "status": job.status,
        "step": job.step,
        "progress": job.progress,
        "include_documents": bool(job.include_documents),
        "client_import_limit": job.client_import_limit,
        "source_metadata": job.source_metadata or {},
        "export_summary": job.export_summary or {},
        "validation_summary": job.validation_summary or {},
        "import_summary": job.import_summary or {},
        "checkpoint": job.checkpoint or {},
        "warnings": job.warnings or [],
        "errors": job.errors or [],
        "error": job.error,
        "bundle_uploaded": bool(job.bundle_storage_bucket and job.bundle_storage_key),
        "locked_by": job.locked_by,
        "lease_until": job.lease_until.isoformat() if job.lease_until else None,
        "heartbeat_at": job.heartbeat_at.isoformat() if job.heartbeat_at else None,
        "pause_requested": bool(job.pause_requested),
        "attempt_count": job.attempt_count or 0,
        "last_error_at": job.last_error_at.isoformat() if job.last_error_at else None,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "finished_at": job.finished_at.isoformat() if job.finished_at else None,
    }
