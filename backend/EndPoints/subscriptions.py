"""Customer subscription API. Provider secrets never cross this boundary."""
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from config import settings
from database import get_db
from models import SubscriptionPaymentAttempt, SubscriptionInvoice, User
from security.owner import is_owner
from services import allpay, saas_billing as billing
from services import trial_requests
from services.plan_catalog import require_plan
from services.subscription_service import ensure_legacy_subscription, subscription_response, usage, validate_plan_change

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


class CheckoutRequest(BaseModel):
    consent: bool = False
    language: str = "en"


class PlanChangeRequest(BaseModel):
    plan_code: str
    quote_token: str | None = None
    proration_date: int | None = None  # Older desktop compatibility; never trusted for pricing.


def _require_ceo(user):
    if (user.role_level or 1) < 4:
        raise HTTPException(403, detail={"code": "ceo_required"})


def _plan(code):
    try:
        return require_plan(code, self_service=True)
    except ValueError as exc:
        raise HTTPException(400, detail={"code": "invalid_plan"}) from exc


@router.get("/me")
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = ensure_legacy_subscription(db, current_user.company_id)
    return {**subscription_response(db, row), "can_manage_billing": (current_user.role_level or 1) >= 4,
            "can_administer": is_owner(current_user)}


@router.get("/usage")
def current_usage(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = ensure_legacy_subscription(db, current_user.company_id)
    return {"usage": usage(db, row.company_id), "limits": {"clinics": row.clinic_limit, "staff": row.staff_limit}}


@router.get("/trial-request")
def trial_request_status(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_ceo(current_user)
    return trial_requests.customer_status(db, ensure_legacy_subscription(db, current_user.company_id))


@router.post("/trial-request")
def request_trial(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_ceo(current_user)
    return trial_requests.request_trial(db, current_user)


@router.post("/checkout-session")
def checkout_session(payload: CheckoutRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_ceo(current_user)
    return billing.checkout(db, current_user, consent=payload.consent, language=payload.language if payload.language in {"he", "en", "fr"} else "en")


@router.post("/payment-method")
def payment_method(payload: CheckoutRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_ceo(current_user)
    return billing.checkout(db, current_user, consent=payload.consent, language=payload.language if payload.language in {"he", "en", "fr"} else "en", replace_card=True)


@router.get("/sessions/{session_id}")
def session_status(session_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_ceo(current_user)
    attempt = db.query(SubscriptionPaymentAttempt).filter_by(id=session_id, company_id=current_user.company_id).first()
    if not attempt:
        raise HTTPException(404, detail={"code": "payment_not_found"})
    return {"id": attempt.id, "status": attempt.status, "token_pending": attempt.token_pending,
            "subscription": subscription_response(db, ensure_legacy_subscription(db, current_user.company_id))}


@router.get("/payments")
def payments(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_ceo(current_user)
    return {"payments": billing.history(db, current_user.company_id)}


@router.post("/retry/{invoice_id}")
def retry(invoice_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_ceo(current_user)
    row = db.query(SubscriptionInvoice).filter_by(id=invoice_id, company_id=current_user.company_id, status="open").first()
    if not row:
        raise HTTPException(404, detail={"code": "payment_not_found"})
    billing.charge(db, row.id)
    return {"status": db.get(SubscriptionInvoice, invoice_id).status}


@router.post("/cancel")
def cancel(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_ceo(current_user)
    row = billing.locked_subscription(db, current_user.company_id)
    if row.provider == "stripe" and not row.stripe_retired_at:
        raise HTTPException(409, detail={"code": "stripe_cutover_required"})
    row.automatic_billing, row.cancel_at_period_end = False, True
    row.cancelled_at, row.status = billing.now(), "cancelled"
    row.pending_plan_code, row.pending_change_at = None, None
    billing.audit(db, row.company_id, current_user.id, "cancel", "Customer cancellation", {}, {"automatic_billing": False})
    db.commit()
    return subscription_response(db, row)


@router.post("/portal-session")
def portal_session(current_user: User = Depends(get_current_user)):
    _require_ceo(current_user)
    return {"url": settings.SITE_URL + "/account/billing"}


@router.post("/plan-change/preview")
def plan_change_preview(payload: PlanChangeRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_ceo(current_user)
    row = ensure_legacy_subscription(db, current_user.company_id)
    target = _plan(payload.plan_code)
    validate_plan_change(db, row, target)
    return billing.preview(row, target)


@router.post("/plan-change")
def plan_change(payload: PlanChangeRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_ceo(current_user)
    _plan(payload.plan_code)
    billing.change_plan(db, current_user, payload.plan_code, payload.quote_token)
    return subscription_response(db, ensure_legacy_subscription(db, current_user.company_id))


@router.post("/webhooks/allpay")
async def allpay_webhook(request: Request, db: Session = Depends(get_db)):
    if int(request.headers.get("content-length", "0")) > 65536:
        raise HTTPException(413)
    payload = await request.json()
    if not isinstance(payload, dict) or not allpay.verify(payload):
        raise HTTPException(400, detail={"code": "invalid_signature"})
    attempt = db.get(SubscriptionPaymentAttempt, str(payload.get("order_id", "")))
    if not attempt:
        # Unrelated merchant orders are never mapped to companies by client email.
        return {"received": True, "unmatched": True}
    if attempt.kind == "capture":
        billing.settle(db, attempt.id, payload)
    else:
        # Query authoritative status for payments/chargebacks, including amount and currency.
        try:
            status = allpay.request("paymentstatus", {"order_id": attempt.id})
        except allpay.AllpayError as exc:
            raise HTTPException(503, detail={"code": "reconciliation_pending"}) from exc
        billing.settle(db, attempt.id, status)
        billing.recover_token(db, attempt.id)
    return {"received": True}


@router.post("/webhooks/stripe")
async def stripe_webhook():
    # Retired integration: acknowledge old deliveries without mutating entitlement or finance.
    return {"received": True, "retired": True}


# Read helpers retained for old diagnostics/tests; no active Stripe billing operations.
def _subscription_period(subscription, field):
    timestamp = subscription.get(field) or next(iter((subscription.get("items") or {}).get("data") or [{}])).get(field)
    return datetime.fromtimestamp(timestamp, UTC) if timestamp else None


def _invoice_subscription_id(invoice):
    value = invoice.get("subscription") or ((invoice.get("parent") or {}).get("subscription_details") or {}).get("subscription")
    return value.get("id") if isinstance(value, dict) else value


def _stripe_event_dict(event):
    return event.to_dict_recursive() if hasattr(event, "to_dict_recursive") else event.to_dict() if hasattr(event, "to_dict") else event


@router.get("/modules/{module}/authorize")
def authorize_module(module: str, clinic_id: int | None = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if module not in {"ai", "campaigns"}:
        raise HTTPException(404)
    from services.subscription_service import require_module
    from security.scope import assert_clinic_scope
    if clinic_id is not None:
        assert_clinic_scope(db, current_user, clinic_id)
    require_module(db, current_user.company_id, module)
    return {"allowed": True}
