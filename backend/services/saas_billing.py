"""Durable invoices, one provider order per attempt, and reconciliation before retries."""
import calendar
import hashlib
import logging
import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from auth import encrypt_secret, decrypt_secret
from config import settings
from models import (Company, Subscription, SubscriptionPaymentMethod, SubscriptionInvoice,
                    SubscriptionPaymentAttempt, SubscriptionAuditEvent, SubscriptionRefund, User)
from services import allpay
from services.plan_catalog import require_plan
from services.subscription_service import aware, access_mode, validate_plan_change

logger = logging.getLogger(__name__)
CONSENT_VERSION = "allpay-monthly-v1"
RETRY_DAYS = (1, 3, 5)
FATAL_CODES = {"9", "600", "21001", "21002", "21003", "21004", "20010", "20020"}


def now():
    return datetime.now(UTC)


def uid():
    return uuid.uuid4().hex


def month_after(start: datetime, anchor: datetime) -> datetime:
    start, anchor = aware(start), aware(anchor)
    month = start.month % 12 + 1
    year = start.year + (start.month == 12)
    return start.replace(year=year, month=month, day=min(anchor.day, calendar.monthrange(year, month)[1]))


def locked_subscription(db: Session, company_id: int) -> Subscription:
    row = db.query(Subscription).filter_by(company_id=company_id).with_for_update().populate_existing().first()
    if not row:
        raise HTTPException(402, detail={"code": "subscription_required"})
    return row


def audit(db, company_id, actor, action, reason, before, after):
    db.add(SubscriptionAuditEvent(id=uid(), company_id=company_id, actor_user_id=actor,
        action=action, reason=reason, before=before, after=after))


def invoice_dict(row):
    return {key: getattr(row, key) for key in ("id", "kind", "plan_code", "amount_minor", "currency", "status",
        "period_start", "period_end", "due_at", "receipt_url", "refunded_minor", "created_at")}


def history(db, company_id, limit=100):
    rows = db.query(SubscriptionInvoice).filter_by(company_id=company_id).order_by(SubscriptionInvoice.created_at.desc()).limit(limit).all()
    return [invoice_dict(row) for row in rows]


def new_invoice(db, sub, *, kind, cycle, amount, plan=None, start=None, end=None):
    row = SubscriptionInvoice(id=uid(), company_id=sub.company_id, kind=kind, cycle_key=cycle,
        plan_code=plan or sub.plan_code, amount_minor=amount, currency="ILS", status="open", billing_revision=sub.billing_revision or 0,
        period_start=start, period_end=end, due_at=now(), refunded_minor=0)
    db.add(row)
    db.flush()
    return row


