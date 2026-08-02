from __future__ import annotations

from datetime import datetime, timedelta, timezone
import os
from typing import Any
from urllib.parse import unquote, urlparse
from uuid import uuid4

from jose import JWTError, jwt
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

import config
from models import (
    Appointment,
    AuthSession,
    Billing,
    BillingPayment,
    Campaign,
    CampaignClientExecution,
    Chat,
    ChatMessage,
    Client,
    Clinic,
    ClinicDataPruneJob,
    ClinicDataPruneStorageObject,
    ClinicDeviceTrust,
    ContactLensOrder,
    EmailLog,
    ExamLayoutInstance,
    Family,
    File,
    MedicalLog,
    MigrationSourceLink,
    OpticalExam,
    Order,
    OrderLineItem,
    PrescriptionSearchIndex,
    RecentClientVisit,
    Referral,
    ReferralEye,
    SoftOpticMigrationJob,
    User,
    WorkShift,
)
from services.file_storage_service import FileStorageService


ACTIVE_MIGRATION_STATUSES = {"awaiting_upload", "queued", "running", "paused"}
ACTIVE_PRUNE_STATUSES = {"queued", "running"}
PRUNE_LEASE_SECONDS = int(os.environ.get("CLINIC_PRUNE_LEASE_SECONDS", "120"))

COUNT_MODELS = {
    "clients": Client,
    "families": Family,
    "exams": OpticalExam,
    "orders": Order,
    "contact_lens_orders": ContactLensOrder,
    "appointments": Appointment,
    "referrals": Referral,
    "medical_logs": MedicalLog,
    "files": File,
    "campaigns": Campaign,
    "chats": Chat,
    "recent_visits": RecentClientVisit,
    "prescription_index": PrescriptionSearchIndex,
    "device_trusts": ClinicDeviceTrust,
    "source_links": MigrationSourceLink,
}

PRUNE_PREVIEW_SECTIONS = {
    "people": {"clients", "families"},
    "clinical": {
        "exams", "exam_instances", "appointments", "referrals", "referral_eyes",
        "medical_logs", "recent_visits", "prescription_index",
    },
    "commerce": {
        "orders", "contact_lens_orders", "billings", "billing_payments", "order_line_items",
    },
    "documents": {"files"},
    "communications": {"campaigns", "campaign_executions", "chats", "chat_messages", "email_logs"},
    "access": {"sessions", "work_shifts", "device_trusts", "source_links"},
}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def preview_counts(db: Session, clinic_id: int, section: str | None = None) -> dict[str, int]:
    if section is not None and section not in PRUNE_PREVIEW_SECTIONS:
        raise ValueError("Unknown cleanup preview section")
    requested = (
        PRUNE_PREVIEW_SECTIONS[section]
        if section is not None
        else set().union(*PRUNE_PREVIEW_SECTIONS.values())
    )
    counts: dict[str, int] = {}
    for name, model in COUNT_MODELS.items():
        if name in requested:
            counts[name] = int(db.query(func.count(model.id)).filter(model.clinic_id == clinic_id).scalar() or 0)
    if "work_shifts" in requested:
        user_ids = db.query(User.id).filter(User.clinic_id == clinic_id)
        counts["work_shifts"] = int(db.query(func.count(WorkShift.id)).filter(WorkShift.user_id.in_(user_ids)).scalar() or 0)
    if "sessions" in requested:
        counts["sessions"] = int(db.query(func.count(AuthSession.id)).filter(AuthSession.clinic_id == clinic_id).scalar() or 0)
    exam_ids = db.query(OpticalExam.id).filter(OpticalExam.clinic_id == clinic_id)
    order_ids = db.query(Order.id).filter(Order.clinic_id == clinic_id)
    contact_order_ids = db.query(ContactLensOrder.id).filter(ContactLensOrder.clinic_id == clinic_id)
    billing_ids = db.query(Billing.id).filter(
        or_(Billing.order_id.in_(order_ids), Billing.contact_lens_id.in_(contact_order_ids))
    )
    referral_ids = db.query(Referral.id).filter(Referral.clinic_id == clinic_id)
    appointment_ids = db.query(Appointment.id).filter(Appointment.clinic_id == clinic_id)
    campaign_ids = db.query(Campaign.id).filter(Campaign.clinic_id == clinic_id)
    chat_ids = db.query(Chat.id).filter(Chat.clinic_id == clinic_id)
    linked_counts = {
        "exam_instances": (ExamLayoutInstance.id, ExamLayoutInstance.exam_id.in_(exam_ids)),
        "billings": (Billing.id, Billing.id.in_(billing_ids)),
        "billing_payments": (BillingPayment.id, BillingPayment.billing_id.in_(billing_ids)),
        "order_line_items": (OrderLineItem.id, OrderLineItem.billings_id.in_(billing_ids)),
        "referral_eyes": (ReferralEye.id, ReferralEye.referral_id.in_(referral_ids)),
        "email_logs": (EmailLog.id, EmailLog.appointment_id.in_(appointment_ids)),
        "campaign_executions": (CampaignClientExecution.id, CampaignClientExecution.campaign_id.in_(campaign_ids)),
        "chat_messages": (ChatMessage.id, ChatMessage.chat_id.in_(chat_ids)),
    }
    for name, (column, predicate) in linked_counts.items():
        if name in requested:
            counts[name] = int(db.query(func.count(column)).filter(predicate).scalar() or 0)
    return counts


