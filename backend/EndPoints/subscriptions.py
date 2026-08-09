from datetime import datetime
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import get_current_user, utcnow
from config import settings
from database import get_db
from models import BillingWebhookEvent, Company, Subscription, User
from services.plan_catalog import plan_catalog, require_plan
from services.subscription_service import (
    apply_stripe_status,
    ensure_legacy_subscription,
    get_subscription,
    subscription_response,
    usage,
    validate_plan_change,
)
from services.transactional_email import send_email


router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])
CEO_LEVEL = 4
logger = logging.getLogger(__name__)


class PlanChangeRequest(BaseModel):
    plan_code: str
    proration_date: int | None = None


def _require_ceo(user: User) -> None:
    if (user.role_level or 1) < CEO_LEVEL:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CEO access required")


def _stripe():
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail={"code": "billing_not_configured"})
    try:
        import stripe
    except ImportError as exc:
        raise HTTPException(status_code=503, detail={"code": "billing_not_configured"}) from exc
    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe


def _dt(timestamp) -> datetime | None:
    return datetime.utcfromtimestamp(timestamp) if timestamp else None


@router.get("/me")
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    subscription = ensure_legacy_subscription(db, current_user.company_id)
    db.commit()
    return {**subscription_response(db, subscription), "can_manage_billing": (current_user.role_level or 1) >= CEO_LEVEL}


