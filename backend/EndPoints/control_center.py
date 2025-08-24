from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Company, Clinic, User as UserModel, Appointment
from datetime import datetime
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

@router.get("/dashboard/{company_id}")
def get_dashboard_data(
    company_id: int,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:

    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)
    if now.month == 12:
        next_month_start = datetime(now.year + 1, 1, 1)
    else:
        next_month_start = datetime(now.year, now.month + 1, 1)

    total_clinics = db.query(func.count(Clinic.id)).filter(Clinic.company_id == company_id).scalar() or 0
    active_clinics_count = db.query(func.count(Clinic.id)).filter(Clinic.company_id == company_id, Clinic.is_active.is_(True)).scalar() or 0
    total_users = db.query(func.count(UserModel.id)).filter(UserModel.company_id == company_id).scalar() or 0

    total_appointments_this_month = db.query(func.count(Appointment.id)) \
        .join(Clinic, Appointment.clinic_id == Clinic.id) \
        .filter(Clinic.company_id == company_id) \
        .filter(Appointment.date >= month_start) \
        .filter(Appointment.date < next_month_start) \
        .scalar() or 0

    return {
        "stats": {
            "totalClinics": int(total_clinics),
            "activeClinics": int(active_clinics_count),
            "totalUsers": int(total_users),
            "totalAppointments": int(total_appointments_this_month),
            "monthlyRevenue": 0,
        },
    }

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
    now = datetime.utcnow()
    year = now.year
    month = now.month
    start_year = year
    start_month = month - (months - 1)
    while start_month <= 0:
        start_month += 12
        start_year -= 1
    start_date = datetime(start_year, start_month, 1)
    if now.month == 12:
        end_date = datetime(now.year + 1, 1, 1)
    else:
        end_date = datetime(now.year, now.month + 1, 1)

    rows = (
        db.query(func.to_char(func.date_trunc('month', ClientModel.file_creation_date), 'YYYY-MM').label('month'),
                 func.count(ClientModel.id).label('count'))
        .join(Clinic, ClientModel.clinic_id == Clinic.id)
        .filter(Clinic.company_id == company_id)
        .filter(ClientModel.file_creation_date >= start_date)
        .filter(ClientModel.file_creation_date < end_date)
        .group_by(func.date_trunc('month', ClientModel.file_creation_date))
        .order_by(func.date_trunc('month', ClientModel.file_creation_date))
        .all()
    )
    month_to_count = {r.month: int(r.count or 0) for r in rows}
    series = []
    cur_y, cur_m = start_year, start_month
    for _ in range(months):
        key = f"{cur_y}-{str(cur_m).zfill(2)}"
        series.append({"month": key, "count": int(month_to_count.get(key, 0))})
        cur_m += 1
        if cur_m == 13:
            cur_m = 1
            cur_y += 1
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