def create_preview_token(*, clinic_id: int, user_id: int) -> str:
    now = utcnow()
    return jwt.encode(
        {
            "purpose": "clinic-data-prune",
            "clinic_id": clinic_id,
            "user_id": user_id,
            "iat": now,
            "exp": now + timedelta(minutes=10),
        },
        config.settings.SECRET_KEY,
        algorithm=config.settings.ALGORITHM,
    )


def verify_preview_token(token: str, *, clinic_id: int, user_id: int) -> None:
    try:
        payload = jwt.decode(
            token,
            config.settings.SECRET_KEY,
            algorithms=[config.settings.ALGORITHM],
            audience=None,
            options={"verify_aud": False},
        )
    except JWTError as exc:
        raise ValueError("Prune confirmation has expired or is invalid") from exc
    if payload.get("purpose") != "clinic-data-prune" or payload.get("clinic_id") != clinic_id or payload.get("user_id") != user_id:
        raise ValueError("Prune confirmation does not match this clinic")


def create_prune_job(db: Session, *, clinic: Clinic, requested_by: User, counts: dict[str, int]) -> ClinicDataPruneJob:
    if clinic.maintenance_mode:
        raise ValueError("Clinic is already in maintenance mode; resume its existing cleanup job")
    if db.query(SoftOpticMigrationJob.id).filter(
        SoftOpticMigrationJob.clinic_id == clinic.id,
        SoftOpticMigrationJob.status.in_(ACTIVE_MIGRATION_STATUSES),
    ).first():
        raise ValueError("Clinic has an active migration")
    if db.query(ClinicDataPruneJob.id).filter(
        ClinicDataPruneJob.clinic_id == clinic.id,
        ClinicDataPruneJob.status.in_(ACTIVE_PRUNE_STATUSES),
    ).first():
        raise ValueError("Clinic already has an active data cleanup")
    job = ClinicDataPruneJob(
        id=uuid4().hex,
        clinic_id=clinic.id,
        company_id=clinic.company_id,
        requested_by_user_id=requested_by.id,
        status="queued",
        step="Waiting for cleanup worker",
        progress=2,
        checkpoint={},
        preview_counts=counts,
        deleted_counts={},
        warnings=[],
    )
    clinic.maintenance_mode = True
    clinic.maintenance_reason = "clinic-data-prune"
    clinic.maintenance_job_id = job.id
    clinic.maintenance_started_at = utcnow()
    db.add_all([job, clinic])
    db.commit()
    db.refresh(job)
    return job


def claim_next_prune_job(db: Session, worker_id: str) -> ClinicDataPruneJob | None:
    now = utcnow()
    query = db.query(ClinicDataPruneJob).filter(
        or_(
            ClinicDataPruneJob.status == "queued",
            (ClinicDataPruneJob.status == "running") & (
                ClinicDataPruneJob.lease_until.is_(None) | (ClinicDataPruneJob.lease_until < now)
            ),
        )
    ).order_by(ClinicDataPruneJob.created_at.asc())
    try:
        job = query.with_for_update(skip_locked=True).first()
    except Exception:
        db.rollback()
        job = query.first()
    if not job:
        return None
    job.status = "running"
    job.step = "Preparing clinic cleanup"
    job.locked_by = worker_id
    job.lease_until = now + timedelta(seconds=PRUNE_LEASE_SECONDS)
    job.heartbeat_at = now
    job.attempt_count = (job.attempt_count or 0) + 1
    job.started_at = job.started_at or now
    db.commit()
    db.refresh(job)
    return job


