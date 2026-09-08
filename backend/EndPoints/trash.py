from datetime import date, datetime, time, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Appointment, Client, ContactLensOrder, File, MedicalLog, OpticalExam, Order, Referral, TrashItem, TrashJob, TrashMember, User
from security.scope import get_allowed_clinic_ids
from services.file_storage_service import FileStorageService, get_file_storage_service
from services.trash_service import request_purge, restore_item, retry_failed_jobs


router = APIRouter(prefix="/trash", tags=["trash"])
WORKER_LEVEL = 2


def _require_editor(user: User) -> None:
    if (user.role_level or 1) < WORKER_LEVEL:
        raise HTTPException(status_code=403, detail="Editing permission is required")


def _serialize(item: TrashItem, deleted_by: str | None = None) -> dict:
    return {
        "id": item.id,
        "company_id": item.company_id,
        "clinic_id": item.clinic_id,
        "root_entity_type": item.root_entity_type,
        "root_entity_id": item.root_entity_id,
        "display_label": item.display_label,
        "client_id": item.client_id,
        "client_label": item.client_label,
        "deleted_by_user_id": item.deleted_by_user_id,
        "deleted_by": deleted_by,
        "deleted_at": item.deleted_at,
        "expires_at": item.expires_at,
        "status": item.status,
        "included_counts": item.included_counts or {},
        "warnings": item.warnings or [],
    }


def _preview_value(value):
    if isinstance(value, (date, datetime, time)):
        return value.isoformat()
    return value


def _root_preview(db: Session, item: TrashItem) -> dict:
    models = {
        "client": (Client, ("first_name", "last_name", "phone_mobile", "email", "national_id")),
        "order": (Order, ("order_date", "type")),
        "contact_lens_order": (ContactLensOrder, ("order_date", "type", "r_model", "l_model")),
        "exam": (OpticalExam, ("exam_date", "test_name")),
        "referral": (Referral, ("date", "recipient", "urgency_level", "referral_notes")),
        "medical_log": (MedicalLog, ("log_date", "log")),
        "appointment": (Appointment, ("date", "time", "exam_name", "note")),
        "file": (File, ("file_name", "original_file_name", "file_type", "file_size", "upload_date", "notes")),
    }
    definition = models.get(item.root_entity_type)
    if not definition:
        return {}
    model, fields = definition
    row = db.query(model).execution_options(include_deleted=True).filter(model.id == item.root_entity_id).first()
    if not row:
        return {}
    return {
        field: _preview_value(getattr(row, field, None)[:1000] if isinstance(getattr(row, field, None), str) else getattr(row, field, None))
        for field in fields
        if getattr(row, field, None) not in (None, "")
    }


@router.get("")
def list_trash(
    clinic_id: Optional[int] = Query(None),
    entity_type: Optional[str] = Query(None),
    deleted_by_user_id: Optional[int] = Query(None),
    deleted_from: Optional[date] = Query(None),
    deleted_to: Optional[date] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_editor(current_user)
    clinic_ids = get_allowed_clinic_ids(db, current_user, clinic_id)
    query = (
        db.query(TrashItem, User.full_name)
        .outerjoin(User, User.id == TrashItem.deleted_by_user_id)
        .filter(TrashItem.clinic_id.in_(clinic_ids), TrashItem.status.in_(("trashed", "purging")))
    )
    if entity_type:
        query = query.filter(TrashItem.root_entity_type == entity_type)
    if deleted_by_user_id:
        query = query.filter(TrashItem.deleted_by_user_id == deleted_by_user_id)
    if deleted_from:
        query = query.filter(TrashItem.deleted_at >= datetime.combine(deleted_from, time.min, tzinfo=timezone.utc))
    if deleted_to:
        query = query.filter(TrashItem.deleted_at <= datetime.combine(deleted_to, time.max, tzinfo=timezone.utc))
    if search and search.strip():
        term = f"%{search.strip()}%"
        numeric_id = int(search) if search.strip().isdigit() else None
        predicates = [TrashItem.display_label.ilike(term), TrashItem.client_label.ilike(term)]
        if numeric_id is not None:
            predicates.extend((TrashItem.root_entity_id == numeric_id, TrashItem.client_id == numeric_id))
        query = query.filter(or_(*predicates))
    total = query.with_entities(func.count(TrashItem.id)).scalar() or 0
    rows = query.order_by(TrashItem.deleted_at.desc(), TrashItem.id.desc()).offset(offset).limit(limit).all()
    return {"items": [_serialize(item, deleted_by) for item, deleted_by in rows], "total": total, "limit": limit, "offset": offset}


@router.get("/{item_id}")
def get_trash_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_editor(current_user)
    row = (
        db.query(TrashItem, User.full_name)
        .outerjoin(User, User.id == TrashItem.deleted_by_user_id)
        .filter(TrashItem.id == item_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Trash item not found")
    item, deleted_by = row
    get_allowed_clinic_ids(db, current_user, item.clinic_id)
    members = db.query(TrashMember).filter(TrashMember.trash_item_id == item.id).all()
    jobs = db.query(TrashJob).filter(TrashJob.trash_item_id == item.id).order_by(TrashJob.created_at.desc()).all()
    payload = _serialize(item, deleted_by)
    payload["preview"] = _root_preview(db, item)
    payload["members"] = [{"type": member.entity_type, "id": member.entity_id} for member in members]
    payload["jobs"] = [
        {"id": job.id, "type": job.job_type, "status": job.status, "attempt_count": job.attempt_count, "last_error": job.last_error}
        for job in jobs
    ]
    return payload


@router.post("/{item_id}/restore")
def restore_trash_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return restore_item(db, current_user, item_id)


@router.delete("/{item_id}", status_code=202)
def permanently_delete_trash_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = request_purge(db, current_user, item_id)
    return {"trash_item_id": item.id, "status": item.status}


@router.post("/{item_id}/retry")
def retry_trash_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return {"retried": retry_failed_jobs(db, current_user, item_id)}


@router.get("/{item_id}/files/{file_id}/preview")
def preview_trashed_file(
    item_id: int,
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    storage: FileStorageService = Depends(get_file_storage_service),
):
    _require_editor(current_user)
    item = db.query(TrashItem).filter(TrashItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Trash item not found")
    get_allowed_clinic_ids(db, current_user, item.clinic_id)
    if item.status != "trashed":
        raise HTTPException(status_code=409, detail="File preview is unavailable during permanent cleanup")
    member = db.query(TrashMember).filter(
        TrashMember.trash_item_id == item.id,
        TrashMember.entity_type == "file",
        TrashMember.entity_id == file_id,
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="File is not in this Trash item")
    file = db.query(File).execution_options(include_deleted=True).filter(File.id == file_id).first()
    if not file or not file.storage_bucket or not file.storage_key:
        raise HTTPException(status_code=404, detail="Stored file is unavailable")
    if file.storage_bucket == "legacy-local":
        raise HTTPException(status_code=409, detail="Legacy local files cannot be previewed from Trash")
    return {"url": storage.create_signed_url(file.storage_bucket, file.storage_key, 300)}