def checkout(db: Session, user: User, *, consent: bool, language: str, replace_card: bool = False):
    if not consent:
        raise HTTPException(400, detail={"code": "recurring_consent_required"})
    if not settings.BILLING_CHARGING_ENABLED:
        raise HTTPException(503, detail={"code": "billing_disabled"})
    sub = locked_subscription(db, user.company_id)
    if sub.stripe_subscription_id and not sub.stripe_retired_at:
        raise HTTPException(409, detail={"code": "stripe_cutover_required"})
    if sub.status == "legacy_active" and not replace_card:
        raise HTTPException(409, detail={"code": "managed_account"})
    if sub.access_override in {"suspended", "read_only"}:
        raise HTTPException(409, detail={"code": "managed_account"})
    sub.billing_locale = language
    invoice = None
    if not replace_card:
        if access_mode(sub) == "full":
            raise HTTPException(409, detail={"code": "checkout_not_available"})
        plan = require_plan(sub.plan_code, self_service=True)
        invoice = db.query(SubscriptionInvoice).filter_by(company_id=user.company_id, kind="initial", status="open").first()
        if not invoice:
            start = now()
            invoice = new_invoice(db, sub, kind="initial", cycle=f"initial:{sub.company_id}:{uid()}",
                amount=sub.amount_minor if sub.amount_minor is not None else plan.amount_minor,
                start=start, end=month_after(start, start))
        sub.provider = "allpay"
    # Reuse an unexpired session; do not multiply payable checkout pages.
    query = db.query(SubscriptionPaymentAttempt).filter_by(company_id=user.company_id,
        kind="capture" if replace_card else "payment", invoice_id=invoice.id if invoice else None)
    previous = query.filter(SubscriptionPaymentAttempt.created_at > now() - timedelta(hours=24), SubscriptionPaymentAttempt.status.in_(["submitted", "unknown", "created", "failed", "needs_card"])).order_by(SubscriptionPaymentAttempt.created_at.desc()).first()
    if previous:
        if previous.payment_url:
            return {"id": previous.id, "url": previous.payment_url, "amount_minor": invoice.amount_minor if invoice else 0}
        raise HTTPException(409, detail={"code": "payment_reconciling"})
    attempt = SubscriptionPaymentAttempt(id=uid(), company_id=user.company_id, invoice_id=invoice.id if invoice else None,
        kind="capture" if replace_card else "payment", status="submitted", billing_revision=sub.billing_revision or 0, consent_at=now(), consent_version=CONSENT_VERSION,
        submitted_at=now(), test_mode=settings.ALLPAY_TEST_MODE, token_pending=False)
    db.add(attempt)
    order_id = attempt.id
    amount = invoice.amount_minor if invoice else 0
    body = {"order_id": order_id, "items": [{"name": "Prysm " + sub.plan_code, "qty": 1, "price": amount / 100, "vat": 1}],
        "client_name": user.full_name or user.username, "client_email": user.email,
        "currency_display": "ILS", "currency_payment": "ILS", "lang": language.upper(),
        "show_bit": 0, "show_applepay": 0, "show_googlepay": 0,
        "webhook_url": settings.API_PUBLIC_URL.rstrip("/") + settings.API_V1_STR + "/subscriptions/webhooks/allpay",
        "success_url": settings.SITE_URL + ("/account/billing" if replace_card else "/welcome") + "?payment_id=" + order_id,
        "expire": int((now() + timedelta(hours=24)).timestamp())}
    db.commit()  # The correlation ID exists before any external side effect.
    try:
        result = allpay.request("capturetoken" if replace_card else "getpayment", body)
        url = result.get("payment_url", "")
        if not url.startswith("https://allpay.to/"):
            raise allpay.AllpayError("invalid_payment_url", uncertain=True)
        attempt = db.get(SubscriptionPaymentAttempt, order_id)
        attempt.payment_url = url
        db.commit()
        return {"id": order_id, "url": url, "amount_minor": amount}
    except allpay.AllpayError as exc:
        attempt = db.get(SubscriptionPaymentAttempt, order_id)
        attempt.status = "unknown" if exc.uncertain else "failed"
        attempt.error_code = exc.code
        db.commit()
        raise HTTPException(503, detail={"code": exc.code if exc.code.startswith("billing_") else "payment_unavailable"}) from exc


def save_method(db, attempt, payload):
    token = payload.get("allpay_token")
    if not token or not attempt.consent_at:
        raise allpay.AllpayError("token_missing")
    method = db.get(SubscriptionPaymentMethod, attempt.company_id)
    if method and aware(method.consent_at) > aware(attempt.consent_at):
        return  # A delayed old capture must not replace a newer card.
    if not method:
        method = SubscriptionPaymentMethod(company_id=attempt.company_id)
        db.add(method)
    method.token_encrypted = encrypt_secret(token)
    mask = str(payload.get("card_mask", ""))
    method.card_last4 = mask[-4:] if len(mask) >= 4 else None
    method.card_brand = str(payload.get("card_brand", ""))[:32]
    method.consent_at = attempt.consent_at
    method.consent_version = attempt.consent_version
    attempt.token_pending = False


