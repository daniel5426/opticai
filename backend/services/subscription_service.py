from datetime import UTC, datetime, timedelta
from typing import Optional
import uuid

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from config import settings
from models import Clinic, Subscription, SubscriptionPaymentMethod, SubscriptionPaymentAttempt, User
from services.plan_catalog import PlanDefinition, require_plan


_UNLOADED = object()


def utcnow() -> datetime:
    return datetime.utcnow()


def get_subscription(db: Session, company_id: int) -> Optional[Subscription]:
    return db.query(Subscription).filter(Subscription.company_id == company_id).populate_existing().first()


def ensure_legacy_subscription(db: Session, company_id: int) -> Subscription:
    subscription = get_subscription(db, company_id)
    if subscription:
        return subscription
    # Pre-existing companies are backfilled by Alembic. Never grant legacy at runtime.
    raise HTTPException(status_code=402, detail={"code": "subscription_required"})


def create_pending_subscription(db: Session, company_id: int, plan_code: str) -> Subscription:
    plan = require_plan(plan_code, self_service=True)
    existing = get_subscription(db, company_id)
    if existing:
        return existing
    subscription = Subscription(
        id=str(uuid.uuid4()), company_id=company_id, plan_code=plan.code,
        status="pending_checkout", provider="allpay", amount_minor=plan.amount_minor, clinic_limit=plan.clinic_limit, staff_limit=plan.staff_limit,
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


def aware(value: datetime | None) -> datetime | None:
    return value.replace(tzinfo=UTC) if value and value.tzinfo is None else value


def access_mode(subscription: Subscription, now: Optional[datetime] = None) -> str:
    now = aware(now or utcnow())
    override = subscription.access_override
    if override and (not subscription.override_ends_at or aware(subscription.override_ends_at) > now):
        return {"suspended": "suspended", "read_only": "read_only", "full": "full"}.get(override, "read_only")
    if subscription.status == "legacy_active":
        return "full"
    if subscription.status == "trialing":
        return "full" if subscription.trial_ends_at and aware(subscription.trial_ends_at) > now else "read_only"
    if subscription.status == "active":
        return "full" if subscription.current_period_ends_at and aware(subscription.current_period_ends_at) > now else "read_only"
    if subscription.status == "past_due":
        return "full" if subscription.grace_ends_at and aware(subscription.grace_ends_at) > now else "read_only"
    if subscription.status == "cancelled":
        end = subscription.current_period_ends_at or subscription.trial_ends_at
        return "full" if end and aware(end) > now else "read_only"
    if subscription.status == "pending_checkout":
        return "billing_only"
    return "read_only"


def enforce_workspace(db: Session, company_id: int, *, write: bool = False, subscription=_UNLOADED) -> None:
    if subscription is _UNLOADED:
        subscription = get_subscription(db, company_id)
    enforced = settings.SUBSCRIPTION_ENFORCEMENT_MODE == "enforce" or bool(
        subscription and (subscription.provider == "allpay" or subscription.access_override))
    if not enforced:
        return
    mode = access_mode(subscription) if subscription else "billing_only"
    if mode in {"billing_only", "suspended"} or write and mode != "full":
        raise HTTPException(402, detail={"code": "subscription_required" if mode == "billing_only" else "account_" + mode,
            "access_mode": mode, "billing_url": f"{settings.SITE_URL}/account/billing"})


def require_module(db: Session, company_id: int, module: str, *, subscription=_UNLOADED) -> None:
    if subscription is _UNLOADED:
        subscription = get_subscription(db, company_id)
    if module not in {"ai", "campaigns"}:
        raise ValueError("Unknown module")
    if subscription and getattr(subscription, module + "_enabled") is False:
        raise HTTPException(403, detail={"code": "module_disabled", "module": module})
    enforce_workspace(db, company_id, write=True, subscription=subscription)


def subscription_response(db: Session, subscription: Subscription) -> dict:
    current_usage = usage(db, subscription.company_id)
    method = db.get(SubscriptionPaymentMethod, subscription.company_id)
    return {
        "provider": subscription.provider,
        "amount_minor": subscription.amount_minor,
        "currency": "ILS",
        "automatic_billing": subscription.automatic_billing,
        "access_override": subscription.access_override,
        "override_ends_at": subscription.override_ends_at,
        "entitlements": {"ai": subscription.ai_enabled, "campaigns": subscription.campaigns_enabled},
        "payment_method": {"last4": method.card_last4, "brand": method.card_brand} if method else None,
        "renewal_setup_incomplete": bool(subscription.provider == "allpay" and not method and (
            subscription.automatic_billing or db.query(SubscriptionPaymentAttempt.id).filter_by(
                company_id=subscription.company_id, status="paid", token_pending=True).first() is not None)),
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
    subscription = get_subscription(db, company_id)
    if not subscription:
        if settings.SUBSCRIPTION_ENFORCEMENT_MODE == "enforce":
            raise HTTPException(402, detail={"code": "subscription_required"})
        return
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
    if settings.SUBSCRIPTION_ENFORCEMENT_MODE == "enforce" or subscription.provider == "allpay":
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
    if subscription.provider in {"allpay", "manual"} or subscription.stripe_retired_at:
        return False
    if subscription.stripe_event_created_at and aware(event_created_at) < aware(subscription.stripe_event_created_at):
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
