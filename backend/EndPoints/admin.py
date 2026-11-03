"""Owner-only, audited platform operations. Tenant CEOs are never platform owners."""
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import get_db
from models import Company, Clinic, User, Subscription, SubscriptionInvoice, SubscriptionPaymentAttempt, SubscriptionPaymentMethod, SubscriptionAuditEvent, SubscriptionTrialRequest
from security.owner import require_owner, owner_ids
from services import saas_billing as billing
from services import trial_requests
from services.plan_catalog import require_plan
from services.subscription_service import aware, subscription_response

router = APIRouter(prefix="/admin", tags=["owner-administration"])


class SubscriptionUpdate(BaseModel):
    reason: str = Field(min_length=3, max_length=1000)
    plan_code: str | None = None
    amount_minor: int | None = Field(default=None, ge=0)
    clinic_limit: int | None = Field(default=None, ge=0)
    staff_limit: int | None = Field(default=None, ge=0)
    automatic_billing: bool | None = None
    access_override: Literal["full", "read_only", "suspended"] | None = None
    override_ends_at: datetime | None = None
    ai_enabled: bool | None = None
    campaigns_enabled: bool | None = None
    paid_through: datetime | None = None
    trial_ends_at: datetime | None = None
    stripe_billing_stopped: bool = False


class ActivityUpdate(BaseModel):
    active: bool
    reason: str = Field(min_length=3, max_length=1000)


class ManualPayment(BaseModel):
    amount_minor: int = Field(gt=0)
    period_start: datetime
    period_end: datetime
    reference: str = Field(min_length=1, max_length=200)
    reason: str = Field(min_length=3, max_length=1000)


class RefundRequest(BaseModel):
    amount_minor: int = Field(gt=0)
    reason: str = Field(min_length=3, max_length=1000)


class TrialReview(BaseModel):
    decision: Literal["approve", "reject"]
    trial_ends_at: datetime | None = None
    reason: str = Field(min_length=3, max_length=1000)


def snapshot(sub):
    keys = ("plan_code", "amount_minor", "clinic_limit", "staff_limit", "automatic_billing", "access_override", "override_ends_at",
            "ai_enabled", "campaigns_enabled", "current_period_ends_at", "trial_ends_at", "provider", "billing_revision")
    return {key: value.isoformat() if isinstance(value, datetime) else value for key in keys for value in [getattr(sub, key)]}


@router.get("/me")
def me(owner: User = Depends(require_owner)):
    return {"is_owner": True, "user_id": owner.id}


@router.get("/trial-requests")
def trial_request_queue(status: Literal["pending", "approved", "rejected"] = "pending",
                        offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100),
                        owner: User = Depends(require_owner), db: Session = Depends(get_db)):
    query = db.query(SubscriptionTrialRequest).filter_by(status=status)
    total = query.count()
    rows = query.order_by(SubscriptionTrialRequest.created_at, SubscriptionTrialRequest.id).offset(offset).limit(limit).all()
    result = []
    for row in rows:
        company, user = db.get(Company, row.company_id), db.get(User, row.requested_by_user_id)
        sub = db.query(Subscription).filter_by(company_id=row.company_id).first()
        result.append({**trial_requests.public_request(row), "company_id": company.id, "company_name": company.name,
            "email": company.contact_email, "requested_by": user.full_name or user.username,
            "plan_code": sub.plan_code if sub else None,
            "unavailable_reason": trial_requests.ineligible_reason(db, sub) if sub else "trial_not_available"})
    return {"requests": result, "total": total}


@router.post("/trial-requests/{request_id}/review")
def review_trial_request(request_id: str, payload: TrialReview, owner: User = Depends(require_owner), db: Session = Depends(get_db)):
    return trial_requests.review(db, request_id, owner, decision=payload.decision,
        trial_ends_at=payload.trial_ends_at, reason=payload.reason.strip())


@router.get("/customers")
def customers(search: str = "", offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100),
              owner: User = Depends(require_owner), db: Session = Depends(get_db)):
    query = db.query(Company)
    if search.strip():
        term = "%" + search.strip().replace("%", "\\%").replace("_", "\\_") + "%"
        query = query.filter(or_(Company.name.ilike(term, escape="\\"), Company.contact_email.ilike(term, escape="\\"), Company.contact_phone.ilike(term, escape="\\")))
    total = query.count()
    result = []
    for company in query.order_by(Company.id).offset(offset).limit(limit).all():
        sub = db.query(Subscription).filter_by(company_id=company.id).first()
        result.append({"id": company.id, "name": company.name, "email": company.contact_email, "phone": company.contact_phone,
                       "subscription": subscription_response(db, sub) if sub else None})
    return {"customers": result, "total": total}