def recover_token(db, attempt_id):
    attempt = db.get(SubscriptionPaymentAttempt, attempt_id)
    if not attempt or not attempt.token_pending or attempt.test_mode != settings.ALLPAY_TEST_MODE:
        return
    try:
        payload = allpay.request("gettoken", {"order_id": attempt.id})
        locked_subscription(db, attempt.company_id)
        attempt = db.query(SubscriptionPaymentAttempt).filter_by(id=attempt_id).with_for_update().populate_existing().one()
        save_method(db, attempt, payload)
        db.commit()
    except allpay.AllpayError:
        db.rollback()  # Paid access is already committed, independent of token retrieval.


def failure(db, sub, invoice, attempt, code):
    if attempt.status == "paid":
        return
    attempt.status = "needs_card" if code in FATAL_CODES else "failed"
    attempt.error_code = code
    attempt.reconciled_at = now()
    if invoice.kind == "renewal" and invoice.status != "paid":
        if sub.status != "cancelled":
            sub.status = "past_due"
            sub.grace_ends_at = aware(invoice.period_start) + timedelta(days=7)
        invoice.notification_kind = "payment_failed"
        invoice.notification_sent_at = None
        retries = [aware(invoice.period_start) + timedelta(days=day) for day in RETRY_DAYS]
        invoice.next_attempt_at = next((date for date in retries if date > now()), None) if code not in FATAL_CODES else None