def _queue_storage_objects(db: Session, job: ClinicDataPruneJob) -> int:
    existing = {
        (row.bucket, row.storage_key)
        for row in db.query(ClinicDataPruneStorageObject).filter(ClinicDataPruneStorageObject.job_id == job.id).all()
    }
    objects: set[tuple[str, str]] = set()
    for row in db.query(File.storage_bucket, File.storage_key).filter(File.clinic_id == job.clinic_id).all():
        if row.storage_bucket and row.storage_key:
            objects.add((row.storage_bucket, row.storage_key))
    profile_urls = [
        row[0]
        for row in db.query(Client.profile_picture).filter(Client.clinic_id == job.clinic_id).all()
    ]
    for value in profile_urls:
        parsed = _parse_managed_storage_object(value)
        if parsed:
            objects.add(parsed)
    for row in db.query(SoftOpticMigrationJob).filter(SoftOpticMigrationJob.clinic_id == job.clinic_id).all():
        if row.bundle_storage_bucket and row.bundle_storage_key:
            objects.add((row.bundle_storage_bucket, row.bundle_storage_key))
            row.bundle_storage_bucket = None
            row.bundle_storage_key = None
            row.bundle_path = None
    for bucket, key in sorted(objects - existing):
        db.add(ClinicDataPruneStorageObject(job_id=job.id, bucket=bucket, storage_key=key, status="pending"))
    db.flush()
    return len(objects)


def _parse_managed_storage_object(value: Any) -> tuple[str, str] | None:
    if not isinstance(value, str) or not value.strip():
        return None
    raw = value.strip()
    default_bucket = config.settings.SUPABASE_BUCKET or "opticai"
    if raw.startswith("/storage/") or raw.startswith("storage/"):
        key = raw.lstrip("/").removeprefix("storage/")
        if key.startswith(f"{default_bucket}/"):
            key = key[len(default_bucket) + 1:]
        return (default_bucket, key) if key else None
    parsed = urlparse(raw)
    configured = urlparse(config.settings.SUPABASE_URL or "")
    if parsed.scheme not in {"http", "https"} or not configured.netloc or parsed.netloc != configured.netloc:
        return None
    marker = "/storage/v1/object/"
    if marker not in parsed.path:
        return None
    suffix = unquote(parsed.path.split(marker, 1)[1]).lstrip("/")
    for prefix in ("public/", "sign/", "authenticated/"):
        if suffix.startswith(prefix):
            suffix = suffix[len(prefix):]
            break
    bucket, separator, key = suffix.partition("/")
    if not separator or not bucket or not key:
        return None
    return bucket, key


def _delete_operational_rows(db: Session, job: ClinicDataPruneJob) -> dict[str, int]:
    clinic_id = job.clinic_id
    counts = preview_counts(db, clinic_id)
    user_ids = [row[0] for row in db.query(User.id).filter(User.clinic_id == clinic_id).all()]
    exam_ids = db.query(OpticalExam.id).filter(OpticalExam.clinic_id == clinic_id)
    order_ids = db.query(Order.id).filter(Order.clinic_id == clinic_id)
    contact_order_ids = db.query(ContactLensOrder.id).filter(ContactLensOrder.clinic_id == clinic_id)
    billing_ids = db.query(Billing.id).filter(
        or_(Billing.order_id.in_(order_ids), Billing.contact_lens_id.in_(contact_order_ids))
    )
    referral_ids = db.query(Referral.id).filter(Referral.clinic_id == clinic_id)
    appointment_ids = db.query(Appointment.id).filter(Appointment.clinic_id == clinic_id)
    campaign_ids = db.query(Campaign.id).filter(Campaign.clinic_id == clinic_id)
    chat_ids = db.query(Chat.id).filter(Chat.clinic_id == clinic_id)

    if user_ids:
        db.query(WorkShift).filter(WorkShift.user_id.in_(user_ids)).delete(synchronize_session=False)
        db.query(AuthSession).filter(or_(AuthSession.clinic_id == clinic_id, AuthSession.user_id.in_(user_ids))).delete(synchronize_session=False)
    else:
        db.query(AuthSession).filter(AuthSession.clinic_id == clinic_id).delete(synchronize_session=False)
    db.query(ExamLayoutInstance).filter(ExamLayoutInstance.exam_id.in_(exam_ids)).delete(synchronize_session=False)
    db.query(BillingPayment).filter(BillingPayment.billing_id.in_(billing_ids)).delete(synchronize_session=False)
    db.query(OrderLineItem).filter(OrderLineItem.billings_id.in_(billing_ids)).delete(synchronize_session=False)
    db.query(Billing).filter(Billing.id.in_(billing_ids)).delete(synchronize_session=False)
    db.query(ReferralEye).filter(ReferralEye.referral_id.in_(referral_ids)).delete(synchronize_session=False)
    db.query(EmailLog).filter(EmailLog.appointment_id.in_(appointment_ids)).delete(synchronize_session=False)
    db.query(CampaignClientExecution).filter(CampaignClientExecution.campaign_id.in_(campaign_ids)).delete(synchronize_session=False)
    db.query(ChatMessage).filter(ChatMessage.chat_id.in_(chat_ids)).delete(synchronize_session=False)
    for model in (
        RecentClientVisit,
        PrescriptionSearchIndex,
        Campaign,
        Chat,
        Appointment,
        Referral,
        MedicalLog,
        File,
        ContactLensOrder,
        Order,
        OpticalExam,
        Client,
        Family,
        ClinicDeviceTrust,
        MigrationSourceLink,
    ):
        db.query(model).filter(model.clinic_id == clinic_id).delete(synchronize_session=False)
    return counts