@router.get("/customers/{company_id}")
def customer(company_id: int, owner: User = Depends(require_owner), db: Session = Depends(get_db)):
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(404, detail={"code": "customer_not_found"})
    sub = db.query(Subscription).filter_by(company_id=company_id).first()
    users = db.query(User).filter_by(company_id=company_id).order_by(User.id).all()
    clinics = db.query(Clinic).filter_by(company_id=company_id).order_by(Clinic.id).all()
    events = db.query(SubscriptionAuditEvent).filter_by(company_id=company_id).order_by(SubscriptionAuditEvent.created_at.desc()).limit(100).all()
    attempts = db.query(SubscriptionPaymentAttempt).filter_by(company_id=company_id).order_by(SubscriptionPaymentAttempt.created_at.desc()).limit(100).all()
    return {"id": company.id, "name": company.name, "email": company.contact_email, "phone": company.contact_phone,
        "subscription": subscription_response(db, sub) if sub else None,
        "users": [{"id": u.id, "name": u.full_name or u.username, "email": u.email, "active": u.is_active, "protected": u.id in owner_ids()} for u in users],
        "clinics": [{"id": c.id, "name": c.name, "active": c.is_active} for c in clinics],
        "payments": billing.history(db, company_id),
        "trial_request": trial_requests.public_request(db.query(SubscriptionTrialRequest).filter_by(company_id=company_id).first()),
        "attempts": [{"id": a.id, "invoice_id": a.invoice_id, "status": a.status, "error_code": a.error_code, "created_at": a.created_at} for a in attempts],
        "audit": [{"id": e.id, "actor_user_id": e.actor_user_id, "action": e.action, "reason": e.reason, "before": e.before, "after": e.after, "created_at": e.created_at} for e in events]}


@router.patch("/customers/{company_id}/subscription")
def update_subscription(company_id: int, payload: SubscriptionUpdate, owner: User = Depends(require_owner), db: Session = Depends(get_db)):
    if not db.get(Company, company_id):
        raise HTTPException(404, detail={"code": "customer_not_found"})
    sub = db.query(Subscription).filter_by(company_id=company_id).with_for_update().first()
    if not sub:
        sub = Subscription(id=billing.uid(), company_id=company_id, plan_code="essential", status="pending_checkout", provider="manual")
        db.add(sub)
        db.flush()
    before = snapshot(sub)
    fields = payload.model_fields_set - {"reason", "stripe_billing_stopped"}
    if "plan_code" in fields:
        try:
            plan = require_plan(payload.plan_code)
        except ValueError as exc:
            raise HTTPException(400, detail={"code": "invalid_plan"}) from exc
        sub.plan_code, sub.amount_minor = plan.code, plan.amount_minor
        sub.clinic_limit, sub.staff_limit = plan.clinic_limit, plan.staff_limit
    for key in fields - {"plan_code", "paid_through", "trial_ends_at"}:
        value = getattr(payload, key)
        if key in {"automatic_billing", "ai_enabled", "campaigns_enabled"} and value is None:
            raise HTTPException(400, detail={"code": "invalid_change"})
        setattr(sub, key, aware(value) if isinstance(value, datetime) else value)
    if "paid_through" in fields:
        sub.current_period_ends_at = aware(payload.paid_through)
        sub.current_period_starts_at = sub.current_period_starts_at or billing.now()
        sub.status = "active" if payload.paid_through and aware(payload.paid_through) > billing.now() else "read_only"
    if "trial_ends_at" in fields:
        sub.trial_ends_at = aware(payload.trial_ends_at)
        sub.status = "trialing" if payload.trial_ends_at and aware(payload.trial_ends_at) > billing.now() else "read_only"
    if payload.stripe_billing_stopped:
        sub.stripe_retired_at = billing.now()
    if payload.access_override == "full" and "automatic_billing" not in fields:
        sub.automatic_billing = False
    if payload.access_override in {"suspended", "read_only"}:
        sub.automatic_billing = False
    if sub.automatic_billing:
        if sub.amount_minor is None or sub.amount_minor < 500:
            raise HTTPException(400, detail={"code": "minimum_payment"})
        if sub.stripe_subscription_id and not sub.stripe_retired_at:
            raise HTTPException(409, detail={"code": "stripe_cutover_required"})
        if not db.get(SubscriptionPaymentMethod, company_id):
            raise HTTPException(409, detail={"code": "payment_method_required"})
        sub.provider = "allpay"
        sub.cancel_at_period_end = False
    elif sub.provider == "none":
        sub.provider = "manual"
    after = snapshot(sub)
    financial = {"plan_code", "amount_minor", "clinic_limit", "staff_limit", "automatic_billing", "access_override",
                 "override_ends_at", "current_period_ends_at", "trial_ends_at", "provider"}
    if any(before.get(key) != after.get(key) for key in financial):
        sub.pending_plan_code, sub.pending_change_at = None, None
        sub.billing_revision = (sub.billing_revision or 0) + 1
        for invoice in db.query(SubscriptionInvoice).filter_by(company_id=company_id, status="open").all():
            unresolved = db.query(SubscriptionPaymentAttempt).filter(
                SubscriptionPaymentAttempt.invoice_id == invoice.id,
                SubscriptionPaymentAttempt.status.in_(["created", "submitted", "unknown"])).first()
            if not unresolved:
                invoice.status = "void"
                sub.balance_minor = (sub.balance_minor or 0) + (invoice.carry_minor or 0)
    # Module-only edits never invalidate invoices or scheduled plan changes.
    billing.audit(db, company_id, owner.id, "subscription_updated", payload.reason, before, snapshot(sub))
    db.commit()
    return subscription_response(db, sub)