def settle(db, attempt_id, payload):
    """Caller supplies an authenticated provider status; locks make delivery idempotent."""
    attempt = db.get(SubscriptionPaymentAttempt, attempt_id)
    if not attempt:
        raise HTTPException(404, detail={"code": "payment_not_found"})
    sub = locked_subscription(db, attempt.company_id)
    attempt = db.query(SubscriptionPaymentAttempt).filter_by(id=attempt_id).with_for_update().populate_existing().one()
    if attempt.test_mode != settings.ALLPAY_TEST_MODE:
        raise HTTPException(409, detail={"code": "payment_environment_mismatch"})
    if attempt.kind == "capture":
        if int(payload.get("status", 0)) == 1 and payload.get("subscription_create") == 0 and Decimal(str(payload.get("amount", -1))) == 0:
            save_method(db, attempt, payload)
            attempt.status = "paid"
            if attempt.billing_revision == (sub.billing_revision or 0) and (not sub.cancelled_at or aware(attempt.consent_at) > aware(sub.cancelled_at)):
                # Explicit migration can enroll an old Stripe account; replacing a card
                # cannot silently undo cancellation or an owner's billing pause.
                if sub.provider == "stripe" and not sub.access_override and not sub.cancel_at_period_end:
                    sub.automatic_billing = True
                sub.provider = "allpay"
        db.commit()
        return
    invoice = db.query(SubscriptionInvoice).filter_by(id=attempt.invoice_id).with_for_update().one()
    status = int(payload.get("status", 0))
    if status == 1:
        if payload.get("order_id") != attempt.id:
            raise HTTPException(400, detail={"code": "payment_mismatch"})
        gross = Decimal(str(payload.get("amount", -1))) - Decimal(str(payload.get("discount", 0)))
        if gross * 100 != invoice.amount_minor or payload.get("currency_display") != "ILS" or payload.get("currency_payment") != "ILS" or Decimal(str(payload.get("currency_course", 1))) != 1:
            raise HTTPException(400, detail={"code": "payment_mismatch"})
        if attempt.status == "paid":
            db.commit()
            return
        attempt.status = "paid"
        attempt.error_code = None
        attempt.reconciled_at = now()
        if invoice.status == "paid":
            audit(db, sub.company_id, None, "duplicate_payment", "Additional successful attempt requires review", {}, {"attempt_id": attempt.id})
            db.commit()
            return
        invoice.status = "paid"
        invoice.receipt_url = payload.get("receipt") if str(payload.get("receipt", "")).startswith("https://") else None
        invoice.next_attempt_at = None
        invoice.notification_kind = "payment_received"
        invoice.notification_sent_at = None
        if invoice.billing_revision != (sub.billing_revision or 0):
            sub.automatic_billing = False
            audit(db, sub.company_id, None, "payment_after_override", "Financial record retained; owner changes preserved", {}, {"invoice_id": invoice.id})
            if attempt.consent_at and invoice.kind == "initial":
                attempt.token_pending = True
            db.commit()
            return
        if invoice.kind in {"initial", "renewal"}:
            if invoice.kind == "initial":
                invoice.period_start = now()
                invoice.period_end = month_after(invoice.period_start, invoice.period_start)
            sub.current_period_starts_at = invoice.period_start
            sub.current_period_ends_at = invoice.period_end
            sub.billing_anchor_at = sub.billing_anchor_at or invoice.period_start
            if invoice.kind == "initial":
                sub.billing_anchor_at = invoice.period_start
            sub.grace_ends_at = None
            if sub.status != "cancelled":
                sub.status = "active"
            if invoice.kind == "initial":
                sub.provider = "allpay"
                if not sub.cancelled_at or aware(sub.cancelled_at) < aware(attempt.consent_at):
                    sub.cancel_at_period_end = False
                    sub.status = "active"
                    sub.automatic_billing = not bool(sub.access_override)
            plan = require_plan(invoice.plan_code)
            sub.plan_code, sub.amount_minor = plan.code, sub.amount_minor if sub.amount_minor is not None and invoice.plan_code == sub.plan_code else plan.amount_minor
            sub.clinic_limit, sub.staff_limit = plan.clinic_limit, plan.staff_limit
            if sub.pending_plan_code == plan.code:
                sub.pending_plan_code = None
                sub.pending_change_at = None
            # Balance is consumed when an invoice is issued, not on duplicate delivery.
        elif invoice.kind == "upgrade" and sub.provider == "allpay" and not sub.access_override:
            plan = require_plan(invoice.plan_code)
            sub.plan_code, sub.amount_minor = plan.code, plan.amount_minor
            sub.clinic_limit, sub.staff_limit = plan.clinic_limit, plan.staff_limit
        if attempt.consent_at and invoice.kind == "initial":
            attempt.token_pending = True
    elif status == 0 and invoice.status != "paid" and (payload.get("decline_code") or payload.get("decline_reason") or payload.get("error")):
        failure(db, sub, invoice, attempt, str(payload.get("decline_code") or "declined"))
    elif status in {3, 4}:
        refunded = Decimal(str(payload.get("refunded", payload.get("amount", 0)))) * 100
        invoice.refunded_minor = min(invoice.amount_minor, max(invoice.refunded_minor, int(refunded)))
        for pending_refund in db.query(SubscriptionRefund).filter_by(invoice_id=invoice.id, status="submitted").all():
            if invoice.refunded_minor >= pending_refund.refunded_before + pending_refund.amount_minor:
                pending_refund.status = "paid"
        if invoice.refunded_minor == invoice.amount_minor:
            invoice.status = "refunded"
            if sub.current_period_ends_at and aware(sub.current_period_ends_at) == aware(invoice.period_end):
                sub.status = "read_only"
                sub.automatic_billing = False
    db.commit()


def reconcile(db, attempt_id):
    attempt = db.get(SubscriptionPaymentAttempt, attempt_id)
    if not attempt or attempt.kind == "capture" or attempt.test_mode != settings.ALLPAY_TEST_MODE:
        return
    # A hosted page may be retried by its customer. Unknown token charges are never retried automatically.
    try:
        result = allpay.request("paymentstatus", {"order_id": attempt_id})
        settle(db, attempt_id, result)
    except allpay.AllpayError:
        db.rollback()
    recover_token(db, attempt_id)


