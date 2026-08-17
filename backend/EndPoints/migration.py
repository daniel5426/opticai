from uuid import uuid4

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Clinic, SoftOpticMigrationJob, User
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
    clinic = db.get(Clinic, clinic_id)
    if not clinic or not clinic.is_active:
        raise HTTPException(status_code=404, detail="Clinic not found")
    if clinic.maintenance_mode:
        raise HTTPException(status_code=423, detail="Clinic is in maintenance mode")
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
    export_summary = payload.get("export_summary") if isinstance(payload.get("export_summary"), dict) else {}
    if source_system == "optitech":
        source_metadata = {
            **source_metadata,
            "mapping_version": 2,
            "import_users": bool(options.get("import_users", False)),
        }
        export_summary = {**export_summary, "mapping_version": 2}
    try:
        job = create_job(
            db,
            job_id=uuid4().hex,
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
        "file_name": f"optitech-migration-{job.id}.zip",
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
