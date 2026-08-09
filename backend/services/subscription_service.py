from datetime import datetime, timedelta
from typing import Optional
import uuid

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from config import settings
from models import Clinic, Subscription, User
from services.plan_catalog import PlanDefinition, require_plan


FULL_STATUSES = {"trialing", "active", "legacy_active"}


def utcnow() -> datetime:
    return datetime.utcnow()


def get_subscription(db: Session, company_id: int) -> Optional[Subscription]:
    return db.query(Subscription).filter(Subscription.company_id == company_id).first()


def ensure_legacy_subscription(db: Session, company_id: int) -> Subscription:
    subscription = get_subscription(db, company_id)
    if subscription:
        return subscription
    subscription = Subscription(
        id=f"legacy-{company_id}", company_id=company_id, plan_code="legacy",
        status="legacy_active", clinic_limit=None, staff_limit=None,
    )
    db.add(subscription)
    db.flush()
    return subscription


def create_pending_subscription(db: Session, company_id: int, plan_code: str) -> Subscription:
    plan = require_plan(plan_code, self_service=True)
    existing = get_subscription(db, company_id)
    if existing:
        return existing
    subscription = Subscription(
        id=str(uuid.uuid4()), company_id=company_id, plan_code=plan.code,
        status="pending_checkout", clinic_limit=plan.clinic_limit, staff_limit=plan.staff_limit,
    )
    db.add(subscription)
    db.flush()
    return subscription


def usage(db: Session, company_id: int) -> dict[str, int]:
    clinics = db.query(func.count(Clinic.id)).filter(
        Clinic.company_id == company_id, Clinic.is_active.is_(True)
    ).scalar() or 0
    staff = db.query(func.count(User.id)).filter(
        User.company_id == company_id, User.is_active.is_(True)
    ).scalar() or 0
    return {"clinics": int(clinics), "staff": int(staff)}


def access_mode(subscription: Subscription, now: Optional[datetime] = None) -> str:
    now = now or utcnow()
    if subscription.status in FULL_STATUSES:
        return "full"
    if subscription.status == "past_due":
        return "full" if subscription.grace_ends_at and subscription.grace_ends_at > now else "read_only"
    if subscription.status == "cancelled":
        end = subscription.current_period_ends_at or subscription.trial_ends_at
        return "full" if end and end > now else "read_only"
    if subscription.status == "pending_checkout":
        return "billing_only"
    return "read_only"


def subscription_response(db: Session, subscription: Subscription) -> dict:
    current_usage = usage(db, subscription.company_id)
    return {
        "status": subscription.status,
        "access_mode": access_mode(subscription),
        "plan_code": subscription.plan_code,
        "pending_plan_code": subscription.pending_plan_code,
        "usage": current_usage,
        "limits": {"clinics": subscription.clinic_limit, "staff": subscription.staff_limit},
        "trial_starts_at": subscription.trial_starts_at,
        "trial_ends_at": subscription.trial_ends_at,
        "current_period_starts_at": subscription.current_period_starts_at,
        "current_period_ends_at": subscription.current_period_ends_at,
        "grace_ends_at": subscription.grace_ends_at,
        "cancel_at_period_end": subscription.cancel_at_period_end,
        "pending_change_at": subscription.pending_change_at,
    }


def enforce_limit(db: Session, company_id: int, resource: str, *, increment: int = 1) -> None:
    subscription = ensure_legacy_subscription(db, company_id)
    limits = {"clinics": subscription.clinic_limit, "staff": subscription.staff_limit}
    limit = limits.get(resource)
    if limit is None:
        return
    current = usage(db, company_id)[resource]
    if current + increment <= limit:
        return
    detail = {
        "code": "plan_limit_exceeded", "resource": resource, "usage": current,
        "limit": limit, "plan": subscription.plan_code,
        "upgrade_url": f"{settings.SITE_URL}/account/plan",
    }
    if settings.SUBSCRIPTION_ENFORCEMENT_MODE == "enforce":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


def validate_plan_change(db: Session, subscription: Subscription, target: PlanDefinition) -> None:
    current = usage(db, subscription.company_id)
    if target.clinic_limit is not None and current["clinics"] > target.clinic_limit:
        raise HTTPException(status_code=409, detail={
            "code": "plan_limit_exceeded", "resource": "clinics", "usage": current["clinics"],
            "limit": target.clinic_limit, "plan": subscription.plan_code,
            "upgrade_url": f"{settings.SITE_URL}/account/plan",
        })
    if target.staff_limit is not None and current["staff"] > target.staff_limit:
        raise HTTPException(status_code=409, detail={
            "code": "plan_limit_exceeded", "resource": "staff", "usage": current["staff"],
            "limit": target.staff_limit, "plan": subscription.plan_code,
            "upgrade_url": f"{settings.SITE_URL}/account/plan",
        })


def apply_stripe_status(subscription: Subscription, stripe_status: str, *, event_created_at: datetime) -> bool:
    if subscription.stripe_event_created_at and event_created_at < subscription.stripe_event_created_at:
        return False
    mapped = {
        "trialing": "trialing", "active": "active", "past_due": "past_due",
        "unpaid": "read_only", "paused": "read_only", "canceled": "cancelled",
        "incomplete": "pending_checkout", "incomplete_expired": "cancelled",
    }.get(stripe_status, "read_only")
    subscription.status = mapped
    subscription.stripe_event_created_at = event_created_at
    subscription.grace_ends_at = event_created_at + timedelta(days=7) if mapped == "past_due" else None
    return True