@router.patch("/users/{user_id}")
def update_user(user_id: int, payload: ActivityUpdate, owner: User = Depends(require_owner), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, detail={"code": "user_not_found"})
    if not payload.active and user.id in owner_ids():
        raise HTTPException(409, detail={"code": "owner_protected"})
    billing.audit(db, user.company_id, owner.id, "user_activity", payload.reason, {"id": user.id, "active": user.is_active}, {"id": user.id, "active": payload.active})
    user.is_active = payload.active
    db.commit()
    return {"id": user.id, "active": user.is_active}


@router.patch("/clinics/{clinic_id}")
def update_clinic(clinic_id: int, payload: ActivityUpdate, owner: User = Depends(require_owner), db: Session = Depends(get_db)):
    clinic = db.get(Clinic, clinic_id)
    if not clinic:
        raise HTTPException(404, detail={"code": "clinic_not_found"})
    billing.audit(db, clinic.company_id, owner.id, "clinic_activity", payload.reason, {"id": clinic.id, "active": clinic.is_active}, {"id": clinic.id, "active": payload.active})
    clinic.is_active = payload.active
    db.commit()
    return {"id": clinic.id, "active": clinic.is_active}


@router.post("/customers/{company_id}/payments")
def manual_payment(company_id: int, payload: ManualPayment, owner: User = Depends(require_owner), db: Session = Depends(get_db)):
    sub = billing.locked_subscription(db, company_id)
    if aware(payload.period_end) <= aware(payload.period_start):
        raise HTTPException(400, detail={"code": "invalid_period"})
    # Reference uniqueness makes a repeated form submission idempotent.
    cycle = f"manual:{company_id}:{payload.reference}"
    existing = db.query(SubscriptionInvoice).filter_by(cycle_key=cycle).first()
    if existing:
        return billing.invoice_dict(existing)
    invoice = billing.new_invoice(db, sub, kind="manual", cycle=cycle, amount=payload.amount_minor,
        start=aware(payload.period_start), end=aware(payload.period_end))
    invoice.status = "paid"
    before = snapshot(sub)
    sub.current_period_starts_at, sub.current_period_ends_at = invoice.period_start, invoice.period_end
    sub.status = "active"
    sub.grace_ends_at = None
    sub.automatic_billing = False
    sub.billing_revision = (sub.billing_revision or 0) + 1
    billing.audit(db, company_id, owner.id, "manual_payment", payload.reason, before, {**snapshot(sub), "invoice_id": invoice.id, "reference": payload.reference})
    db.commit()
    return billing.invoice_dict(invoice)


@router.post("/payments/{invoice_id}/refund")
def refund(invoice_id: str, payload: RefundRequest, owner: User = Depends(require_owner), db: Session = Depends(get_db)):
    return billing.refund(db, invoice_id, payload.amount_minor, owner.id, payload.reason)


@router.post("/attempts/{attempt_id}/reconcile")
def reconcile(attempt_id: str, owner: User = Depends(require_owner), db: Session = Depends(get_db)):
    attempt = db.get(SubscriptionPaymentAttempt, attempt_id)
    if not attempt:
        raise HTTPException(404, detail={"code": "payment_not_found"})
    billing.audit(db, attempt.company_id, owner.id, "reconcile_requested", "Owner reconciliation", {}, {"attempt_id": attempt_id})
    db.commit()
    billing.reconcile(db, attempt_id)
    return {"status": db.get(SubscriptionPaymentAttempt, attempt_id).status}
