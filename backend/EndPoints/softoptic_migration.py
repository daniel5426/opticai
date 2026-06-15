from uuid import uuid4

from fastapi import APIRouter, Body, Depends, File as FastAPIFile, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Clinic, SoftOpticMigrationJob, User
from security.scope import assert_clinic_scope
from services.file_storage_service import FileStorageService, get_file_storage_service
from services.softoptic_migration_service import (
    cancel_job,
    create_job,
    job_to_dict,
    request_pause,
    resume_job,
    store_bundle_upload,
)


router = APIRouter(prefix="/migration/softoptic", tags=["softoptic-migration"])


def require_manager(current_user: User) -> None:
    if (current_user.role_level or 0) < 3:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to run clinic migration",
        )


@router.post("/imports")
def create_softoptic_import(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_manager(current_user)
    clinic_id = payload.get("clinic_id")
    if not isinstance(clinic_id, int):
        raise HTTPException(status_code=422, detail="clinic_id is required")
    assert_clinic_scope(db, current_user, clinic_id)
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic or not clinic.is_active:
        raise HTTPException(status_code=404, detail="Clinic not found")

    job_id = uuid4().hex
    job = create_job(
        db,
        job_id=job_id,
        clinic=clinic,
        current_user=current_user,
        source_metadata=payload.get("source_metadata") if isinstance(payload.get("source_metadata"), dict) else {},
        export_summary=payload.get("export_summary") if isinstance(payload.get("export_summary"), dict) else {},
        include_documents=bool(payload.get("include_documents")),
    )
    return job_to_dict(job)


@router.get("/imports")
def list_softoptic_imports(
    clinic_id: int = Query(...),
    active_only: bool = Query(False),
    limit: int = Query(5, ge=1, le=25),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_manager(current_user)
    assert_clinic_scope(db, current_user, clinic_id)
    query = db.query(SoftOpticMigrationJob).filter(SoftOpticMigrationJob.clinic_id == clinic_id)
    if active_only:
        query = query.filter(SoftOpticMigrationJob.status.in_(["awaiting_upload", "queued", "running", "paused", "failed"]))
    jobs = query.order_by(SoftOpticMigrationJob.created_at.desc()).limit(limit).all()
    return [job_to_dict(job) for job in jobs]


@router.put("/imports/{job_id}/bundle")
async def upload_softoptic_bundle(
    job_id: str,
    bundle: UploadFile = FastAPIFile(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    storage: FileStorageService = Depends(get_file_storage_service),
):
    require_manager(current_user)
    job = db.get(SoftOpticMigrationJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Migration job not found")
    assert_clinic_scope(db, current_user, job.clinic_id)
    job = await store_bundle_upload(db, job=job, upload=bundle, storage=storage)
    return job_to_dict(job)


@router.get("/imports/{job_id}")
def get_softoptic_import(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = db.get(SoftOpticMigrationJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Migration job not found")
    assert_clinic_scope(db, current_user, job.clinic_id)
    return job_to_dict(job)


@router.post("/imports/{job_id}/pause")
def pause_softoptic_import(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_manager(current_user)
    job = db.get(SoftOpticMigrationJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Migration job not found")
    assert_clinic_scope(db, current_user, job.clinic_id)
    return job_to_dict(request_pause(db, job))


@router.post("/imports/{job_id}/resume")
def resume_softoptic_import(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_manager(current_user)
    job = db.get(SoftOpticMigrationJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Migration job not found")
    assert_clinic_scope(db, current_user, job.clinic_id)
    return job_to_dict(resume_job(db, job))


@router.post("/imports/{job_id}/cancel")
def cancel_softoptic_import(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_manager(current_user)
    job = db.get(SoftOpticMigrationJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Migration job not found")
    assert_clinic_scope(db, current_user, job.clinic_id)
    return job_to_dict(cancel_job(db, job))
