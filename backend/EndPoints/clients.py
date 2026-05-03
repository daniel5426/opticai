from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import Client, Family, Clinic, User, OpticalExam, Appointment, Order, Referral, File, MedicalLog, ContactLensOrder, ExamLayoutInstance
from schemas import ClientCreate, ClientUpdate, Client as ClientSchema, ClientOrdersContext
from sqlalchemy import and_, func, or_
from auth import get_current_user
from utils.storage import upload_base64_image
from security.scope import (
    assert_company_scope,
    assert_clinic_scope,
    get_allowed_clinic_ids,
    get_scoped_client,
    normalize_clinic_id_for_company,
    resolve_company_id,
)


CEO_LEVEL = 4

router = APIRouter(prefix="/clients", tags=["clients"])

@router.get("/paginated")
def get_clients_paginated(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    limit: int = Query(25, ge=1, le=100, description="Max items to return"),
    offset: int = Query(0, ge=0, description="Items to skip"),
    order: Optional[str] = Query("id_desc", description="Sort order: id_desc|id_asc"),
    search: Optional[str] = Query(None, description="Search by name/phone/email"),
    gender: Optional[str] = Query(None, description="Filter by gender"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    base = db.query(
        Client.id,
        Client.clinic_id,
        Client.first_name,
        Client.last_name,
        Client.gender,
        Client.national_id,
        Client.phone_mobile,
        Client.email,
        Client.family_id,
        Client.family_role,
    )
    allowed_clinic_ids = get_allowed_clinic_ids(db, current_user, clinic_id)
    base = base.filter(Client.clinic_id.in_(allowed_clinic_ids))
    if gender and gender != "all":
        base = base.filter(Client.gender == gender)

    # Apply search filtering server-side to avoid fetching entire tables
    if search:
        search = search.strip()
        if search:
            like = f"%{search}%"
            base = base.filter(
                or_(
                    Client.first_name.ilike(like),
                    Client.last_name.ilike(like),
                    func.concat(Client.first_name, ' ', Client.last_name).ilike(like),
                    Client.phone_mobile.ilike(like),
                    Client.email.ilike(like),
                )
            )

    total = base.count()

    order_columns = {
        "id": Client.id,
        "first_name": Client.first_name,
        "last_name": Client.last_name,
        "gender": Client.gender,
        "national_id": Client.national_id,
        "phone_mobile": Client.phone_mobile,
        "email": Client.email,
        "family_role": Client.family_role,
    }
    order_key, _, order_direction = (order or "id_desc").rpartition("_")
    order_column = order_columns.get(order_key, Client.id)
    if order_direction == "asc":
        base = base.order_by(order_column.asc().nulls_last(), Client.id.asc())
    else:
        base = base.order_by(order_column.desc().nulls_last(), Client.id.desc())

    rows = base.offset(offset).limit(limit).all()
    items = [
        {
            "id": r[0],
            "clinic_id": r[1],
            "first_name": r[2],
            "last_name": r[3],
            "gender": r[4],
            "national_id": r[5],
            "phone_mobile": r[6],
            "email": r[7],
            "family_id": r[8],
            "family_role": r[9],
        }
        for r in rows
    ]
    return { "items": items, "total": total }

@router.post("/", response_model=ClientSchema)
def create_client(
    client: ClientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    payload = client.dict()
    company_id = resolve_company_id(db, current_user)
    payload["company_id"] = company_id
    payload["clinic_id"] = normalize_clinic_id_for_company(db, current_user, payload.get("clinic_id"))
    if payload.get('profile_picture'):
        try:
            payload['profile_picture'] = upload_base64_image(payload['profile_picture'], f"clients/{payload.get('clinic_id') or 'no-clinic'}/{payload.get('id') or 'new'}/profile")
        except Exception:
            pass
    db_client = Client(**payload)
    db.add(db_client)
    db.commit()
    db.refresh(db_client)
    return db_client

@router.get("/{client_id}", response_model=ClientSchema)
def get_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    assert_clinic_scope(db, current_user, client.clinic_id)
    return client

def _has_value(value):
    return value is not None and value != ""

def _to_number_value(value):
    if not _has_value(value):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None

def _collect_addition_add_sources(exam_data):
    sources = {}
    if not isinstance(exam_data, dict):
        return sources

    for key, value in exam_data.items():
        if key != "addition" and not key.startswith("addition-"):
            continue
        if not isinstance(value, dict):
            continue
        for add_type in ("read", "int", "bif", "mul"):
            r_value = _to_number_value(value.get(f"r_{add_type}"))
            l_value = _to_number_value(value.get(f"l_{add_type}"))
            if r_value is None and l_value is None:
                continue
            current = sources.get(add_type, {})
            if r_value is not None:
                current["r_ad"] = r_value
            if l_value is not None:
                current["l_ad"] = l_value
            sources[add_type] = current
    return sources

@router.get("/{client_id}/orders-context", response_model=ClientOrdersContext)
def get_client_orders_context(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    client = get_scoped_client(db, current_user, client_id)

    latest_exam = (
        db.query(OpticalExam)
        .filter(OpticalExam.client_id == client_id)
        .order_by(OpticalExam.exam_date.desc().nulls_last(), OpticalExam.id.desc())
        .first()
    )
    latest_regular_order = (
        db.query(Order.id)
        .filter(Order.client_id == client_id)
        .order_by(Order.order_date.desc().nulls_last(), Order.id.desc())
        .first()
    )
    latest_contact_order = (
        db.query(ContactLensOrder.id)
        .filter(ContactLensOrder.client_id == client_id)
        .order_by(ContactLensOrder.order_date.desc().nulls_last(), ContactLensOrder.id.desc())
        .first()
    )

    latest_exam_add_sources = {}
    if latest_exam:
        instances = (
            db.query(ExamLayoutInstance.exam_data)
            .filter(ExamLayoutInstance.exam_id == latest_exam.id)
            .order_by(ExamLayoutInstance.order.asc().nulls_last(), ExamLayoutInstance.id.asc())
            .all()
        )
        for (exam_data,) in instances:
            instance_sources = _collect_addition_add_sources(exam_data or {})
            for add_type, source in instance_sources.items():
                latest_exam_add_sources[add_type] = {
                    **latest_exam_add_sources.get(add_type, {}),
                    **source,
                }

    return {
        "latest_exam_id": latest_exam.id if latest_exam else None,
        "latest_regular_order_id": latest_regular_order[0] if latest_regular_order else None,
        "latest_contact_order_id": latest_contact_order[0] if latest_contact_order else None,
        "latest_exam_add_sources": latest_exam_add_sources,
    }

@router.get("/", response_model=List[ClientSchema])
def get_all_clients(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    allowed_clinic_ids = get_allowed_clinic_ids(db, current_user, clinic_id)
    query = db.query(Client).filter(Client.clinic_id.in_(allowed_clinic_ids))
    return query.all()


@router.put("/{client_id}", response_model=ClientSchema)
def update_client(
    client_id: int,
    client: ClientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_client = get_scoped_client(db, current_user, client_id)
    
    update_fields = client.dict(exclude_unset=True)
    update_fields.pop("company_id", None)
    if "clinic_id" in update_fields:
        update_fields["clinic_id"] = normalize_clinic_id_for_company(db, current_user, update_fields["clinic_id"])
    if update_fields.get('profile_picture'):
        try:
            update_fields['profile_picture'] = upload_base64_image(update_fields['profile_picture'], f"clients/{db_client.clinic_id or 'no-clinic'}/{client_id}/profile")
        except Exception:
            pass
    for field, value in update_fields.items():
        setattr(db_client, field, value)
    
    db.commit()
    db.refresh(db_client)
    return db_client

@router.delete("/{client_id}")
def delete_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    client = get_scoped_client(db, current_user, client_id)
    
    db.delete(client)
    db.commit()
    return {"message": "Client deleted successfully"}

@router.get("/{client_id}/family-members", response_model=List[ClientSchema])
def get_family_members(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    client = get_scoped_client(db, current_user, client_id)
    
    if not client.family_id:
        return []
    
    return db.query(Client).filter(Client.family_id == client.family_id).all()

@router.put("/{client_id}/update-date")
def update_client_updated_date(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from sqlalchemy.sql import func
    client = get_scoped_client(db, current_user, client_id)
    
    client.client_updated_date = func.now()
    db.commit()
    return {"message": "Client updated date updated successfully"}

@router.put("/{client_id}/ai-states")
def update_client_ai_states(
    client_id: int, 
    ai_states: dict, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    client = get_scoped_client(db, current_user, client_id)
    
    mapping = {
        "exam": "ai_exam_state",
        "order": "ai_order_state",
        "referral": "ai_referral_state",
        "contact_lens": "ai_contact_lens_state",
        "appointment": "ai_appointment_state",
        "file": "ai_file_state",
        "medical": "ai_medical_state",
    }

    for key, value in ai_states.items():
        field_name = mapping.get(key, key)
        if hasattr(client, field_name):
            setattr(client, field_name, value)
    client.ai_updated_date = func.now()
    
    db.commit()
    return {"message": "AI states updated successfully"}

@router.put("/{client_id}/ai-part-state")
def update_client_ai_part_state(
    client_id: int, 
    part: str, 
    ai_part_state: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    client = get_scoped_client(db, current_user, client_id)
    
    field_name = f"ai_{part}_state"
    if hasattr(client, field_name):
        setattr(client, field_name, ai_part_state)
        client.ai_updated_date = func.now()
        db.commit()
        return {"message": f"AI {part} state updated successfully"}
    else:
        raise HTTPException(status_code=400, detail=f"Invalid part: {part}")

@router.get("/{client_id}/all-data-for-ai")
def get_all_client_data_for_ai(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    company_id = resolve_company_id(db, current_user)
    assert_clinic_belongs_to_company(db, client.clinic_id, company_id)
    
    exams = db.query(OpticalExam).filter(OpticalExam.client_id == client_id).all()
    appointments = db.query(Appointment).filter(Appointment.client_id == client_id).all()
    orders = db.query(Order).filter(Order.client_id == client_id).all()
    referrals = db.query(Referral).filter(Referral.client_id == client_id).all()
    files = db.query(File).filter(File.client_id == client_id).all()
    medical_logs = db.query(MedicalLog).filter(MedicalLog.client_id == client_id).order_by(MedicalLog.id.desc()).all()
    contact_lenses = []

    try:
        print(
            f"[AI DEBUG] all-data-for-ai client_id={client_id} "
            f"exams={len(exams)} appointments={len(appointments)} orders={len(orders)} "
            f"referrals={len(referrals)} files={len(files)} medical_logs={len(medical_logs)} contact_lenses={len(contact_lenses)}"
        )
        if medical_logs:
            print("[AI DEBUG] medical_log_ids:", [ml.id for ml in medical_logs])
    except Exception:
        pass

    return {
        "client": client,
        "family": client.family,
        "exams": exams,
        "appointments": appointments,
        "orders": orders,
        "referrals": referrals,
        "files": files,
        "medical_logs": medical_logs,
        "contact_lenses": contact_lenses,
    }

@router.get("/stats/company/{company_id}")
def get_company_new_clients_stats(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role_level < CEO_LEVEL:
        raise HTTPException(status_code=403, detail="Access denied")
    assert_company_scope(current_user, company_id)
    month_expr = func.date_trunc('month', Client.file_creation_date)
    month_str = func.to_char(month_expr, 'YYYY-MM')
    rows = (
        db.query(month_str.label('month'), func.count(Client.id).label('count'))
        .join(Clinic, Clinic.id == Client.clinic_id)
        .filter(Clinic.company_id == company_id)
        .group_by(month_expr)
        .order_by(month_expr)
        .all()
    )
    return [{"month": r.month, "count": int(r.count)} for r in rows]
