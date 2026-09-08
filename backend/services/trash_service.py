from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone
import logging
from typing import Any

import requests
from fastapi import HTTPException
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session
from zoneinfo import ZoneInfo

from auth import decrypt_secret
from models import (
    Appointment,
    Billing,
    BillingPayment,
    Client,
    ContactLensOrder,
    ExamLayoutInstance,
    File,
    MedicalLog,
    OpticalExam,
    Order,
    OrderLineItem,
    PrescriptionSearchIndex,
    Referral,
    ReferralEye,
    SoftDeletableMixin,
    TrashAuditEvent,
    TrashItem,
    TrashJob,
    TrashMember,
    User,
)
from security.scope import assert_clinic_scope, resolve_company_id
from services.file_storage_service import FileStorageService
from services.inventory_service import release_order_allocations_for_delete, restore_order_allocations
from services.prescription_search_index import (
    delete_source_index_rows,
    rebuild_contact_lens_order_index,
    rebuild_exam_instance_index,
    rebuild_order_index,
    rebuild_referral_index,
)


logger = logging.getLogger(__name__)
RETENTION_DAYS = 30
WORKER_LEVEL = 2
CEO_LEVEL = 4

ENTITY_MODELS: dict[str, type[SoftDeletableMixin]] = {
    "client": Client,
    "order": Order,
    "contact_lens_order": ContactLensOrder,
    "exam": OpticalExam,
    "referral": Referral,
    "medical_log": MedicalLog,
    "appointment": Appointment,
    "file": File,
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _include_deleted(query):
    return query.execution_options(include_deleted=True)


def _require_editor(user: User) -> None:
    if (user.role_level or 1) < WORKER_LEVEL:
        raise HTTPException(status_code=403, detail="Editing permission is required")


def _entity(db: Session, entity_type: str, entity_id: int, *, lock: bool = False):
    model = ENTITY_MODELS.get(entity_type)
    if not model:
        raise HTTPException(status_code=404, detail="Unsupported Trash record type")
    query = _include_deleted(db.query(model)).filter(model.id == entity_id)
    if lock:
        query = query.with_for_update()
    row = query.first()
    if not row:
        raise HTTPException(status_code=404, detail="Record not found")
    return row


def _client_label(client: Client | None) -> str | None:
    if not client:
        return None
    value = " ".join(part for part in (client.first_name, client.last_name) if part).strip()
    return value or f"#{client.id}"


def _display_label(entity_type: str, row: Any, client_label: str | None) -> str:
    if entity_type == "client":
        return client_label or f"#{row.id}"
    content_label = {
        "exam": getattr(row, "test_name", None),
        "appointment": getattr(row, "exam_name", None),
        "file": getattr(row, "file_name", None),
    }.get(entity_type)
    return content_label or f"#{row.id}"


def _members_for_delete(db: Session, entity_type: str, row: Any) -> list[tuple[str, Any]]:
    if entity_type != "client":
        return [(entity_type, row)]
    members: list[tuple[str, Any]] = [("client", row)]
    for child_type, model in ENTITY_MODELS.items():
        if child_type == "client":
            continue
        children = db.query(model).filter(model.client_id == row.id).with_for_update().all()
        members.extend((child_type, child) for child in children)
    return members


def _included_counts(db: Session, members: list[tuple[str, Any]]) -> dict[str, int]:
    counts = Counter(entity_type for entity_type, _row in members)
    order_ids = [row.id for kind, row in members if kind == "order"]
    contact_ids = [row.id for kind, row in members if kind == "contact_lens_order"]
    filters = []
    if order_ids:
        filters.append(Billing.order_id.in_(order_ids))
    if contact_ids:
        filters.append(Billing.contact_lens_id.in_(contact_ids))
    billings = db.query(Billing).filter(or_(*filters)).all() if filters else []
    billing_ids = [row.id for row in billings]
    counts["billing"] = len(billings)
    counts["billing_payment"] = db.query(BillingPayment).filter(BillingPayment.billing_id.in_(billing_ids)).count() if billing_ids else 0
    counts["order_line_item"] = db.query(OrderLineItem).filter(OrderLineItem.billings_id.in_(billing_ids)).count() if billing_ids else 0
    exam_ids = [row.id for kind, row in members if kind == "exam"]
    referral_ids = [row.id for kind, row in members if kind == "referral"]
    counts["exam_layout_instance"] = db.query(ExamLayoutInstance).filter(ExamLayoutInstance.exam_id.in_(exam_ids)).count() if exam_ids else 0
    counts["referral_eye"] = db.query(ReferralEye).filter(ReferralEye.referral_id.in_(referral_ids)).count() if referral_ids else 0
    return {key: value for key, value in counts.items() if value}


def _remove_search_rows(db: Session, entity_type: str, row: Any) -> None:
    if entity_type in {"order", "contact_lens_order", "referral"}:
        delete_source_index_rows(db, entity_type, row.id)
    elif entity_type == "exam":
        db.query(PrescriptionSearchIndex).filter(PrescriptionSearchIndex.exam_id == row.id).delete(synchronize_session=False)


def _rebuild_search_rows(db: Session, entity_type: str, row: Any) -> None:
    if entity_type == "order":
        rebuild_order_index(db, row)
    elif entity_type == "contact_lens_order":
        rebuild_contact_lens_order_index(db, row)
    elif entity_type == "referral":
        rebuild_referral_index(db, row)
    elif entity_type == "exam":
        for instance in _include_deleted(db.query(ExamLayoutInstance)).filter(ExamLayoutInstance.exam_id == row.id).all():
            rebuild_exam_instance_index(db, instance)


def _add_event(db: Session, item: TrashItem, event_type: str, actor_id: int | None, metadata: dict | None = None) -> None:
    db.add(
        TrashAuditEvent(
            trash_item_id=item.id,
            company_id=item.company_id,
            clinic_id=item.clinic_id,
            entity_type=item.root_entity_type,
            entity_id=item.root_entity_id,
            event_type=event_type,
            actor_user_id=actor_id,
            event_metadata=metadata or {},
        )
    )


def _enqueue(db: Session, item: TrashItem, job_type: str, payload: dict | None = None) -> TrashJob:
    generation = (
        db.query(TrashJob.generation)
        .filter(TrashJob.trash_item_id == item.id, TrashJob.job_type == job_type)
        .order_by(TrashJob.generation.desc())
        .scalar()
        or 0
    ) + 1
    job = TrashJob(trash_item_id=item.id, job_type=job_type, generation=generation, payload=payload or {})
    db.add(job)
    return job


def move_to_trash(db: Session, current_user: User, entity_type: str, entity_id: int) -> TrashItem:
    _require_editor(current_user)
    row = _entity(db, entity_type, entity_id, lock=True)
    if row.deleted_at is not None:
        existing = db.get(TrashItem, row.trash_item_id) if row.trash_item_id else None
        if existing:
            return existing
        raise HTTPException(status_code=409, detail="Record is already deleted")

    clinic_id = row.clinic_id
    assert_clinic_scope(db, current_user, clinic_id)
    company_id = resolve_company_id(db, current_user)
    members = _members_for_delete(db, entity_type, row)
    foreign_clinics = {member.clinic_id for _kind, member in members if member.clinic_id != clinic_id}
    if foreign_clinics and (current_user.role_level or 1) < CEO_LEVEL:
        raise HTTPException(status_code=409, detail="Client records span multiple clinics")
    for member_clinic_id in foreign_clinics:
        assert_clinic_scope(db, current_user, member_clinic_id)

    client = row if entity_type == "client" else db.query(Client).filter(Client.id == row.client_id).first()
    client_label = _client_label(client)
    now = _utcnow()
    item = TrashItem(
        company_id=company_id,
        clinic_id=clinic_id,
        root_entity_type=entity_type,
        root_entity_id=row.id,
        display_label=_display_label(entity_type, row, client_label),
        client_id=client.id if client else None,
        client_label=client_label,
        deleted_by_user_id=current_user.id,
        deleted_at=now,
        expires_at=now + timedelta(days=RETENTION_DAYS),
        included_counts=_included_counts(db, members),
    )
    db.add(item)
    db.flush()

    appointment_ids: list[int] = []
    for member_type, member in members:
        member.deleted_at = now
        member.deleted_by_user_id = current_user.id
        member.trash_item_id = item.id
        db.add(TrashMember(trash_item_id=item.id, entity_type=member_type, entity_id=member.id))
        _remove_search_rows(db, member_type, member)
        if member_type == "order":
            release_order_allocations_for_delete(db, order=member, current_user=current_user, contact=False)
        elif member_type == "contact_lens_order":
            release_order_allocations_for_delete(db, order=member, current_user=current_user, contact=True)
        elif member_type == "appointment" and member.google_calendar_event_id:
            appointment_ids.append(member.id)

    if appointment_ids:
        _enqueue(db, item, "calendar_delete", {"appointment_ids": appointment_ids})
    _add_event(db, item, "deleted", current_user.id, {"included_counts": item.included_counts})
    db.commit()
    db.refresh(item)
    return item


def _scoped_item(db: Session, current_user: User, item_id: int, *, lock: bool = False) -> TrashItem:
    query = db.query(TrashItem).filter(TrashItem.id == item_id)
    if lock:
        query = query.with_for_update()
    item = query.first()
    if not item:
        raise HTTPException(status_code=404, detail="Trash item not found")
    assert_clinic_scope(db, current_user, item.clinic_id)
    return item


def restore_item(db: Session, current_user: User, item_id: int) -> dict[str, Any]:
    _require_editor(current_user)
    item = _scoped_item(db, current_user, item_id, lock=True)
    if item.status == "restored":
        return {"trash_item_id": item.id, "status": item.status, "restored": [], "warnings": item.warnings or []}
    if item.status != "trashed":
        raise HTTPException(status_code=409, detail="Trash item cannot be restored")
    now = _utcnow()
    expires_at = item.expires_at if item.expires_at.tzinfo else item.expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= now:
        raise HTTPException(status_code=409, detail="Trash item has expired")

    members = db.query(TrashMember).filter(TrashMember.trash_item_id == item.id).order_by(TrashMember.id).all()
    if item.root_entity_type != "client" and item.client_id:
        parent = db.query(Client).filter(Client.id == item.client_id).first()
        if not parent:
            raise HTTPException(status_code=409, detail="Restore the client first")

    restored: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    appointment_ids: list[int] = []
    for member in members:
        row = _entity(db, member.entity_type, member.entity_id, lock=True)
        if row.trash_item_id != item.id:
            continue
        row.deleted_at = None
        row.deleted_by_user_id = None
        row.trash_item_id = None
        restored.append({"type": member.entity_type, "id": member.entity_id})
        _rebuild_search_rows(db, member.entity_type, row)
        if member.entity_type == "order":
            warnings.extend(restore_order_allocations(db, order=row, current_user=current_user, contact=False))
        elif member.entity_type == "contact_lens_order":
            warnings.extend(restore_order_allocations(db, order=row, current_user=current_user, contact=True))
        elif member.entity_type == "file":
            warnings.append({"code": "file_availability_check_pending", "file_id": row.id})
        elif member.entity_type == "appointment":
            appointment_ids.append(row.id)

    item.status = "restored"
    item.restored_by_user_id = current_user.id
    item.restored_at = now
    item.warnings = warnings
    if appointment_ids:
        _enqueue(db, item, "calendar_restore", {"appointment_ids": appointment_ids})
    file_ids = [entry["id"] for entry in restored if entry["type"] == "file"]
    if file_ids:
        _enqueue(db, item, "file_check", {"file_ids": file_ids})
    _add_event(db, item, "restored", current_user.id, {"warnings": warnings})
    db.commit()
    return {"trash_item_id": item.id, "status": item.status, "restored": restored, "warnings": warnings}


def request_purge(db: Session, current_user: User, item_id: int) -> TrashItem:
    if (current_user.role_level or 1) < CEO_LEVEL:
        raise HTTPException(status_code=403, detail="Company owner permission is required")
    item = _scoped_item(db, current_user, item_id, lock=True)
    if item.status == "purged":
        return item
    if item.status != "trashed":
        raise HTTPException(status_code=409, detail="Trash item cannot be permanently deleted")
    item.status = "purging"
    item.purge_requested_by_user_id = current_user.id
    item.purge_requested_at = _utcnow()
    _enqueue(db, item, "purge")
    _add_event(db, item, "purge_requested", current_user.id)
    db.commit()
    db.refresh(item)
    return item


def retry_failed_jobs(db: Session, current_user: User, item_id: int) -> int:
    _require_editor(current_user)
    item = _scoped_item(db, current_user, item_id)
    jobs = db.query(TrashJob).filter(TrashJob.trash_item_id == item.id, TrashJob.status == "failed").all()
    for job in jobs:
        job.status = "pending"
        job.available_at = _utcnow()
        job.claimed_at = None
        job.claimed_by = None
        job.last_error = None
    db.commit()
    return len(jobs)


def enqueue_expired_items(db: Session, *, limit: int = 50) -> int:
    now = _utcnow()
    items = (
        db.query(TrashItem)
        .filter(TrashItem.status == "trashed", TrashItem.expires_at <= now)
        .order_by(TrashItem.expires_at)
        .with_for_update(skip_locked=True)
        .limit(limit)
        .all()
    )
    for item in items:
        item.status = "purging"
        item.purge_requested_at = now
        _enqueue(db, item, "purge")
        _add_event(db, item, "purge_requested", None, {"reason": "expired"})
    if items:
        db.commit()
    return len(items)


def claim_next_job(db: Session, worker_id: str, *, allow_purge: bool = True) -> TrashJob | None:
    now = _utcnow()
    stale_before = now - timedelta(minutes=5)
    query = db.query(TrashJob)
    if not allow_purge:
        query = query.filter(TrashJob.job_type != "purge")
    job = (
        query
        .filter(
            or_(
                and_(TrashJob.status == "pending", TrashJob.available_at <= now),
                and_(TrashJob.status == "running", TrashJob.claimed_at < stale_before),
            )
        )
        .order_by(TrashJob.created_at, TrashJob.id)
        .with_for_update(skip_locked=True)
        .first()
    )
    if not job:
        return None
    job.status = "running"
    job.claimed_at = now
    job.claimed_by = worker_id
    job.attempt_count = (job.attempt_count or 0) + 1
    db.commit()
    db.refresh(job)
    return job


def _calendar_headers(user: User) -> dict[str, str]:
    token = decrypt_secret(user.google_access_token) if user.google_access_token else None
    if not token or not user.google_account_connected or not user.google_calendar_sync_enabled:
        raise RuntimeError("Calendar owner is disconnected")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _calendar_delete(db: Session, appointment_ids: list[int]) -> None:
    for appointment_id in appointment_ids:
        appointment = _include_deleted(db.query(Appointment)).filter(Appointment.id == appointment_id).first()
        if not appointment or appointment.deleted_at is None or not appointment.google_calendar_event_id or not appointment.user_id:
            continue
        owner = db.get(User, appointment.user_id)
        if not owner:
            continue
        response = requests.delete(
            f"https://www.googleapis.com/calendar/v3/calendars/primary/events/{appointment.google_calendar_event_id}",
            headers=_calendar_headers(owner),
            params={"sendUpdates": "none"},
            timeout=15,
        )
        if response.status_code not in {204, 404, 410}:
            raise RuntimeError(f"Calendar deletion failed ({response.status_code})")


def _calendar_restore(db: Session, job: TrashJob, appointment_ids: list[int]) -> None:
    for appointment_id in appointment_ids:
        appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
        if not appointment or not appointment.user_id or not appointment.date or not appointment.time:
            continue
        owner = db.get(User, appointment.user_id)
        if not owner:
            continue
        recovery_event_id = f"707279736d{job.trash_item_id:x}{appointment.id:x}{job.generation:x}"
        event_id = appointment.google_calendar_event_id or recovery_event_id
        appointment_time = datetime.strptime(str(appointment.time)[:5], "%H:%M").time()
        start = datetime.combine(appointment.date, appointment_time).replace(tzinfo=ZoneInfo("Asia/Jerusalem"))
        end = start + timedelta(minutes=appointment.duration or 30)
        payload = {
            "id": event_id,
            "summary": appointment.exam_name or "Eye examination",
            "description": appointment.note or "",
            "start": {"dateTime": start.isoformat(), "timeZone": "Asia/Jerusalem"},
            "end": {"dateTime": end.isoformat(), "timeZone": "Asia/Jerusalem"},
            "extendedProperties": {"private": {"prysmAppointmentId": str(appointment.id)}},
        }
        headers = _calendar_headers(owner)
        existing = requests.get(
            f"https://www.googleapis.com/calendar/v3/calendars/primary/events/{event_id}",
            headers=headers,
            timeout=15,
        )
        if existing.status_code == 200:
            response = requests.put(
                f"https://www.googleapis.com/calendar/v3/calendars/primary/events/{event_id}",
                headers=headers,
                params={"sendUpdates": "none"},
                json=payload,
                timeout=15,
            )
        elif existing.status_code in {404, 410}:
            event_id = recovery_event_id
            payload["id"] = event_id
            response = requests.post(
                "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                headers=headers,
                params={"sendUpdates": "none"},
                json=payload,
                timeout=15,
            )
        else:
            raise RuntimeError(f"Calendar lookup failed ({existing.status_code})")
        if response.status_code == 409:
            response = requests.put(
                f"https://www.googleapis.com/calendar/v3/calendars/primary/events/{event_id}",
                headers=headers,
                params={"sendUpdates": "none"},
                json=payload,
                timeout=15,
            )
        if response.status_code not in {200, 201}:
            raise RuntimeError(f"Calendar restoration failed ({response.status_code})")
        appointment.google_calendar_event_id = event_id


def _file_check(db: Session, job: TrashJob, storage: FileStorageService, file_ids: list[int]) -> None:
    item = db.get(TrashItem, job.trash_item_id)
    if not item:
        return
    warnings = [warning for warning in (item.warnings or []) if warning.get("code") != "file_availability_check_pending"]
    for file_id in file_ids:
        file = db.query(File).filter(File.id == file_id).first()
        if not file:
            continue
        if file.storage_bucket == "legacy-local":
            warnings.append({"code": "legacy_file_check_unavailable", "file_id": file.id})
        elif not file.storage_bucket or not file.storage_key or not storage.exists(file.storage_bucket, file.storage_key):
            warnings.append({"code": "file_missing", "file_id": file.id})
    item.warnings = warnings


def _purge(db: Session, job: TrashJob, storage: FileStorageService) -> None:
    item = db.query(TrashItem).filter(TrashItem.id == job.trash_item_id).with_for_update().first()
    if not item or item.status == "purged":
        return
    members = db.query(TrashMember).filter(TrashMember.trash_item_id == item.id).all()
    files: list[File] = []
    for member in members:
        if member.entity_type == "file":
            row = _include_deleted(db.query(File)).filter(File.id == member.entity_id).first()
            if row:
                files.append(row)
    for file in files:
        if file.storage_bucket and file.storage_key and file.storage_bucket != "legacy-local":
            shared = (
                _include_deleted(db.query(File))
                .filter(File.id != file.id, File.storage_bucket == file.storage_bucket, File.storage_key == file.storage_key)
                .count()
            )
            if not shared:
                try:
                    storage.remove(file.storage_bucket, file.storage_key)
                except HTTPException as exc:
                    if "not found" not in str(exc.detail).lower():
                        raise
    root = _entity(db, item.root_entity_type, item.root_entity_id, lock=True)
    db.delete(root)
    db.flush()
    db.query(TrashMember).filter(TrashMember.trash_item_id == item.id).delete(synchronize_session=False)
    item.status = "purged"
    item.display_label = "[purged]"
    item.client_id = None
    item.client_label = None
    item.included_counts = {}
    item.warnings = []
    _add_event(db, item, "purged", item.purge_requested_by_user_id)


def run_job(db: Session, job: TrashJob, storage: FileStorageService) -> None:
    try:
        payload = job.payload or {}
        if job.job_type == "purge":
            _purge(db, job, storage)
        elif job.job_type == "calendar_delete":
            _calendar_delete(db, payload.get("appointment_ids") or [])
        elif job.job_type == "calendar_restore":
            _calendar_restore(db, job, payload.get("appointment_ids") or [])
        elif job.job_type == "file_check":
            _file_check(db, job, storage, payload.get("file_ids") or [])
        job.status = "completed"
        job.finished_at = _utcnow()
        job.last_error = None
        db.commit()
    except Exception as exc:
        db.rollback()
        current = db.get(TrashJob, job.id)
        if current:
            current.status = "failed" if current.attempt_count >= 5 else "pending"
            current.available_at = _utcnow() + timedelta(minutes=min(60, 2 ** current.attempt_count))
            current.last_error = str(exc)[:1000]
            db.commit()
        logger.exception("Trash job %s failed", job.id)