def charge(db, invoice_id):
    stub = db.get(SubscriptionInvoice, invoice_id)
    sub = locked_subscription(db, stub.company_id)
    invoice = db.query(SubscriptionInvoice).filter_by(id=invoice_id).with_for_update().populate_existing().one()
    if not settings.BILLING_CHARGING_ENABLED or not sub.automatic_billing or sub.cancel_at_period_end or sub.access_override in {"suspended", "read_only"}:
        db.rollback()
        return
    if invoice.status != "open" or sub.provider != "allpay" or invoice.billing_revision != (sub.billing_revision or 0):
        db.rollback()
        return
    attempts = db.query(SubscriptionPaymentAttempt).filter_by(invoice_id=invoice.id).all()
    if any(a.status in {"submitted", "unknown", "created", "paid"} for a in attempts):
        db.rollback()
        return
    if invoice.kind == "upgrade" and aware(invoice.due_at) + timedelta(minutes=10) < now():
        invoice.status = "void"
        db.commit()
        return
    method = db.get(SubscriptionPaymentMethod, sub.company_id)
    if method and any(a.status == "needs_card" and a.submitted_at and aware(method.updated_at) <= aware(a.submitted_at) for a in attempts):
        raise HTTPException(409, detail={"code": "payment_method_required"})
    if not method:
        sub.status = "past_due" if invoice.kind == "renewal" else sub.status
        sub.grace_ends_at = aware(invoice.period_start) + timedelta(days=7) if invoice.kind == "renewal" else sub.grace_ends_at
        invoice.next_attempt_at = None
        invoice.notification_kind = "payment_failed"
        db.commit()
        return
    attempt = SubscriptionPaymentAttempt(id=uid(), company_id=sub.company_id, invoice_id=invoice.id,
        kind="payment", status="submitted", billing_revision=sub.billing_revision or 0, test_mode=settings.ALLPAY_TEST_MODE, submitted_at=now(), token_pending=False)
    db.add(attempt)
    order_id, amount = attempt.id, invoice.amount_minor
    token = decrypt_secret(method.token_encrypted)
    company = db.get(Company, sub.company_id)
    contact = db.query(User).filter(User.company_id == sub.company_id, User.role_level >= 4,
        User.is_active.is_(True)).order_by(User.id).first()
    body = {"order_id": order_id, "allpay_token": token,
        "client_name": company.owner_full_name or (contact.full_name if contact else company.name),
        "client_email": company.contact_email or (contact.email if contact else None),
        "items": [{"name": "Prysm " + invoice.plan_code, "qty": 1, "price": amount / 100, "vat": 1}],
        "currency_display": "ILS", "currency_payment": "ILS",
        "webhook_url": settings.API_PUBLIC_URL.rstrip("/") + settings.API_V1_STR + "/subscriptions/webhooks/allpay"}
    db.commit()  # A crash from here onward leaves a submitted attempt for reconciliation.
    try:
        result = allpay.request("getpayment", body)
        if result.get("status") == 1:
            # Token response contains no amount/currency; verify through paymentstatus.
            reconcile(db, order_id)
        else:
            raise allpay.AllpayError("provider_unavailable", uncertain=True)
    except allpay.AllpayError as exc:
        sub = locked_subscription(db, sub.company_id)
        invoice = db.query(SubscriptionInvoice).filter_by(id=invoice_id).with_for_update().one()
        attempt = db.get(SubscriptionPaymentAttempt, order_id)
        if attempt.status != "paid":
            if exc.uncertain:
                attempt.status = "unknown"
            else:
                failure(db, sub, invoice, attempt, exc.code)
        db.commit()


def quote_state(sub):
    return "|".join(str(value) for value in (sub.plan_code, sub.amount_minor, aware(sub.current_period_ends_at),
        aware(sub.current_period_starts_at), sub.access_override, sub.automatic_billing, sub.cancel_at_period_end, sub.balance_minor, sub.billing_revision))


