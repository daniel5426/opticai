"""A company may request one owner-reviewed trial. All grants are explicit and audited."""
from datetime import timedelta

from fastapi import HTTPException

from models import SubscriptionTrialRequest, SubscriptionInvoice, SubscriptionPaymentAttempt
from services import saas_billing as billing
from services.plan_catalog import require_plan
from services.subscription_service import aware, access_mode


def public_request(row):
    if not row:
        return None
    # Owner review notes and identities are internal administration data.
    return {key: getattr(row, key) for key in ("id", "status", "created_at", "reviewed_at", "trial_ends_at")}


def ineligible_reason(db, sub):
    if (sub.status != "pending_checkout" or sub.access_override or sub.stripe_subscription_id or
            sub.trial_consumed_at or sub.trial_starts_at or sub.trial_ends_at or
            sub.current_period_starts_at or sub.current_period_ends_at or sub.automatic_billing):
        return "trial_not_available"
    try:
        require_plan(sub.plan_code, self_service=True)
    except ValueError:
        return "trial_not_available"
    if db.query(SubscriptionInvoice.id).filter(SubscriptionInvoice.company_id == sub.company_id,
            SubscriptionInvoice.status.in_(["paid", "refunded"])).first():
        return "trial_not_available"
    # Failed hosted pages remain payable. An unknown token charge must be reconciled,
    # even after page expiry, before an owner changes the entitlement contract.
    if db.query(SubscriptionPaymentAttempt.id).filter(
            SubscriptionPaymentAttempt.company_id == sub.company_id,
            SubscriptionPaymentAttempt.kind == "payment",
            (SubscriptionPaymentAttempt.status.in_(["created", "submitted", "unknown"])) |
            ((SubscriptionPaymentAttempt.payment_url.isnot(None)) &
             (SubscriptionPaymentAttempt.created_at > billing.now() - timedelta(hours=24)))).first():
        return "trial_payment_pending"
    return None


def customer_status(db, sub):
    row = db.query(SubscriptionTrialRequest).filter_by(company_id=sub.company_id).first()
    reason = ineligible_reason(db, sub) if not row else None
    return {"request": public_request(row), "can_request": row is None and reason is None,
            "unavailable_reason": reason, "access_granted": access_mode(sub) == "full"}


def request_trial(db, user):
    sub = billing.locked_subscription(db, user.company_id)
    existing = db.query(SubscriptionTrialRequest).filter_by(company_id=user.company_id).first()
    if existing:
        db.commit()
        return public_request(existing)  # Repeated clicks never create a second request.
    reason = ineligible_reason(db, sub)
    if reason:
        raise HTTPException(409, detail={"code": reason})
    row = SubscriptionTrialRequest(id=billing.uid(), company_id=user.company_id,
        requested_by_user_id=user.id, status="pending")
    db.add(row)
    billing.audit(db, user.company_id, user.id, "trial_requested", "Customer requested a free trial", {},
        {"request_id": row.id, "status": "pending"})
    db.commit()
    return public_request(row)


def review(db, request_id, owner, *, decision, trial_ends_at, reason):
    if len(reason.strip()) < 3:
        raise HTTPException(400, detail={"code": "trial_reason_required"})
    stub = db.get(SubscriptionTrialRequest, request_id)
    if not stub:
        raise HTTPException(404, detail={"code": "trial_request_not_found"})
    sub = billing.locked_subscription(db, stub.company_id)
    row = db.query(SubscriptionTrialRequest).filter_by(id=request_id).with_for_update().populate_existing().one()
    if row.status != "pending":
        raise HTTPException(409, detail={"code": "trial_already_reviewed"})
    now = billing.now()
    before = {"request_status": row.status, "subscription_status": sub.status, "automatic_billing": sub.automatic_billing}
    if decision == "approve":
        blocked = ineligible_reason(db, sub)
        if blocked:
            raise HTTPException(409, detail={"code": blocked})
        end = aware(trial_ends_at)
        if not end or end <= now:
            raise HTTPException(400, detail={"code": "trial_end_required"})
        sub.trial_starts_at, sub.trial_ends_at, sub.trial_consumed_at = now, end, now
        sub.status, sub.provider, sub.automatic_billing = "trialing", "allpay", False
        sub.grace_ends_at = sub.cancelled_at = sub.pending_change_at = sub.pending_plan_code = None
        sub.cancel_at_period_end = False
        sub.billing_revision = (sub.billing_revision or 0) + 1
        # Only definitive, expired or failed checkouts reach this branch.
        for invoice in db.query(SubscriptionInvoice).filter_by(company_id=sub.company_id, status="open").all():
            invoice.status = "void"
        row.status, row.trial_ends_at = "approved", end
    else:
        row.status = "rejected"
    row.reviewed_at, row.reviewed_by_user_id, row.decision_reason = now, owner.id, reason
    billing.audit(db, sub.company_id, owner.id, "trial_" + row.status, reason, before,
        {"request_id": row.id, "request_status": row.status, "subscription_status": sub.status,
         "trial_ends_at": row.trial_ends_at.isoformat() if row.trial_ends_at else None, "automatic_billing": sub.automatic_billing})
    db.commit()
    return public_request(row)
