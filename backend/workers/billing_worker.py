"""Run as a dedicated process; no charging inside API startup or request middleware."""
import logging
import time
from datetime import timedelta

from config import settings
from database import SessionLocal
from models import Subscription, SubscriptionInvoice, SubscriptionPaymentAttempt, User
from services import saas_billing as billing
from services.transactional_email import send_email

logger = logging.getLogger(__name__)


def run_once():
    with SessionLocal() as db:
        # Safe reads/reconciliation continue even when new charges are disabled.
        attempts = db.query(SubscriptionPaymentAttempt.id).filter(
            SubscriptionPaymentAttempt.kind == "payment",
            SubscriptionPaymentAttempt.status.in_(["submitted", "unknown"]),
            SubscriptionPaymentAttempt.submitted_at < billing.now() - timedelta(seconds=30)).limit(25).all()
        for (attempt_id,) in attempts:
            billing.reconcile(db, attempt_id)
        pending = db.query(SubscriptionPaymentAttempt.id).filter_by(token_pending=True).limit(25).all()
        for (attempt_id,) in pending:
            billing.recover_token(db, attempt_id)
        if settings.BILLING_CHARGING_ENABLED:
            ids = db.query(Subscription.company_id).filter_by(provider="allpay", automatic_billing=True).all()
            for (company_id,) in ids:
                billing.enqueue_renewal(db, company_id)
            due = db.query(SubscriptionInvoice.id).filter(SubscriptionInvoice.status == "open",
                SubscriptionInvoice.kind == "renewal", SubscriptionInvoice.next_attempt_at <= billing.now()).limit(25).all()
            for (invoice_id,) in due:
                billing.charge(db, invoice_id)
        # One localized billing/account email, separate from campaign entitlements.
        invoices = db.query(SubscriptionInvoice).filter(SubscriptionInvoice.notification_kind.isnot(None),
            SubscriptionInvoice.notification_sent_at.is_(None)).with_for_update(skip_locked=True).limit(25).all()
        for invoice in invoices:
            user = db.query(User).filter(User.company_id == invoice.company_id, User.role_level >= 4, User.is_active.is_(True)).order_by(User.id).first()
            if not user or not user.email:
                continue
            from html import escape
            success = invoice.notification_kind == "payment_received"
            from services.billing_copy import COPY
            subscription = db.query(Subscription).filter_by(company_id=invoice.company_id).first()
            locale = subscription.billing_locale if subscription else "en"
            copy = COPY.get(locale, COPY["en"])
            title = "Prysm: " + copy[invoice.notification_kind]
            message = copy["received" if success else "failed"]
            direction = "rtl" if locale == "he" else "ltr"
            if send_email(to=user.email, subject=title, html=f'<div dir="{direction}"><p>{message}</p><p>₪{invoice.amount_minor / 100:.2f}</p><a href="{escape(settings.SITE_URL)}/account/billing">{copy["billing"]}</a></div>'):
                invoice.notification_sent_at = billing.now()
        db.commit()


def main():
    logging.basicConfig(level=logging.INFO)
    while True:
        try:
            run_once()
        except Exception:
            logger.exception("Billing worker iteration failed")
        time.sleep(30)


if __name__ == "__main__":
    main()