def preview(sub, target, at=None):
    if sub.provider != "allpay" or sub.access_override or sub.status not in {"active", "trialing"} or not sub.automatic_billing or sub.cancel_at_period_end:
        raise HTTPException(409, detail={"code": "managed_account"})
    at = aware(at or now()).replace(microsecond=0)
    if sub.plan_code == target.code:
        raise HTTPException(409, detail={"code": "same_plan"})
    current = sub.amount_minor if sub.amount_minor is not None else require_plan(sub.plan_code).amount_minor
    upgrade = target.amount_minor > current
    amount = 0
    if upgrade and sub.status != "trialing":
        start, end = aware(sub.current_period_starts_at), aware(sub.current_period_ends_at)
        if not start or not end or not start <= at < end:
            raise HTTPException(409, detail={"code": "renewal_required"})
        fraction = Decimal(str((end - at).total_seconds())) / Decimal(str((end - start).total_seconds()))
        amount = int((Decimal(target.amount_minor - current) * fraction).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    claims = {"company": sub.company_id, "plan": target.code, "amount": amount, "state": quote_state(sub),
        "at": int(at.timestamp()), "exp": int((at + timedelta(minutes=10)).timestamp()), "purpose": "plan_quote"}
    return {"plan": target.public_dict(), "direction": "upgrade" if upgrade else "downgrade",
        "timing": "immediate" if upgrade else "next_renewal", "amount_due_minor": amount if amount >= 500 else 0,
        "deferred_amount_minor": amount if 0 < amount < 500 else 0, "currency": "ILS", "preserves_trial_end": sub.status == "trialing",
        "quote_token": jwt.encode(claims, settings.SECRET_KEY, algorithm=settings.ALGORITHM)}


def change_plan(db, user, code, quote_token):
    try:
        claims = jwt.decode(quote_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except (JWTError, TypeError) as exc:
        raise HTTPException(409, detail={"code": "quote_expired"}) from exc
    sub = locked_subscription(db, user.company_id)
    target = require_plan(code, self_service=True)
    if claims.get("company") != user.company_id or claims.get("plan") != code or claims.get("purpose") != "plan_quote" or claims.get("state") != quote_state(sub):
        raise HTTPException(409, detail={"code": "quote_expired"})
    validate_plan_change(db, sub, target)
    result = preview(sub, target, datetime.fromtimestamp(claims["at"], UTC))
    if result["direction"] == "downgrade":
        sub.pending_plan_code, sub.pending_change_at = target.code, sub.current_period_ends_at or sub.trial_ends_at
        db.commit()
        return
    amount = claims["amount"]
    if amount < 500:
        sub.balance_minor = (sub.balance_minor or 0) + amount
        sub.plan_code, sub.amount_minor = target.code, target.amount_minor
        sub.clinic_limit, sub.staff_limit = target.clinic_limit, target.staff_limit
        db.commit()
        return
    cycle = "upgrade:" + hashlib.sha256(quote_token.encode()).hexdigest()
    invoice = db.query(SubscriptionInvoice).filter_by(cycle_key=cycle).first()
    if not invoice:
        # One unresolved upgrade at a time; abandoned/failed attempts remain retryable.
        pending = db.query(SubscriptionInvoice).filter_by(company_id=sub.company_id, kind="upgrade", status="open").first()
        if pending:
            raise HTTPException(409, detail={"code": "payment_reconciling"})
        invoice = new_invoice(db, sub, kind="upgrade", cycle=cycle, amount=amount, plan=target.code,
            start=sub.current_period_starts_at, end=sub.current_period_ends_at)
    invoice_id = invoice.id
    db.commit()
    charge(db, invoice_id)


def enqueue_renewal(db, company_id):
    sub = locked_subscription(db, company_id)
    due = aware(sub.trial_ends_at if sub.status == "trialing" else sub.current_period_ends_at)
    if not due or due > now() or not sub.automatic_billing or sub.cancel_at_period_end or sub.access_override in {"suspended", "read_only"} or sub.provider != "allpay" or sub.status not in {"trialing", "active", "past_due"}:
        db.rollback()
        return None
    # An unresolved older attempt must be settled before billing a revised contract.
    outstanding = db.query(SubscriptionInvoice).filter_by(company_id=company_id, kind="renewal", status="open", period_start=due).first()
    if outstanding:
        invoice_id = outstanding.id
        db.rollback()
        return invoice_id
    cycle = f"renewal:{company_id}:{due.isoformat()}:{sub.billing_revision or 0}"
    existing = db.query(SubscriptionInvoice).filter_by(cycle_key=cycle).first()
    if existing:
        invoice_id = existing.id
        db.rollback()
        return invoice_id
    target = require_plan(sub.pending_plan_code or sub.plan_code)
    if sub.pending_plan_code:
        try:
            validate_plan_change(db, sub, target)
        except HTTPException:
            audit(db, company_id, None, "downgrade_blocked", "Usage exceeds scheduled plan", {}, {"plan": target.code})
            sub.pending_plan_code, sub.pending_change_at = None, None
            target = require_plan(sub.plan_code)
    price = target.amount_minor if target.code != sub.plan_code else sub.amount_minor
    price = price if price is not None else target.amount_minor
    if price is None or price + (sub.balance_minor or 0) < 500:
        db.rollback()
        return None
    row = new_invoice(db, sub, kind="renewal", cycle=cycle, amount=price + (sub.balance_minor or 0),
        plan=target.code, start=due, end=month_after(due, sub.billing_anchor_at or due))
    row.carry_minor = sub.balance_minor or 0
    sub.balance_minor = 0
    sub.status = "past_due"
    sub.grace_ends_at = due + timedelta(days=7)
    row.next_attempt_at = now()
    invoice_id = row.id
    db.commit()
    return invoice_id


def refund(db, invoice_id, amount, actor, reason):
    invoice = db.get(SubscriptionInvoice, invoice_id)
    if not invoice:
        raise HTTPException(404, detail={"code": "payment_not_found"})
    sub = locked_subscription(db, invoice.company_id)
    invoice = db.query(SubscriptionInvoice).filter_by(id=invoice_id).with_for_update().populate_existing().one()
    pending = db.query(SubscriptionRefund).filter_by(invoice_id=invoice_id, status="submitted").first()
    if pending:
        raise HTTPException(409, detail={"code": "payment_reconciling"})
    attempt = db.query(SubscriptionPaymentAttempt).filter_by(invoice_id=invoice_id, status="paid").first()
    if not attempt or attempt.test_mode != settings.ALLPAY_TEST_MODE or not 0 < amount <= invoice.amount_minor - invoice.refunded_minor:
        raise HTTPException(400, detail={"code": "invalid_refund"})
    row = SubscriptionRefund(id=uid(), invoice_id=invoice_id, attempt_id=attempt.id, amount_minor=amount, refunded_before=invoice.refunded_minor, status="submitted")
    db.add(row)
    audit(db, sub.company_id, actor, "refund_requested", reason, {"refunded_minor": invoice.refunded_minor}, {"amount_minor": amount, "refund_id": row.id})
    refund_id, order_id = row.id, attempt.id
    db.commit()
    try:
        result = allpay.request("refund", {"order_id": order_id, "amount": amount / 100})
    except allpay.AllpayError as exc:
        if not exc.uncertain:
            row = db.get(SubscriptionRefund, refund_id)
            row.status = "failed"
            db.commit()
        raise HTTPException(409, detail={"code": "refund_reconciling" if exc.uncertain else "refund_failed"}) from exc
    if result.get("status") not in {3, 4}:
        raise HTTPException(409, detail={"code": "refund_reconciling"})
    locked_subscription(db, sub.company_id)
    row = db.get(SubscriptionRefund, refund_id)
    row.status = "paid"
    row.receipt_url = result.get("receipt")
    invoice = db.query(SubscriptionInvoice).filter_by(id=invoice_id).with_for_update().populate_existing().one()
    invoice.refunded_minor = max(invoice.refunded_minor, row.refunded_before + amount)
    if invoice.refunded_minor >= invoice.amount_minor:
        invoice.status = "refunded"
        if sub.current_period_ends_at and aware(sub.current_period_ends_at) == aware(invoice.period_end):
            sub.status, sub.automatic_billing = "read_only", False
    db.commit()
    return {"id": refund_id, "status": "paid"}
