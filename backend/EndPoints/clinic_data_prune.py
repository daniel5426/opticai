from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Clinic, ClinicDataPruneJob, User
from security.scope import require_company_admin
from services.clinic_data_prune_service import (
    create_preview_token,
    create_prune_job,
    PRUNE_PREVIEW_SECTIONS,
    preview_counts,
    prune_job_to_dict,
    resume_prune_job,
    verify_preview_token,
)


router = APIRouter(prefix="/clinics", tags=["clinic-data-prune"])


def _clinic_for_admin(db: Session, current_user: User, clinic_id: int) -> Clinic:
    clinic = db.get(Clinic, clinic_id)
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    require_company_admin(db, current_user, clinic.company_id)
    if current_user.clinic_id is not None:
        raise HTTPException(status_code=403, detail="Clinic data cleanup requires a company-level CEO")
    return clinic


@router.post("/{clinic_id}/data-prune/preview")
def preview_prune(
    clinic_id: int,
    section: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    clinic = _clinic_for_admin(db, current_user, clinic_id)
    try:
        counts = preview_counts(db, clinic.id, section=section)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {
        "clinic_id": clinic.id,
        "clinic_name": clinic.name,
        "counts": counts,
        "section": section,
        "sections": list(PRUNE_PREVIEW_SECTIONS),
        "preserved": ["clinic", "settings", "lookups", "exam_layouts", "company_admins", "clinic_users"],
        "confirmation_token": create_preview_token(clinic_id=clinic.id, user_id=current_user.id),
        "expires_in_seconds": 600,
    }


@router.get("/{clinic_id}/data-prune/active")
def get_active_prune(
    clinic_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    clinic = _clinic_for_admin(db, current_user, clinic_id)
    job = db.get(ClinicDataPruneJob, clinic.maintenance_job_id) if clinic.maintenance_job_id else None
    if not job:
        job = db.query(ClinicDataPruneJob).filter(
            ClinicDataPruneJob.clinic_id == clinic_id,
            ClinicDataPruneJob.status.in_(("queued", "running", "failed")),
        ).order_by(ClinicDataPruneJob.created_at.desc()).first()
    return {"job": prune_job_to_dict(job) if job else None}


@router.post("/{clinic_id}/data-prune")
def start_prune(
    clinic_id: int,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    clinic = _clinic_for_admin(db, current_user, clinic_id)
    if payload.get("clinic_name") != clinic.name:
        raise HTTPException(status_code=422, detail="Clinic name confirmation does not match")
    try:
        verify_preview_token(str(payload.get("confirmation_token") or ""), clinic_id=clinic.id, user_id=current_user.id)
        job = create_prune_job(db, clinic=clinic, requested_by=current_user, counts=preview_counts(db, clinic.id))
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Clinic already has an active data cleanup") from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return prune_job_to_dict(job)


@router.get("/{clinic_id}/data-prune/{job_id}")
def get_prune(
    clinic_id: int,
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _clinic_for_admin(db, current_user, clinic_id)
    job = db.get(ClinicDataPruneJob, job_id)
    if not job or job.clinic_id != clinic_id:
        raise HTTPException(status_code=404, detail="Clinic cleanup job not found")
    return prune_job_to_dict(job)


@router.post("/{clinic_id}/data-prune/{job_id}/resume")
def resume_prune(
    clinic_id: int,
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _clinic_for_admin(db, current_user, clinic_id)
    job = db.get(ClinicDataPruneJob, job_id)
    if not job or job.clinic_id != clinic_id:
        raise HTTPException(status_code=404, detail="Clinic cleanup job not found")
    try:
        return prune_job_to_dict(resume_prune_job(db, job))
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
