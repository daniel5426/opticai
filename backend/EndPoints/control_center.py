from collections import defaultdict
from typing import Dict, Any, List, Literal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Company, Clinic, User as UserModel, Appointment
from datetime import date, datetime, timedelta
from schemas import Company as CompanySchema, Clinic as ClinicSchema, User as UserSchema
from sqlalchemy import func

router = APIRouter(prefix="/control-center", tags=["control-center"])

def _get_company_or_404(db: Session, company_id: int) -> Company:
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company

def _get_company_clinics(db: Session, company_id: int) -> List[Clinic]:
    return db.query(Clinic).filter(Clinic.company_id == company_id).all()

def _get_company_users(db: Session, company_id: int) -> List[UserModel]:
    return (
        db.query(UserModel)
        .outerjoin(Clinic, UserModel.clinic_id == Clinic.id)
        .filter(
            (UserModel.company_id == company_id) | 
            (Clinic.company_id == company_id)
        )
        .all()
    )


def _month_start(value: date) -> date:
    return date(value.year, value.month, 1)


def _next_month(value: date) -> date:
    if value.month == 12:
        return date(value.year + 1, 1, 1)
    return date(value.year, value.month + 1, 1)


def _shift_months(value: date, months: int) -> date:
    year = value.year + ((value.month - 1 + months) // 12)
    month = ((value.month - 1 + months) % 12) + 1
    return date(year, month, 1)


def _get_range_definition(range_key: str) -> tuple[Literal["day", "month"], date, List[str], Dict[str, str]]:
    today = datetime.utcnow().date()
    if range_key == "7d":
        start = today - timedelta(days=6)
        keys = [(start + timedelta(days=index)).isoformat() for index in range(7)]
        labels = {
            key: (start + timedelta(days=index)).strftime("%d/%m")
            for index, key in enumerate(keys)
        }
        return "day", start, keys, labels
    if range_key == "30d":
        start = today - timedelta(days=29)
        keys = [(start + timedelta(days=index)).isoformat() for index in range(30)]
        labels = {
            key: (start + timedelta(days=index)).strftime("%d/%m")
            for index, key in enumerate(keys)
        }
        return "day", start, keys, labels

    current_month = _month_start(today)
    start = _shift_months(current_month, -11)
    keys = [_shift_months(start, index).isoformat() for index in range(12)]
    labels = {
        key: _shift_months(start, index).strftime("%m/%y")
        for index, key in enumerate(keys)
    }
    return "month", start, keys, labels


def _bucket_key(value: date, granularity: Literal["day", "month"]) -> str:
    if granularity == "day":
        return value.isoformat()
    return _month_start(value).isoformat()


def _sum_company_revenue(db: Session, company_id: int, start_date: date, end_date: date) -> float:
    from models import Billing as BillingModel, ContactLensOrder as CLOModel, Order as OrderModel

    order_total = (
        db.query(func.coalesce(func.sum(BillingModel.total_after_discount), 0))
        .join(OrderModel, BillingModel.order_id == OrderModel.id)
        .join(Clinic, OrderModel.clinic_id == Clinic.id)
        .filter(Clinic.company_id == company_id)
        .filter(OrderModel.order_date >= start_date)
        .filter(OrderModel.order_date < end_date)
        .scalar()
        or 0
    )

    clo_total = (
        db.query(func.coalesce(func.sum(BillingModel.total_after_discount), 0))
        .join(CLOModel, BillingModel.contact_lens_id == CLOModel.id)
        .join(Clinic, CLOModel.clinic_id == Clinic.id)
        .filter(Clinic.company_id == company_id)
        .filter(CLOModel.order_date >= start_date)
        .filter(CLOModel.order_date < end_date)
        .scalar()
        or 0
    )

    return float(order_total or 0) + float(clo_total or 0)

@router.get("/dashboard/{company_id}")
def get_dashboard_data(
    company_id: int,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    today = datetime.utcnow().date()
    month_start = _month_start(today)
    next_month_start = _next_month(month_start)

    total_clinics = db.query(func.count(Clinic.id)).filter(Clinic.company_id == company_id).scalar() or 0
    active_clinics_count = db.query(func.count(Clinic.id)).filter(Clinic.company_id == company_id, Clinic.is_active.is_(True)).scalar() or 0
    total_users = (
        db.query(func.count(func.distinct(UserModel.id)))
        .outerjoin(Clinic, UserModel.clinic_id == Clinic.id)
        .filter(
            (UserModel.company_id == company_id) |
            (Clinic.company_id == company_id)
        )
        .scalar()
        or 0
    )

    total_appointments_this_month = db.query(func.count(Appointment.id)) \
        .join(Clinic, Appointment.clinic_id == Clinic.id) \
        .filter(Clinic.company_id == company_id) \
        .filter(Appointment.date >= month_start) \
        .filter(Appointment.date < next_month_start) \
        .scalar() or 0

    monthly_revenue = _sum_company_revenue(db, company_id, month_start, next_month_start)

    return {
        "stats": {
            "totalClinics": int(total_clinics),
            "activeClinics": int(active_clinics_count),
            "totalUsers": int(total_users),
            "totalAppointments": int(total_appointments_this_month),
            "monthlyRevenue": round(monthly_revenue, 2),
        },
    }


@router.get("/stats/overview/{company_id}")
def stats_overview(company_id: int, range: str = "30d", db: Session = Depends(get_db)) -> Dict[str, Any]:
    from models import Billing as BillingModel, Client as ClientModel, ContactLensOrder as CLOModel, Order as OrderModel

    granularity, start_date, keys, labels = _get_range_definition(range)
    items_map: Dict[str, Dict[str, Any]] = {
        key: {
            "bucket": key,
            "label": labels[key],
            "appointments": 0,
            "new_clients": 0,
            "revenue": 0.0,
        }
        for key in keys
    }

    appointment_rows = (
        db.query(Appointment.date, func.count(Appointment.id))
        .join(Clinic, Appointment.clinic_id == Clinic.id)
        .filter(Clinic.company_id == company_id)
        .filter(Appointment.date >= start_date)
        .group_by(Appointment.date)
        .all()
    )
    for row_date, count in appointment_rows:
        if not row_date:
            continue
        key = _bucket_key(row_date, granularity)
        if key in items_map:
            items_map[key]["appointments"] += int(count or 0)

    client_rows = (
        db.query(ClientModel.file_creation_date, func.count(ClientModel.id))
        .join(Clinic, ClientModel.clinic_id == Clinic.id)
        .filter(Clinic.company_id == company_id)
        .filter(ClientModel.file_creation_date >= start_date)
        .group_by(ClientModel.file_creation_date)
        .all()
    )
    for row_date, count in client_rows:
        if not row_date:
            continue
        key = _bucket_key(row_date, granularity)
        if key in items_map:
            items_map[key]["new_clients"] += int(count or 0)

    revenue_by_bucket: Dict[str, float] = defaultdict(float)

    order_revenue_rows = (
        db.query(OrderModel.order_date, func.coalesce(func.sum(BillingModel.total_after_discount), 0))
        .join(BillingModel, BillingModel.order_id == OrderModel.id)
        .join(Clinic, OrderModel.clinic_id == Clinic.id)
        .filter(Clinic.company_id == company_id)
        .filter(OrderModel.order_date >= start_date)
        .group_by(OrderModel.order_date)
        .all()
    )
    for row_date, amount in order_revenue_rows:
        if not row_date:
            continue
        revenue_by_bucket[_bucket_key(row_date, granularity)] += float(amount or 0)

    clo_revenue_rows = (
        db.query(CLOModel.order_date, func.coalesce(func.sum(BillingModel.total_after_discount), 0))
        .join(BillingModel, BillingModel.contact_lens_id == CLOModel.id)
        .join(Clinic, CLOModel.clinic_id == Clinic.id)
        .filter(Clinic.company_id == company_id)
        .filter(CLOModel.order_date >= start_date)
        .group_by(CLOModel.order_date)
        .all()
    )
    for row_date, amount in clo_revenue_rows:
        if not row_date:
            continue
        revenue_by_bucket[_bucket_key(row_date, granularity)] += float(amount or 0)

    for key, amount in revenue_by_bucket.items():
        if key in items_map:
            items_map[key]["revenue"] = round(float(amount or 0), 2)

    return {"range": range, "items": [items_map[key] for key in keys]}

@router.get("/stats/users-clients-per-clinic/{company_id}")
def stats_users_clients_per_clinic(company_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    clinic_rows = (
        db.query(Clinic.id, Clinic.name)
        .filter(Clinic.company_id == company_id)
        .all()
    )
    clinic_id_to_name = {cid: cname for cid, cname in clinic_rows}

    user_counts = dict(
        db.query(UserModel.clinic_id, func.count(UserModel.id))
        .filter(UserModel.company_id == company_id)
        .group_by(UserModel.clinic_id)
        .all()
    )

    from models import Client as ClientModel
    client_counts = dict(
        db.query(ClientModel.clinic_id, func.count(ClientModel.id))
        .join(Clinic, ClientModel.clinic_id == Clinic.id)
        .filter(Clinic.company_id == company_id)
        .group_by(ClientModel.clinic_id)
        .all()
    )

    data = []
    for cid, cname in clinic_id_to_name.items():
        data.append({
            "clinic_id": cid,
            "clinic_name": cname or "",
            "users": int(user_counts.get(cid, 0) or 0),
            "clients": int(client_counts.get(cid, 0) or 0),
        })
    data.sort(key=lambda x: (x["users"] + x["clients"]), reverse=True)
    return {"items": data}

@router.get("/stats/appointments-month-per-clinic/{company_id}")
def stats_appointments_month_per_clinic(company_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)
    if now.month == 12:
        next_month_start = datetime(now.year + 1, 1, 1)
    else:
        next_month_start = datetime(now.year, now.month + 1, 1)

    rows = (
        db.query(Clinic.name.label("clinic_name"), func.count(Appointment.id).label("count"))
        .join(Appointment, Appointment.clinic_id == Clinic.id)
        .filter(Clinic.company_id == company_id)
        .filter(Appointment.date >= month_start)
        .filter(Appointment.date < next_month_start)
        .group_by(Clinic.name)
        .all()
    )
    items = [{"clinic_name": r.clinic_name or "", "count": int(r.count or 0)} for r in rows]
    items.sort(key=lambda x: x["count"], reverse=True)
    return {"items": items}

@router.get("/stats/new-clients-series/{company_id}")
def stats_new_clients_series(company_id: int, months: int = 12, db: Session = Depends(get_db)) -> Dict[str, Any]:
    from models import Client as ClientModel
    current_month = _month_start(datetime.utcnow().date())
    start_date = _shift_months(current_month, -(months - 1))
    end_date = _next_month(current_month)

    rows = (
        db.query(ClientModel.file_creation_date, func.count(ClientModel.id).label("count"))
        .join(Clinic, ClientModel.clinic_id == Clinic.id)
        .filter(Clinic.company_id == company_id)
        .filter(ClientModel.file_creation_date >= start_date)
        .filter(ClientModel.file_creation_date < end_date)
        .group_by(ClientModel.file_creation_date)
        .all()
    )
    month_to_count: Dict[str, int] = defaultdict(int)
    for row_date, count in rows:
        if not row_date:
            continue
        month_to_count[_month_start(row_date).strftime("%Y-%m")] += int(count or 0)

    series = []
    current = start_date
    for _ in range(max(1, months)):
        key = current.strftime("%Y-%m")
        series.append({"month": key, "count": int(month_to_count.get(key, 0))})
        current = _shift_months(current, 1)
    return {"items": series}

@router.get("/stats/aov/{company_id}")
def stats_average_order_value(company_id: int, months: int = 3, db: Session = Depends(get_db)) -> Dict[str, Any]:
    from models import Billing as BillingModel, Order as OrderModel, ContactLensOrder as CLOModel
    now = datetime.utcnow()
    start_year = now.year
    start_month = now.month - (months - 1)
    while start_month <= 0:
        start_month += 12
        start_year -= 1
    start_date = datetime(start_year, start_month, 1)

    orders_rows = (
        db.query(func.avg(BillingModel.total_after_discount))
        .join(OrderModel, BillingModel.order_id == OrderModel.id)
        .join(Clinic, OrderModel.clinic_id == Clinic.id)
        .filter(Clinic.company_id == company_id)
        .filter(OrderModel.order_date >= start_date)
        .all()
    )
    aov_orders = float(orders_rows[0][0] or 0) if orders_rows else 0.0

    clo_rows = (
        db.query(func.avg(BillingModel.total_after_discount))
        .join(CLOModel, BillingModel.contact_lens_id == CLOModel.id)
        .join(Clinic, CLOModel.clinic_id == Clinic.id)
        .filter(Clinic.company_id == company_id)
        .filter(CLOModel.order_date >= start_date)
        .all()
    )
    aov_clo = float(clo_rows[0][0] or 0) if clo_rows else 0.0

    aov = 0.0
    if aov_orders and aov_clo:
        aov = (aov_orders + aov_clo) / 2.0
    else:
        aov = aov_orders or aov_clo or 0.0
    return {"aov": round(aov, 2)}

@router.get("/stats/orders-by-type/{company_id}")
def stats_orders_by_type(company_id: int, months: int = 6, db: Session = Depends(get_db)) -> Dict[str, Any]:
    from models import Order as OrderModel
    now = datetime.utcnow()
    start_year = now.year
    start_month = now.month - (months - 1)
    while start_month <= 0:
        start_month += 12
        start_year -= 1
    start_date = datetime(start_year, start_month, 1)

    rows = (
        db.query(OrderModel.type, func.count(OrderModel.id))
        .join(Clinic, OrderModel.clinic_id == Clinic.id)
        .filter(Clinic.company_id == company_id)
        .filter(OrderModel.order_date >= start_date)
        .group_by(OrderModel.type)
        .all()
    )
    items = [{"type": t or "unknown", "count": int(c or 0)} for t, c in rows]
    return {"items": items}

@router.get("/stats/top-skus/{company_id}")
def stats_top_skus(company_id: int, months: int = 6, limit: int = 10, db: Session = Depends(get_db)) -> Dict[str, Any]:
    from models import Billing as BillingModel, OrderLineItem as OLIModel, Order as OrderModel, ContactLensOrder as CLOModel
    now = datetime.utcnow()
    start_year = now.year
    start_month = now.month - (months - 1)
    while start_month <= 0:
        start_month += 12
        start_year -= 1
    start_date = datetime(start_year, start_month, 1)

    sku_to_qty: Dict[str, float] = {}

    order_rows = (
        db.query(OLIModel.sku, func.coalesce(func.sum(OLIModel.quantity), 0))
        .join(BillingModel, OLIModel.billings_id == BillingModel.id)
        .join(OrderModel, BillingModel.order_id == OrderModel.id)
        .join(Clinic, OrderModel.clinic_id == Clinic.id)
        .filter(Clinic.company_id == company_id)
        .filter(OrderModel.order_date >= start_date)
        .group_by(OLIModel.sku)
        .all()
    )
    for sku, qty in order_rows:
        key = sku or "unknown"
        sku_to_qty[key] = float(sku_to_qty.get(key, 0)) + float(qty or 0)

    clo_rows = (
        db.query(OLIModel.sku, func.coalesce(func.sum(OLIModel.quantity), 0))
        .join(BillingModel, OLIModel.billings_id == BillingModel.id)
        .join(CLOModel, BillingModel.contact_lens_id == CLOModel.id)
        .join(Clinic, CLOModel.clinic_id == Clinic.id)
        .filter(Clinic.company_id == company_id)
        .filter(CLOModel.order_date >= start_date)
        .group_by(OLIModel.sku)
        .all()
    )
    for sku, qty in clo_rows:
        key = sku or "unknown"
        sku_to_qty[key] = float(sku_to_qty.get(key, 0)) + float(qty or 0)

    items = [{"sku": k, "quantity": v} for k, v in sku_to_qty.items()]
    items.sort(key=lambda x: x["quantity"], reverse=True)
    return {"items": items[: max(1, min(limit, 50))]}

@router.get("/users/{company_id}")
def get_users_page_data(
    company_id: int,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    clinics = _get_company_clinics(db, company_id)
    users = _get_company_users(db, company_id)
    return {
        "clinics": [ClinicSchema.model_validate(c).model_dump() for c in clinics],
        "users": [UserSchema.model_validate(u).model_dump() for u in users],
    }

@router.get("/clinics/{company_id}")
def get_clinics_page_data(
    company_id: int,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    clinics = _get_company_clinics(db, company_id)
    return {
        "clinics": [ClinicSchema.model_validate(c).model_dump() for c in clinics],
    }