def run_prune_job(db: Session, job: ClinicDataPruneJob, storage: FileStorageService | None) -> None:
    try:
        checkpoint = dict(job.checkpoint or {})
        if not checkpoint.get("database_deleted"):
            job.step = "Inventorying stored files"
            job.progress = 12
            _queue_storage_objects(db, job)
            db.commit()

            job.step = "Deleting clinic operational data"
            job.progress = 30
            deleted_counts = _delete_operational_rows(db, job)
            checkpoint["database_deleted"] = True
            job.deleted_counts = deleted_counts
            job.checkpoint = checkpoint
            job.progress = 75
            db.commit()

        warnings: list[str] = []
        pending = db.query(ClinicDataPruneStorageObject).filter(
            ClinicDataPruneStorageObject.job_id == job.id,
            ClinicDataPruneStorageObject.status != "deleted",
        ).all()
        job.step = "Deleting stored files"
        for item in pending:
            try:
                if storage:
                    storage.remove(item.bucket, item.storage_key)
                else:
                    raise RuntimeError("Storage service is unavailable")
                item.status = "deleted"
                item.deleted_at = utcnow()
                item.error = None
            except Exception as exc:
                item.status = "failed"
                item.attempt_count = (item.attempt_count or 0) + 1
                item.error = str(exc)
                warnings.append(f"Could not delete {item.bucket}/{item.storage_key}")
        job.warnings = warnings
        db.commit()

        remaining = {key: value for key, value in preview_counts(db, job.clinic_id).items() if value}
        if remaining:
            raise RuntimeError(f"Clinic cleanup verification failed: {remaining}")
        if warnings:
            raise RuntimeError("Stored file cleanup is incomplete and can be resumed")
        clinic = db.get(Clinic, job.clinic_id)
        if clinic:
            clinic.maintenance_mode = False
            clinic.maintenance_reason = None
            clinic.maintenance_job_id = None
            clinic.maintenance_started_at = None
        job.status = "completed"
        job.step = "Clinic data cleanup completed"
        job.progress = 100
        job.finished_at = utcnow()
        job.warnings = warnings
        job.error = None
        job.lease_until = None
        db.commit()
    except Exception as exc:
        db.rollback()
        current = db.get(ClinicDataPruneJob, job.id)
        if current:
            current.status = "failed"
            current.step = "Clinic data cleanup failed"
            current.error = str(exc)
            current.lease_until = None
            db.commit()


def resume_prune_job(db: Session, job: ClinicDataPruneJob) -> ClinicDataPruneJob:
    if job.status != "failed":
        raise ValueError("Only failed cleanup jobs can be resumed")
    job.status = "queued"
    job.step = "Waiting to resume"
    job.error = None
    job.locked_by = None
    job.lease_until = None
    db.commit()
    db.refresh(job)
    return job


def prune_job_to_dict(job: ClinicDataPruneJob) -> dict[str, Any]:
    return {
        "id": job.id,
        "clinic_id": job.clinic_id,
        "status": job.status,
        "step": job.step,
        "progress": job.progress,
        "preview_counts": job.preview_counts or {},
        "deleted_counts": job.deleted_counts or {},
        "warnings": job.warnings or [],
        "error": job.error,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "finished_at": job.finished_at.isoformat() if job.finished_at else None,
    }
