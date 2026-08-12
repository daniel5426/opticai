from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any, Literal

from fastapi import HTTPException
from sqlalchemy import and_, case, func
from sqlalchemy.orm import Session
from currency import DEFAULT_CURRENCY, normalize_currency


AnalyticsBucket = Literal["day", "week", "month"]


@dataclass(frozen=True)
class AnalyticsWindow:
    start_date: date
    end_date: date
    previous_start: date
    previous_end: date
    bucket: AnalyticsBucket

    @property
    def days(self) -> int:
        return (self.end_date - self.start_date).days + 1


def resolve_analytics_window(
    start_date: date | None,
    end_date: date | None,
    bucket: str | None = None,
    *,
    default_days: int = 30,
) -> AnalyticsWindow:
    resolved_end = end_date or date.today()
    resolved_start = start_date or (resolved_end - timedelta(days=default_days - 1))
    if resolved_start > resolved_end:
        raise HTTPException(status_code=422, detail="start_date must be before or equal to end_date")
    days = (resolved_end - resolved_start).days + 1
    resolved_bucket: AnalyticsBucket
    if bucket in {"day", "week", "month"}:
        resolved_bucket = bucket  # type: ignore[assignment]
    elif days <= 45:
        resolved_bucket = "day"
    elif days <= 180:
        resolved_bucket = "week"
    else:
        resolved_bucket = "month"
    previous_end = resolved_start - timedelta(days=1)
    return AnalyticsWindow(
        start_date=resolved_start,
        end_date=resolved_end,
        previous_start=resolved_start - timedelta(days=days),
        previous_end=previous_end,
        bucket=resolved_bucket,
    )


