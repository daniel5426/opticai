from uuid import uuid4
import os
import re

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import String, cast
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Clinic, ClinicDataPruneJob, SoftOpticMigrationJob, User, MigrationSourceLink
from security.scope import assert_clinic_scope
from services.file_storage_service import FileStorageService, get_file_storage_service
from services.migration_service import SUPPORTED_SOURCE_SYSTEMS
from services.softoptic_migration_service import (
    cancel_job,
    complete_bundle_direct_upload,
    create_job,
    job_to_dict,
    prepare_bundle_direct_upload,
    request_pause,
    resume_job,
)


router = APIRouter(prefix="/migration", tags=["migration"])
ACTIVE_STATUSES = {"awaiting_upload", "queued", "running", "paused"}


def opticplus_enabled() -> bool:
    default = "0" if os.getenv("APP_ENV", "development").strip().lower() == "production" else "1"
    return os.getenv("OPTICPLUS_MIGRATION_ENABLED", default) == "1"


@router.get("/capabilities")
def migration_capabilities(current_user: User = Depends(get_current_user)):
    return {"sources": {
        "softoptic": {"enabled": True}, "optitech": {"enabled": True},
        "opticplus": {"enabled": opticplus_enabled(), "mapping_version": 2,
                      "transfer_files": True, "updates": True, "platforms": ["win32"]},
    }}


