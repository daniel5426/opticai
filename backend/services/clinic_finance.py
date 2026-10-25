"""One invoice owner and one signed payment amount, shared by reports and analytics."""
from sqlalchemy import select, union_all, func, case, literal, Float, type_coerce
from models import Billing, BillingPayment, Order, ContactLensOrder, OrderGroup, Client, Clinic


def invoice_ledger(clinic_id=None, company_id=None):
    parts = []
    recorded_payments = select(func.sum(payment_amount())).where(
        BillingPayment.billing_id == Billing.id, BillingPayment.currency == Billing.currency).correlate(Billing).scalar_subquery()
    for model, join, owner, dated, grouped in (
        (OrderGroup, Billing.order_group_id == OrderGroup.id, OrderGroup.payer_client_id, OrderGroup.opened_date, True),
        (Order, Billing.order_id == Order.id, Order.client_id, Order.order_date, False),
        (ContactLensOrder, Billing.contact_lens_id == ContactLensOrder.id, ContactLensOrder.client_id, ContactLensOrder.order_date, False),
    ):
        total = func.coalesce(Billing.total_after_discount, 0)
        paid = func.coalesce(Billing.prepayment_amount, recorded_payments, 0)
        query = select(Billing.id.label('id'), owner.label('client_id'), model.clinic_id.label('clinic_id'),
            dated.label('order_date'), model.type.label('type'), total.label('total'), paid.label('paid'),
            case((total > paid, total - paid), else_=0).label('outstanding'), Billing.currency.label('currency'))\
            .select_from(Billing).join(model, join).join(Clinic, Clinic.id == model.clinic_id)\
            .join(Client, Client.id == owner).where(model.deleted_at.is_(None), Client.deleted_at.is_(None),
                Client.merged_into_client_id.is_(None), Client.clinic_id == model.clinic_id)
        if clinic_id is not None:
            query = query.where(model.clinic_id == clinic_id)
        if company_id is not None:
            query = query.where(Clinic.company_id == company_id)
        if not grouped:
            query = query.where(Billing.order_group_id.is_(None))
            if model is ContactLensOrder:
                query = query.where(Billing.order_id.is_(None))
        parts.append(query)
    return union_all(*parts).subquery('invoice_ledger')


def payment_amount():
    # Older imports may encode refunds positively; negative refunds stay negative.
    return type_coerce(case((func.lower(BillingPayment.kind).in_(['refund', 'credit']), -func.abs(BillingPayment.amount)),
                else_=BillingPayment.amount), Float)


def analytics_sales(db, company_id, end_date, start_date=None, clinic_id=None, currency='ILS'):
    ledger = invoice_ledger(clinic_id, company_id)
    query = db.query(ledger.c.order_date, ledger.c.clinic_id, Clinic.name, ledger.c.type,
        func.sum(ledger.c.total), func.count(ledger.c.id)).join(Clinic, Clinic.id == ledger.c.clinic_id)\
        .filter(ledger.c.currency == currency, ledger.c.order_date <= end_date)
    if start_date:
        query = query.filter(ledger.c.order_date >= start_date)
    return [{'date': r[0], 'clinic_id': r[1], 'clinic_name': r[2], 'type': r[3], 'amount': float(r[4] or 0), 'orders': r[5]}
            for r in query.group_by(ledger.c.order_date, ledger.c.clinic_id, Clinic.name, ledger.c.type)]


def analytics_payments(db, company_id, end_date, start_date=None, clinic_id=None, currency='ILS'):
    ledger = invoice_ledger(clinic_id, company_id)
    query = db.query(BillingPayment.paid_at, ledger.c.clinic_id, Clinic.name, func.sum(payment_amount()))\
        .select_from(BillingPayment).join(ledger, ledger.c.id == BillingPayment.billing_id)\
        .join(Clinic, Clinic.id == ledger.c.clinic_id).filter(BillingPayment.currency == currency, BillingPayment.paid_at <= end_date)
    if start_date:
        query = query.filter(BillingPayment.paid_at >= start_date)
    return [{'date': r[0], 'clinic_id': r[1], 'clinic_name': r[2], 'amount': float(r[3] or 0)}
            for r in query.group_by(BillingPayment.paid_at, ledger.c.clinic_id, Clinic.name)]


def outstanding_at(db, clinic_id, day, currency, company_id=None):
    ledger = invoice_ledger(clinic_id, company_id)
    payments = select(BillingPayment.billing_id.label('id'), func.sum(payment_amount()).label('paid'))\
        .where(BillingPayment.currency == currency, BillingPayment.paid_at > day).group_by(BillingPayment.billing_id).subquery()
    # Rewind the authoritative cumulative amount; a partial legacy ledger is not added again.
    paid = ledger.c.paid - func.coalesce(payments.c.paid, 0)
    balance = ledger.c.total - paid
    return float(db.query(func.coalesce(func.sum(case((balance > 0, balance), else_=0)), 0)).select_from(ledger)\
        .outerjoin(payments, payments.c.id == ledger.c.id)\
        .filter(ledger.c.currency == currency, ledger.c.order_date <= day).scalar() or 0)