def as_date(value: date | datetime | str | None) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def bucket_key(value: date, window: AnalyticsWindow) -> str:
    if window.bucket == "day":
        return value.isoformat()
    if window.bucket == "week":
        offset = max(0, (value - window.start_date).days // 7)
        return (window.start_date + timedelta(days=offset * 7)).isoformat()
    return date(value.year, value.month, 1).isoformat()


def bucket_label(value: date, bucket: AnalyticsBucket) -> str:
    if bucket == "month":
        return value.strftime("%m/%y")
    return value.strftime("%d/%m")


def empty_series(window: AnalyticsWindow, keys: tuple[str, ...]) -> list[dict[str, Any]]:
    points: list[dict[str, Any]] = []
    cursor = window.start_date
    while cursor <= window.end_date:
        point = {"bucket": bucket_key(cursor, window), "label": bucket_label(cursor, window.bucket)}
        point.update({key: 0 for key in keys})
        points.append(point)
        if window.bucket == "day":
            cursor += timedelta(days=1)
        elif window.bucket == "week":
            cursor += timedelta(days=7)
        else:
            cursor = date(cursor.year + (1 if cursor.month == 12 else 0), 1 if cursor.month == 12 else cursor.month + 1, 1)
    return points


def add_to_series(
    series: list[dict[str, Any]],
    window: AnalyticsWindow,
    value_date: date | datetime | str | None,
    field: str,
    amount: float,
) -> None:
    resolved = as_date(value_date)
    if not resolved or resolved < window.start_date or resolved > window.end_date:
        return
    target = bucket_key(resolved, window)
    for point in series:
        if point["bucket"] == target:
            point[field] = round(float(point.get(field, 0)) + float(amount or 0), 2)
            return


def percent_change(current: float, previous: float) -> float | None:
    if previous == 0:
        return 0.0 if current == 0 else None
    return round(((current - previous) / abs(previous)) * 100, 1)


def metric_payload(
    key: str,
    label: str,
    current: float,
    previous: float,
    series: list[dict[str, Any]],
    *,
    series_field: str,
    context: str | None = None,
    snapshot: bool = False,
) -> dict[str, Any]:
    return {
        "key": key,
        "label": label,
        "value": round(float(current or 0), 2),
        "previous": round(float(previous or 0), 2),
        "change_percent": percent_change(float(current or 0), float(previous or 0)),
        "series": [
            {
                "bucket": point["bucket"],
                "label": point["label"],
                "value": round(float(point.get(series_field, 0)), 2),
            }
            for point in series
        ],
        "context": context,
        "snapshot": snapshot,
    }


def _company_sales_rows(
    db: Session,
    company_id: int,
    end_date: date,
    *,
    start_date: date | None = None,
    clinic_id: int | None = None,
    currency: str = DEFAULT_CURRENCY,
) -> list[dict[str, Any]]:
    from models import Billing, Clinic, ContactLensOrder, Order

    def apply_filters(query, order_model):
        query = query.filter(
            Clinic.company_id == company_id,
            order_model.order_date <= end_date,
            Billing.currency == currency,
        )
        if start_date:
            query = query.filter(order_model.order_date >= start_date)
        if clinic_id:
            query = query.filter(order_model.clinic_id == clinic_id)
        return query

    regular = apply_filters(
        db.query(
            Order.order_date,
            Clinic.id,
            Clinic.name,
            Order.type,
            func.coalesce(func.sum(Billing.total_after_discount), 0),
            func.count(func.distinct(Billing.id)),
        )
        .join(Order, Billing.order_id == Order.id)
        .join(Clinic, Order.clinic_id == Clinic.id)
        .group_by(Order.order_date, Clinic.id, Clinic.name, Order.type),
        Order,
    ).all()
    contacts = apply_filters(
        db.query(
            ContactLensOrder.order_date,
            Clinic.id,
            Clinic.name,
            ContactLensOrder.type,
            func.coalesce(func.sum(Billing.total_after_discount), 0),
            func.count(func.distinct(Billing.id)),
        )
        .join(ContactLensOrder, Billing.contact_lens_id == ContactLensOrder.id)
        .join(Clinic, ContactLensOrder.clinic_id == Clinic.id)
        .group_by(ContactLensOrder.order_date, Clinic.id, Clinic.name, ContactLensOrder.type),
        ContactLensOrder,
    ).all()
    return [
        {
            "date": row[0],
            "clinic_id": row[1],
            "clinic_name": row[2] or "ללא שם",
            "type": row[3] or fallback,
            "amount": float(row[4] or 0),
            "orders": int(row[5] or 0),
        }
        for rows, fallback in ((regular, "הזמנה רגילה"), (contacts, "עדשות מגע"))
        for row in rows
    ]


def _company_payment_rows(
    db: Session,
    company_id: int,
    end_date: date,
    *,
    start_date: date | None = None,
    clinic_id: int | None = None,
    currency: str = DEFAULT_CURRENCY,
) -> list[dict[str, Any]]:
    from models import Billing, BillingPayment, Clinic, ContactLensOrder, Order

    def apply_filters(query, order_model):
        query = query.filter(
            Clinic.company_id == company_id,
            BillingPayment.paid_at <= end_date,
            BillingPayment.currency == currency,
        )
        if start_date:
            query = query.filter(BillingPayment.paid_at >= start_date)
        if clinic_id:
            query = query.filter(order_model.clinic_id == clinic_id)
        return query

    regular = apply_filters(
        db.query(
            BillingPayment.paid_at,
            Clinic.id,
            Clinic.name,
            func.coalesce(func.sum(BillingPayment.amount), 0),
        )
        .join(Billing, BillingPayment.billing_id == Billing.id)
        .join(Order, Billing.order_id == Order.id)
        .join(Clinic, Order.clinic_id == Clinic.id)
        .group_by(BillingPayment.paid_at, Clinic.id, Clinic.name),
        Order,
    ).all()
    contacts = apply_filters(
        db.query(
            BillingPayment.paid_at,
            Clinic.id,
            Clinic.name,
            func.coalesce(func.sum(BillingPayment.amount), 0),
        )
        .join(Billing, BillingPayment.billing_id == Billing.id)
        .join(ContactLensOrder, Billing.contact_lens_id == ContactLensOrder.id)
        .join(Clinic, ContactLensOrder.clinic_id == Clinic.id)
        .group_by(BillingPayment.paid_at, Clinic.id, Clinic.name),
        ContactLensOrder,
    ).all()
    return [
        {
            "date": row[0],
            "clinic_id": row[1],
            "clinic_name": row[2] or "ללא שם",
            "amount": float(row[3] or 0),
        }
        for rows in (regular, contacts)
        for row in rows
    ]


def _company_outstanding_by_clinic(
    db: Session,
    company_id: int,
    window: AnalyticsWindow,
    *,
    clinic_id: int | None = None,
    currency: str = DEFAULT_CURRENCY,
) -> dict[int, dict[str, float]]:
    """Return current and previous open balances without materializing billing rows."""
    from models import Billing, BillingPayment, Clinic, ContactLensOrder, Order

    def balance_query(order_model, join_condition):
        query = (
            db.query(
                Billing.id.label("billing_id"),
                order_model.order_date.label("order_date"),
                Clinic.id.label("clinic_id"),
                func.coalesce(Billing.total_after_discount, 0).label("amount"),
                func.coalesce(
                    func.sum(
                        case(
                            (BillingPayment.paid_at <= window.end_date, BillingPayment.amount),
                            else_=0.0,
                        )
                    ),
                    0.0,
                ).label("current_paid"),
                func.coalesce(
                    func.sum(
                        case(
                            (BillingPayment.paid_at <= window.previous_end, BillingPayment.amount),
                            else_=0.0,
                        )
                    ),
                    0.0,
                ).label("previous_paid"),
            )
            .select_from(Billing)
            .join(order_model, join_condition)
            .join(Clinic, order_model.clinic_id == Clinic.id)
            .filter(Billing.currency == currency)
            .outerjoin(
                BillingPayment,
                and_(
                    BillingPayment.billing_id == Billing.id,
                    BillingPayment.paid_at <= window.end_date,
                ),
            )
            .filter(
                Clinic.company_id == company_id,
                order_model.order_date <= window.end_date,
            )
            .group_by(Billing.id, order_model.order_date, Clinic.id, Billing.total_after_discount)
        )
        if clinic_id:
            query = query.filter(order_model.clinic_id == clinic_id)
        return query

    billing_balances = balance_query(Order, Billing.order_id == Order.id).union_all(
        balance_query(ContactLensOrder, Billing.contact_lens_id == ContactLensOrder.id),
    ).subquery("analytics_billing_balances")

    amount = func.coalesce(billing_balances.c.amount, 0.0)
    current_balance = amount - func.coalesce(billing_balances.c.current_paid, 0.0)
    previous_balance = amount - func.coalesce(billing_balances.c.previous_paid, 0.0)
    current_open = case((current_balance > 0, current_balance), else_=0.0)
    previous_open = case((previous_balance > 0, previous_balance), else_=0.0)

    rows = (
        db.query(
            billing_balances.c.clinic_id,
            func.coalesce(func.sum(current_open), 0.0),
            func.coalesce(
                func.sum(
                    case(
                        (billing_balances.c.order_date <= window.previous_end, previous_open),
                        else_=0.0,
                    )
                ),
                0.0,
            ),
        )
        .group_by(billing_balances.c.clinic_id)
        .all()
    )
    return {
        int(row[0]): {
            "current": float(row[1] or 0),
            "previous": float(row[2] or 0),
        }
        for row in rows
    }


def build_company_analytics(
    db: Session,
    *,
    company_id: int,
    window: AnalyticsWindow,
    clinic_id: int | None = None,
    currency: str = DEFAULT_CURRENCY,
) -> dict[str, Any]:
    from models import Appointment, Client, Clinic, ContactLensOrder, Order, OrderLineItem, Billing

    clinics_query = db.query(Clinic.id, Clinic.name).filter(Clinic.company_id == company_id)
    if clinic_id:
        clinics_query = clinics_query.filter(Clinic.id == clinic_id)
    clinic_rows = clinics_query.order_by(Clinic.id.asc()).all()
    if clinic_id and not clinic_rows:
        raise HTTPException(status_code=404, detail="Clinic not found")

    currency = normalize_currency(currency) or DEFAULT_CURRENCY
    all_start = window.previous_start
    sales_rows = _company_sales_rows(
        db, company_id, window.end_date, start_date=all_start, clinic_id=clinic_id, currency=currency
    )
    payment_rows = _company_payment_rows(
        db, company_id, window.end_date, start_date=all_start, clinic_id=clinic_id, currency=currency
    )
    current_sales_rows = [row for row in sales_rows if window.start_date <= row["date"] <= window.end_date]
    previous_sales_rows = [row for row in sales_rows if window.previous_start <= row["date"] <= window.previous_end]
    current_payment_rows = [row for row in payment_rows if window.start_date <= row["date"] <= window.end_date]
    previous_payment_rows = [row for row in payment_rows if window.previous_start <= row["date"] <= window.previous_end]

    series = empty_series(window, ("sales", "collected", "appointments", "new_clients", "orders"))
    for row in current_sales_rows:
        add_to_series(series, window, row["date"], "sales", row["amount"])
        add_to_series(series, window, row["date"], "orders", row["orders"])
    for row in current_payment_rows:
        add_to_series(series, window, row["date"], "collected", row["amount"])

    clinic_ids = [row[0] for row in clinic_rows]
    appointment_rows = []
    client_rows = []
    if clinic_ids:
        appointment_rows = db.query(Appointment.date, func.count(Appointment.id)).filter(
            Appointment.clinic_id.in_(clinic_ids),
            Appointment.date >= window.previous_start,
            Appointment.date <= window.end_date,
        ).group_by(Appointment.date).all()
        client_rows = db.query(Client.file_creation_date, func.count(Client.id)).filter(
            Client.clinic_id.in_(clinic_ids),
            Client.file_creation_date >= window.previous_start,
            Client.file_creation_date <= window.end_date,
        ).group_by(Client.file_creation_date).all()
    current_appointments = 0
    previous_appointments = 0
    for row_date, count in appointment_rows:
        amount = int(count or 0)
        if window.start_date <= row_date <= window.end_date:
            current_appointments += amount
            add_to_series(series, window, row_date, "appointments", amount)
        elif window.previous_start <= row_date <= window.previous_end:
            previous_appointments += amount
    current_clients = 0
    previous_clients = 0
    for row_date, count in client_rows:
        amount = int(count or 0)
        if window.start_date <= row_date <= window.end_date:
            current_clients += amount
            add_to_series(series, window, row_date, "new_clients", amount)
        elif window.previous_start <= row_date <= window.previous_end:
            previous_clients += amount

    current_sales = sum(row["amount"] for row in current_sales_rows)
    previous_sales = sum(row["amount"] for row in previous_sales_rows)
    current_collected = sum(row["amount"] for row in current_payment_rows)
    previous_collected = sum(row["amount"] for row in previous_payment_rows)
    current_orders = sum(row["orders"] for row in current_sales_rows)
    previous_orders = sum(row["orders"] for row in previous_sales_rows)
    current_aov = current_sales / current_orders if current_orders else 0
    previous_aov = previous_sales / previous_orders if previous_orders else 0
    aov_series = []
    for point in series:
        point_orders = float(point.get("orders", 0) or 0)
        aov_series.append(
            {
                "bucket": point["bucket"],
                "label": point["label"],
                "aov": round(float(point.get("sales", 0) or 0) / point_orders, 2) if point_orders else 0,
            }
        )

    outstanding_by_clinic = _company_outstanding_by_clinic(
        db, company_id, window, clinic_id=clinic_id, currency=currency
    )
    current_outstanding = sum(item["current"] for item in outstanding_by_clinic.values())
    previous_outstanding = sum(item["previous"] for item in outstanding_by_clinic.values())

    clinic_map: dict[int, dict[str, Any]] = {}
    for clinic_row in clinic_rows:
        clinic_map[clinic_row[0]] = {
            "clinic_id": clinic_row[0],
            "clinic_name": clinic_row[1] or "ללא שם",
            "sales": 0.0,
            "collected": 0.0,
            "outstanding": 0.0,
            "orders": 0,
            "share": 0.0,
        }
    for row in current_sales_rows:
        clinic_map[row["clinic_id"]]["sales"] += row["amount"]
        clinic_map[row["clinic_id"]]["orders"] += row["orders"]
    for row in current_payment_rows:
        clinic_map[row["clinic_id"]]["collected"] += row["amount"]
    for clinic_key, item in clinic_map.items():
        item["outstanding"] = round(outstanding_by_clinic.get(clinic_key, {}).get("current", 0), 2)
        item["sales"] = round(item["sales"], 2)
        item["collected"] = round(item["collected"], 2)
        item["share"] = round((item["sales"] / current_sales * 100), 1) if current_sales else 0
    clinic_ranking = sorted(clinic_map.values(), key=lambda item: item["sales"], reverse=True)

    order_mix: dict[str, int] = defaultdict(int)
    for row in current_sales_rows:
        order_mix[row["type"]] += row["orders"]

    def line_item_query(order_model, contact: bool):
        query = (
            db.query(OrderLineItem.sku, OrderLineItem.description, func.sum(OrderLineItem.quantity), func.sum(OrderLineItem.line_total))
            .join(Billing, OrderLineItem.billings_id == Billing.id)
            .join(order_model, (Billing.contact_lens_id if contact else Billing.order_id) == order_model.id)
            .join(Clinic, order_model.clinic_id == Clinic.id)
            .filter(Clinic.company_id == company_id, order_model.order_date >= window.start_date, order_model.order_date <= window.end_date)
            .filter(OrderLineItem.currency == currency)
        )
        if clinic_id:
            query = query.filter(order_model.clinic_id == clinic_id)
        return query.group_by(OrderLineItem.sku, OrderLineItem.description).all()

    product_map: dict[str, dict[str, Any]] = {}
    for row in [*line_item_query(Order, False), *line_item_query(ContactLensOrder, True)]:
        name = row[1] or row[0] or "ללא תיאור"
        item = product_map.setdefault(name, {"name": name, "sku": row[0], "quantity": 0.0, "sales": 0.0})
        item["quantity"] += float(row[2] or 0)
        item["sales"] += float(row[3] or 0)
    top_products = sorted(product_map.values(), key=lambda item: item["sales"], reverse=True)[:10]

    metrics = [
        metric_payload("sales", "מכירות", current_sales, previous_sales, series, series_field="sales"),
        metric_payload("collected", "תשלומים שנגבו", current_collected, previous_collected, series, series_field="collected"),
        metric_payload("outstanding", "יתרה פתוחה", current_outstanding, previous_outstanding, [], series_field="outstanding", context="נכון לסוף הטווח"),
        metric_payload("aov", "ממוצע להזמנה", current_aov, previous_aov, aov_series, series_field="aov"),
        metric_payload("orders", "הזמנות מחויבות", current_orders, previous_orders, series, series_field="orders"),
    ]
    return {
        "range": {
            "start_date": window.start_date,
            "end_date": window.end_date,
            "previous_start": window.previous_start,
            "previous_end": window.previous_end,
            "bucket": window.bucket,
        },
        "currency": currency,
        "metrics": metrics,
        "financial_series": series,
        "activity": {
            "series": series,
            "appointments": current_appointments,
            "previous_appointments": previous_appointments,
            "new_clients": current_clients,
            "previous_new_clients": previous_clients,
        },
        "clinic_ranking": clinic_ranking,
        "order_mix": [{"type": key, "count": value} for key, value in sorted(order_mix.items(), key=lambda item: item[1], reverse=True)],
        "top_products": [
            {**item, "quantity": round(item["quantity"], 1), "sales": round(item["sales"], 2)} for item in top_products
        ],
    }