@router.get("/usage")
def current_usage(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    subscription = ensure_legacy_subscription(db, current_user.company_id)
    db.commit()
    return {"usage": usage(db, current_user.company_id), "limits": {
        "clinics": subscription.clinic_limit, "staff": subscription.staff_limit,
    }}


@router.post("/checkout-session")
def checkout_session(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_ceo(current_user)
    subscription = get_subscription(db, current_user.company_id)
    if not subscription or subscription.status != "pending_checkout":
        raise HTTPException(status_code=409, detail={"code": "checkout_not_available"})
    plan = require_plan(subscription.plan_code, self_service=True)
    if not plan.stripe_price_id:
        raise HTTPException(status_code=503, detail={"code": "billing_not_configured"})
    stripe = _stripe()
    company = db.query(Company).filter(Company.id == current_user.company_id).first()
    session = stripe.checkout.Session.create(
        mode="subscription",
        customer=subscription.stripe_customer_id or None,
        customer_email=None if subscription.stripe_customer_id else current_user.email,
        line_items=[{"price": plan.stripe_price_id, "quantity": 1}],
        success_url=f"{settings.SITE_URL}/welcome?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{settings.SITE_URL}/checkout?cancelled=1",
        client_reference_id=str(current_user.company_id),
        metadata={"company_id": str(current_user.company_id), "plan_code": plan.code},
        subscription_data={
            "trial_period_days": plan.trial_days,
            "metadata": {"company_id": str(current_user.company_id), "plan_code": plan.code},
        },
        payment_method_collection="always",
        allow_promotion_codes=False,
    )
    return {"url": session.url}


@router.post("/portal-session")
def portal_session(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_ceo(current_user)
    subscription = get_subscription(db, current_user.company_id)
    if not subscription or not subscription.stripe_customer_id:
        raise HTTPException(status_code=409, detail={"code": "billing_portal_not_available"})
    stripe = _stripe()
    params = {
        "customer": subscription.stripe_customer_id,
        "return_url": f"{settings.SITE_URL}/account/billing",
    }
    if settings.STRIPE_PORTAL_CONFIGURATION_ID:
        params["configuration"] = settings.STRIPE_PORTAL_CONFIGURATION_ID
    session = stripe.billing_portal.Session.create(**params)
    return {"url": session.url}


@router.post("/plan-change/preview")
def plan_change_preview(payload: PlanChangeRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_ceo(current_user)
    target = require_plan(payload.plan_code, self_service=True)
    subscription = get_subscription(db, current_user.company_id)
    if not subscription:
        raise HTTPException(status_code=402, detail={"code": "subscription_required"})
    validate_plan_change(db, subscription, target)
    current_plan = require_plan(subscription.plan_code) if subscription.plan_code != "legacy" else None
    direction = "upgrade" if current_plan and (target.amount_minor or 0) > (current_plan.amount_minor or 0) else "downgrade"
    result = {
        "plan": target.public_dict(), "direction": direction,
        "timing": "immediate" if direction == "upgrade" else "next_renewal",
        "preserves_trial_end": subscription.status == "trialing",
    }
    if direction == "upgrade" and subscription.status == "active" and subscription.stripe_subscription_id and target.stripe_price_id:
        stripe = _stripe()
        remote = stripe.Subscription.retrieve(subscription.stripe_subscription_id, expand=["items"])
        item_id = remote["items"]["data"][0]["id"]
        proration_date = int(utcnow().timestamp())
        preview = stripe.Invoice.create_preview(
            subscription=subscription.stripe_subscription_id,
            subscription_details={
                "items": [{"id": item_id, "price": target.stripe_price_id}],
                "proration_behavior": "always_invoice",
                "proration_date": proration_date,
            },
        )
        result.update({"amount_due_minor": preview.amount_due, "currency": preview.currency, "proration_date": proration_date})
    return result


@router.post("/plan-change")
def plan_change(payload: PlanChangeRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_ceo(current_user)
    target = require_plan(payload.plan_code, self_service=True)
    subscription = get_subscription(db, current_user.company_id)
    if not subscription or not subscription.stripe_subscription_id:
        raise HTTPException(status_code=409, detail={"code": "plan_change_not_available"})
    validate_plan_change(db, subscription, target)
    if not target.stripe_price_id:
        raise HTTPException(status_code=503, detail={"code": "billing_not_configured"})
    current_plan = require_plan(subscription.plan_code)
    stripe = _stripe()
    remote = stripe.Subscription.retrieve(subscription.stripe_subscription_id, expand=["items"])
    item_id = remote["items"]["data"][0]["id"]
    is_upgrade = (target.amount_minor or 0) > (current_plan.amount_minor or 0)
    if subscription.status == "trialing" or is_upgrade:
        change = {
            "items": [{"id": item_id, "price": target.stripe_price_id}],
            "proration_behavior": "always_invoice" if is_upgrade and subscription.status != "trialing" else "none",
            "metadata": {"company_id": str(subscription.company_id), "plan_code": target.code},
        }
        if subscription.status == "trialing" and subscription.trial_ends_at:
            change["trial_end"] = int(subscription.trial_ends_at.timestamp())
        elif is_upgrade:
            change["payment_behavior"] = "pending_if_incomplete"
            if payload.proration_date:
                change["proration_date"] = payload.proration_date
        stripe.Subscription.modify(subscription.stripe_subscription_id, **change)
    else:
        schedule = stripe.SubscriptionSchedule.create(from_subscription=subscription.stripe_subscription_id)
        current_price_id = remote["items"]["data"][0]["price"]["id"]
        stripe.SubscriptionSchedule.modify(
            schedule.id,
            end_behavior="release",
            proration_behavior="none",
            phases=[
                {
                    "items": [{"price": current_price_id, "quantity": 1}],
                    "start_date": int(subscription.current_period_starts_at.timestamp()) if subscription.current_period_starts_at else "now",
                    "end_date": int(subscription.current_period_ends_at.timestamp()),
                    "proration_behavior": "none",
                },
                {
                    "items": [{"price": target.stripe_price_id, "quantity": 1}],
                    "iterations": 1,
                    "proration_behavior": "none",
                    "metadata": {"company_id": str(subscription.company_id), "plan_code": target.code},
                },
            ],
        )
        subscription.pending_plan_code = target.code
        subscription.pending_change_at = subscription.current_period_ends_at
    db.commit()
    return subscription_response(db, subscription)


@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    if not settings.STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Stripe webhook is not configured")
    stripe = _stripe()
    raw = await request.body()
    welcome_email: str | None = None
    welcome_trial_end: datetime | None = None
    try:
        event = stripe.Webhook.construct_event(raw, request.headers.get("stripe-signature", ""), settings.STRIPE_WEBHOOK_SECRET)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid Stripe signature") from exc

    event_id = event["id"]
    if db.query(BillingWebhookEvent).filter(BillingWebhookEvent.stripe_event_id == event_id).first():
        return {"received": True, "duplicate": True}
    record = BillingWebhookEvent(
        id=str(uuid.uuid4()), stripe_event_id=event_id, event_type=event["type"],
        processing_state="processing", stripe_created_at=_dt(event.get("created")),
    )
    db.add(record)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        return {"received": True, "duplicate": True}

    try:
        obj = event["data"]["object"]
        event_type = event["type"]
        subscription = None
        if event_type == "checkout.session.completed":
            company_id = int((obj.get("metadata") or {}).get("company_id") or obj.get("client_reference_id"))
            subscription = get_subscription(db, company_id)
            if subscription:
                subscription.stripe_customer_id = obj.get("customer")
                subscription.stripe_subscription_id = obj.get("subscription")
        elif event_type.startswith("customer.subscription."):
            metadata = obj.get("metadata") or {}
            company_id = metadata.get("company_id")
            subscription = get_subscription(db, int(company_id)) if company_id else db.query(Subscription).filter(
                Subscription.stripe_subscription_id == obj.get("id")
            ).first()
            if subscription:
                event_created = _dt(event.get("created")) or utcnow()
                if apply_stripe_status(subscription, obj.get("status", ""), event_created_at=event_created):
                    subscription.stripe_subscription_id = obj.get("id")
                    subscription.stripe_customer_id = obj.get("customer")
                    subscription.stripe_price_id = ((obj.get("items") or {}).get("data") or [{}])[0].get("price", {}).get("id")
                    plan_code = next(
                        (code for code, candidate in plan_catalog().items()
                         if candidate.stripe_price_id and candidate.stripe_price_id == subscription.stripe_price_id),
                        metadata.get("plan_code"),
                    )
                    if plan_code:
                        plan = require_plan(plan_code)
                        subscription.plan_code = plan.code
                        subscription.clinic_limit = plan.clinic_limit
                        subscription.staff_limit = plan.staff_limit
                    subscription.trial_starts_at = _dt(obj.get("trial_start"))
                    subscription.trial_ends_at = _dt(obj.get("trial_end"))
                    subscription.current_period_starts_at = _dt(obj.get("current_period_start"))
                    subscription.current_period_ends_at = _dt(obj.get("current_period_end"))
                    subscription.cancel_at_period_end = bool(obj.get("cancel_at_period_end"))
                    if subscription.status == "trialing" and not subscription.trial_consumed_at:
                        subscription.trial_consumed_at = event_created
                        owner = db.query(User).filter(
                            User.company_id == subscription.company_id,
                            User.role_level >= CEO_LEVEL,
                            User.is_active.is_(True),
                        ).order_by(User.id.asc()).first()
                        welcome_email = owner.email if owner else None
                        welcome_trial_end = subscription.trial_ends_at
        elif event_type in {"invoice.paid", "invoice.payment_failed"}:
            subscription = db.query(Subscription).filter(Subscription.stripe_subscription_id == obj.get("subscription")).first()
            event_created = _dt(event.get("created")) or utcnow()
            is_newer = bool(subscription and (not subscription.stripe_event_created_at or event_created >= subscription.stripe_event_created_at))
            if subscription and is_newer and event_type == "invoice.paid" and subscription.status not in {"trialing", "pending_checkout"}:
                subscription.status = "active"
                subscription.grace_ends_at = None
                subscription.stripe_event_created_at = event_created
            elif subscription and is_newer and event_type == "invoice.payment_failed":
                subscription.status = "past_due"
                from datetime import timedelta
                subscription.grace_ends_at = utcnow() + timedelta(days=7)
                subscription.stripe_event_created_at = event_created

        record.processing_state = "processed"
        record.processed_at = utcnow()
        db.commit()
        if welcome_email:
            try:
                trial_copy = (
                    f" Your trial runs until {welcome_trial_end.date().isoformat()}."
                    if welcome_trial_end
                    else ""
                )
                send_email(
                    to=welcome_email,
                    subject="Your Prysm trial is active",
                    html=(
                        "<p>Welcome to Prysm.</p>"
                        f"<p>Your subscription is active.{trial_copy}</p>"
                        f'<p><a href="{settings.SITE_URL}/download">Download Prysm</a></p>'
                    ),
                )
            except Exception:
                logger.exception("Could not send Prysm trial welcome email")
        return {"received": True}
    except Exception as exc:
        record.processing_state = "failed"
        record.error_text = str(exc)[:1000]
        db.commit()
        raise HTTPException(status_code=500, detail="Webhook processing failed") from exc