def _get_job(db: Session, current_user: User, job_id: str) -> SoftOpticMigrationJob:
    job = db.get(SoftOpticMigrationJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Migration job not found")
    assert_clinic_scope(db, current_user, job.clinic_id, allow_maintenance=True)
    return job


@router.post("/imports")
def create_import(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    clinic_id = payload.get("clinic_id")
    source_system = payload.get("source_system")
    if not isinstance(clinic_id, int):
        raise HTTPException(status_code=422, detail="clinic_id is required")
    if source_system not in SUPPORTED_SOURCE_SYSTEMS:
        raise HTTPException(status_code=422, detail="Unsupported source_system")
    assert_clinic_scope(db, current_user, clinic_id, allow_maintenance=True)
    # Serialize starts with other starts and clinic cleanup creation.
    clinic = db.query(Clinic).filter_by(id=clinic_id).populate_existing().with_for_update().first()
    if not clinic or not clinic.is_active:
        raise HTTPException(status_code=404, detail="Clinic not found")
    if clinic.maintenance_mode:
        raise HTTPException(status_code=423, detail="Clinic is in maintenance mode")
    if db.query(ClinicDataPruneJob.id).filter(
        ClinicDataPruneJob.clinic_id == clinic_id,
        ClinicDataPruneJob.status.in_({"queued", "running", "failed"}),
    ).first():
        raise HTTPException(status_code=409, detail="Clinic has unfinished data cleanup")
    active = (
        db.query(SoftOpticMigrationJob.id)
        .filter(SoftOpticMigrationJob.clinic_id == clinic_id)
        .filter(SoftOpticMigrationJob.status.in_(ACTIVE_STATUSES))
        .first()
    )
    if active:
        raise HTTPException(status_code=409, detail="Clinic already has an active migration")
    options = payload.get("options") if isinstance(payload.get("options"), dict) else {}
    client_limit = options.get("client_import_limit")
    if client_limit is not None and (not isinstance(client_limit, int) or client_limit < 1):
        raise HTTPException(status_code=422, detail="client_import_limit must be a positive integer")
    source_metadata = payload.get("source_metadata") if isinstance(payload.get("source_metadata"), dict) else {}
    account_code = options.get("client_account_code")
    if account_code is not None:
        if (source_system != "softoptic" or not isinstance(account_code, str)
                or not re.fullmatch(r"[0-9]{1,30}", account_code) or client_limit is not None):
            raise HTTPException(status_code=422, detail="softoptic.invalidClientNumber")
    # Do not accept a hidden selection supplied through source_metadata.
    source_metadata = {**source_metadata, "client_account_code": account_code}
    export_summary = payload.get("export_summary") if isinstance(payload.get("export_summary"), dict) else {}
    job_id = uuid4().hex
    if source_system == "opticplus":
        if not opticplus_enabled():
            raise HTTPException(status_code=409, detail="OpticPlus migration is not enabled on this server")
        failed = db.query(SoftOpticMigrationJob).filter_by(clinic_id=clinic_id, source_system="opticplus", status="failed").all()
        if any((j.checkpoint or {}).get("writes_started") for j in failed):
            raise HTTPException(status_code=409, detail="Resume the partially imported OpticPlus job before starting another")
        if payload.get("bundle_format_version") != 2 or not re.fullmatch(r"[a-f0-9]{64}", str(payload.get("source_fingerprint", ""))):
            raise HTTPException(status_code=422, detail="OpticPlus requires a versioned source fingerprint")
        previous_id = payload.get("previous_import_job_id")
        dataset_id = job_id
        if previous_id is not None:
            if not isinstance(previous_id, str):
                raise HTTPException(status_code=422, detail="Invalid previous_import_job_id")
            previous = db.get(SoftOpticMigrationJob, previous_id)
            if (not previous or previous.clinic_id != clinic_id or previous.company_id != clinic.company_id
                    or previous.source_system != "opticplus" or previous.status != "completed"):
                raise HTTPException(status_code=422, detail="Previous OpticPlus import is unavailable for this clinic")
            dataset_id = (previous.source_metadata or {}).get("dataset_id")
            if not isinstance(dataset_id, str) or not re.fullmatch(r"[a-f0-9]{32}", dataset_id):
                raise HTTPException(status_code=422, detail="Previous OpticPlus source binding is invalid")
        elif db.query(SoftOpticMigrationJob.id).filter_by(clinic_id=clinic_id, source_system="opticplus", status="completed").first():
            raise HTTPException(status_code=409, detail="Select the previous OpticPlus import to update")
        selected = source_metadata.get("selected_client_ids")
        if selected is not None:
            if (not isinstance(selected, list) or not selected or len(selected) > 10000 or
                any(isinstance(v, bool) or not isinstance(v, int) or v < 1 or v > 2147483647 for v in selected) or
                len(set(selected)) != len(selected) or payload.get("client_import_limit")):
                raise HTTPException(status_code=422, detail="Invalid OpticPlus patient selection")
        source_metadata = {**source_metadata, "dataset_id": dataset_id, "mapping_version": 2,
                           "previous_import_job_id": previous_id}
        # Patient selection, complete manifests and diagnostics remain in the
        # private bundle/report, not the JSON returned by every status poll.
        export_summary = {k: export_summary.get(k) for k in ["clients", "exams", "orders", "sourceFingerprint"]}
    if source_system == "optitech":
        export_manifest = export_summary.get("manifest") if isinstance(export_summary.get("manifest"), dict) else {}
        mapping_version = export_manifest.get("mapping_version")
        if mapping_version not in {2, 3}:
            mapping_version = 2
        source_metadata = {
            **source_metadata,
            "mapping_version": mapping_version,
            "import_users": bool(options.get("import_users", False)),
        }
        export_summary = {**export_summary, "mapping_version": mapping_version}
    try:
        job = create_job(
            db,
            job_id=job_id,
            clinic=clinic,
            current_user=current_user,
            source_metadata=source_metadata,
            export_summary=export_summary,
            include_documents=bool(options.get("include_documents")),
            client_import_limit=client_limit,
            source_system=source_system,
            bundle_format_version=payload.get("bundle_format_version") if isinstance(payload.get("bundle_format_version"), int) else None,
            source_fingerprint=payload.get("source_fingerprint") if isinstance(payload.get("source_fingerprint"), str) else None,
        )
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Clinic already has an active migration") from exc
    return job_to_dict(job)


@router.get("/imports")
def list_imports(
    clinic_id: int = Query(...),
    source_system: str | None = Query(None),
    active_only: bool = Query(False),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assert_clinic_scope(db, current_user, clinic_id)
    query = db.query(SoftOpticMigrationJob).filter(SoftOpticMigrationJob.clinic_id == clinic_id)
    if source_system:
        if source_system not in SUPPORTED_SOURCE_SYSTEMS:
            raise HTTPException(status_code=422, detail="Unsupported source_system")
        query = query.filter(SoftOpticMigrationJob.source_system == source_system)
    if active_only:
        query = query.filter(SoftOpticMigrationJob.status.in_(ACTIVE_STATUSES))
    return [job_to_dict(job) for job in query.order_by(SoftOpticMigrationJob.created_at.desc()).limit(limit).all()]


@router.get("/imports/{job_id}")
def get_import(job_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return job_to_dict(_get_job(db, current_user, job_id))


@router.get("/imports/{job_id}/report-download")
def download_import_report(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    storage: FileStorageService = Depends(get_file_storage_service),
):
    job = _get_job(db, current_user, job_id)
    report = (job.import_summary or {}).get("report")
    if not isinstance(report, dict) or not report.get("bucket") or not report.get("key"):
        raise HTTPException(status_code=404, detail="Migration report is not available")
    return {
        "url": storage.create_signed_url(report["bucket"], report["key"], expires_in=900),
        "file_name": f"{job.source_system or 'softoptic'}-migration-{job.id}.zip",
    }


@router.get("/imports/{job_id}/rollback-preview")
def preview_import_rollback(job_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    job = _get_job(db, current_user, job_id)
    if job.source_system != "opticplus":
        raise HTTPException(status_code=422, detail="Rollback preview is available for OpticPlus")
    from services.opticplus_migration_service import rollback_preview
    try:
        return rollback_preview(db, job)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/imports/{job_id}/source-archive-download")
def download_source_archive(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    storage: FileStorageService = Depends(get_file_storage_service),
):
    job = _get_job(db, current_user, job_id)
    if job.source_system not in {"optitech", "opticplus"}:
        raise HTTPException(status_code=404, detail="OptiTech source archive is not available")
    if not job.bundle_storage_bucket or not job.bundle_storage_key:
        raise HTTPException(status_code=404, detail="OptiTech source archive is not available")
    manifest = (job.validation_summary or {}).get("manifest")
    source_archive = manifest.get("source_archive") if isinstance(manifest, dict) else None
    if not isinstance(source_archive, dict) or not source_archive.get("complete"):
        raise HTTPException(status_code=404, detail="This migration bundle does not contain the original database")
    if not storage.exists(job.bundle_storage_bucket, job.bundle_storage_key):
        raise HTTPException(status_code=404, detail="The retained OptiTech source archive is missing from storage")
    return {
        "url": storage.create_signed_url(job.bundle_storage_bucket, job.bundle_storage_key, expires_in=900),
        "file_name": f"{job.source_system}-source-archive-{job.id}.zip",
        "sha256": source_archive.get("sha256"),
    }


@router.post("/imports/{job_id}/bundle-upload-url")
def bundle_upload_url(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    storage: FileStorageService = Depends(get_file_storage_service),
):
    return prepare_bundle_direct_upload(db, job=_get_job(db, current_user, job_id), storage=storage)


@router.post("/imports/{job_id}/bundle-upload-complete")
def bundle_upload_complete(
    job_id: str,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    storage: FileStorageService = Depends(get_file_storage_service),
):
    bucket, key = payload.get("bucket"), payload.get("key")
    if not isinstance(bucket, str) or not isinstance(key, str):
        raise HTTPException(status_code=422, detail="bucket and key are required")
    return job_to_dict(
        complete_bundle_direct_upload(
            db,
            job=_get_job(db, current_user, job_id),
            bucket=bucket,
            key=key,
            storage=storage,
        )
    )


@router.post("/imports/{job_id}/pause")
def pause_import(job_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return job_to_dict(request_pause(db, _get_job(db, current_user, job_id)))


@router.post("/imports/{job_id}/resume")
def resume_import(job_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return job_to_dict(resume_job(db, _get_job(db, current_user, job_id)))


@router.post("/imports/{job_id}/cancel")
def cancel_import(job_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return job_to_dict(cancel_job(db, _get_job(db, current_user, job_id)))


@router.get("/imports/{job_id}/reference-data")
def get_opticplus_reference_data(
    job_id: str, table: str = Query("tb_ad_catalog"), q: str = Query("", max_length=200),
    page: int = Query(1, ge=1), limit: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    from migration.opticplus.clinical import REFERENCE_TABLES
    from services.inventory_service import can_view_cost
    job = _get_job(db, current_user, job_id)
    if job.source_system != "opticplus" or table not in REFERENCE_TABLES:
        raise HTTPException(status_code=422, detail="Unsupported OpticPlus reference table")
    dataset = (job.source_metadata or {}).get("dataset_id")
    if not isinstance(dataset, str) or not re.fullmatch(r"[a-f0-9]{32}", dataset):
        raise HTTPException(status_code=422, detail="Missing OpticPlus dataset binding")
    query = db.query(MigrationSourceLink).filter(
        MigrationSourceLink.source_system == "opticplus", MigrationSourceLink.clinic_id == job.clinic_id,
        MigrationSourceLink.company_id == job.company_id, MigrationSourceLink.source_table == table,
        MigrationSourceLink.target_model == "Clinic", MigrationSourceLink.target_id == job.clinic_id,
        MigrationSourceLink.raw_row_ref.like(f"opticplus:{dataset}:{table}:%:reference"))
    if q.strip(): query = query.filter(cast(MigrationSourceLink.raw_payload, String).ilike("%" + q.strip().replace("%", "\\%").replace("_", "\\_") + "%", escape="\\"))
    total = query.count()
    rows = query.order_by(MigrationSourceLink.id).offset((page - 1) * limit).limit(limit).all()
    items = []
    for link in rows:
        raw = {k: v for k, v in (link.raw_payload or {}).items() if not k.startswith("__")}
        # The extractor allowlist excludes secrets; keep the same cost permission as inventory.
        if not can_view_cost(current_user): raw.pop("cprice", None)
        items.append({"source_table": table, "source_key": link.source_primary_key_parts.get("key"),
                      "values": raw, "raw_row_ref": link.raw_row_ref})
    return {"items": items, "total": total, "page": page, "limit": limit}
