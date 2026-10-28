from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert
from typing import List, Optional
from datetime import datetime, timezone
from database import get_db
from models import Client, Family, Clinic, User, OpticalExam, Appointment, Order, Referral, File, MedicalLog, ContactLensOrder, ExamLayoutInstance, CampaignClientExecution, RecentClientVisit, PrescriptionSearchIndex
from schemas import ClientCreate, ClientUpdate, Client as ClientSchema, ClientOrdersContext, ClientMergeRequest, ClientMergeResult
from sqlalchemy import and_, func, or_
from auth import get_current_user
from utils.column_filters import ColumnFilter, build_column_filter_conditions
from utils.table_search import build_all_terms_search_condition, search_blob
from utils.storage import upload_base64_image
from security.scope import (
    assert_company_scope,
    assert_clinic_scope,
    get_allowed_clinic_ids,
    get_scoped_client,
    normalize_clinic_id_for_company,
    resolve_company_id,
)
from services.trash_service import move_to_trash


CEO_LEVEL = 4

router = APIRouter(prefix="/clients", tags=["clients"])


# Imports store English codes while the app writes Hebrew; match every spelling of a gender.
GENDER_SYNONYMS = {
    "זכר": ("זכר", "male", "m"),
    "נקבה": ("נקבה", "female", "f"),
    "אחר": ("אחר", "other"),
}


def gender_condition(value: str):
    synonyms = GENDER_SYNONYMS.get(value.strip(), (value.strip(),))
    return func.lower(func.trim(Client.gender)).in_([synonym.lower() for synonym in synonyms])

@router.get("/paginated")
def get_clients_paginated(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    all_clinics: bool = Query(False, description="Every clinic the user may access, ignoring clinic_id"),
    limit: int = Query(25, ge=1, le=100, description="Max items to return"),
    offset: int = Query(0, ge=0, description="Items to skip"),
    order: Optional[str] = Query("id_desc", description="Sort order: id_desc|id_asc"),
    search: Optional[str] = Query(None, description="Search by name/phone/email"),
    gender: Optional[str] = Query(None, description="Filter by gender"),
    filters: Optional[str] = Query(None, description="JSON column filters: id|first_name|last_name|gender|national_id|phone_mobile|email|family_role"),
    include_total: bool = Query(True, description="Include the exact total count"),
    count_only: bool = Query(False, description="Return only the exact total count"),
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
    allowed_clinic_ids = get_allowed_clinic_ids(db, current_user, None if all_clinics else clinic_id)
    base = base.filter(Client.clinic_id.in_(allowed_clinic_ids))
    base = base.filter(Client.merged_into_client_id.is_(None))
    if gender and gender != "all":
        base = base.filter(gender_condition(gender))

    search_condition = build_all_terms_search_condition(
        search,
        text_expressions=[
            search_blob(
                Client.first_name,
                Client.last_name,
                Client.national_id,
                Client.phone_mobile,
                Client.email,
            ),
        ],
        date_columns=[
            Client.date_of_birth,
            Client.file_creation_date,
            Client.membership_end,
            Client.service_end,
        ],
    )
    if search_condition is not None:
        base = base.filter(search_condition)
    base = base.filter(*build_column_filter_conditions(filters, {
        "id": ColumnFilter(Client.id),
        "first_name": ColumnFilter(Client.first_name),
        "last_name": ColumnFilter(Client.last_name),
        "gender": ColumnFilter(None, "options", option_condition=gender_condition),
        "national_id": ColumnFilter(Client.national_id),
        "phone_mobile": ColumnFilter(Client.phone_mobile),
        "email": ColumnFilter(Client.email),
        "family_role": ColumnFilter(Client.family_role),
    }))

    total = base.count() if include_total or count_only else None
    if count_only:
        return {"items": [], "total": total or 0, "has_more": False}

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

    rows = base.offset(offset).limit(limit + 1).all()
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
        for r in rows[:limit]
    ]
    return { "items": items, "total": total, "has_more": len(rows) > limit }

@router.get("/last-exam-dates")
def get_clients_last_exam_dates(
    ids: List[int] = Query(..., max_length=100, description="Client ids, e.g. one list page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Latest exam date per client, for list views; clients outside the user's scope or without exams are omitted."""
    allowed_clinic_ids = get_allowed_clinic_ids(db, current_user)
    rows = (
        db.query(OpticalExam.client_id, func.max(OpticalExam.exam_date))
        .join(Client, Client.id == OpticalExam.client_id)
        .filter(OpticalExam.client_id.in_(ids), Client.clinic_id.in_(allowed_clinic_ids))
        .group_by(OpticalExam.client_id)
        .all()
    )
    return {str(client_id): last_exam_date for client_id, last_exam_date in rows if last_exam_date}


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

@router.get("/recent")
def get_recent_clients(
    clinic_id: Optional[int] = Query(None),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    allowed_clinic_ids = get_allowed_clinic_ids(db, current_user, clinic_id)
    if not allowed_clinic_ids:
        return []
    rows = (
        db.query(RecentClientVisit, Client)
        .join(Client, Client.id == RecentClientVisit.client_id)
        .filter(RecentClientVisit.user_id == current_user.id)
        .filter(RecentClientVisit.clinic_id.in_(allowed_clinic_ids))
        .filter(Client.merged_into_client_id.is_(None))
        .order_by(RecentClientVisit.visited_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": visit.id,
            "user_id": visit.user_id,
            "clinic_id": visit.clinic_id,
            "client_id": visit.client_id,
            "visited_at": visit.visited_at,
            "client": client,
        }
        for visit, client in rows
    ]

def _client_snapshot(client: Client) -> dict:
    return jsonable_encoder({
        column.name: getattr(client, column.name)
        for column in Client.__table__.columns
        if column.name != "merge_snapshot"
    })

@router.post("/merge", response_model=ClientMergeResult)
def merge_clients(
    request: ClientMergeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    duplicate_ids = list(dict.fromkeys(request.duplicate_client_ids))
    if request.canonical_client_id in duplicate_ids:
        duplicate_ids.remove(request.canonical_client_id)
    if not duplicate_ids:
        raise HTTPException(status_code=422, detail="At least one duplicate client is required")

    all_ids = [request.canonical_client_id, *duplicate_ids]
    clients = (
        db.query(Client)
        .filter(Client.id.in_(all_ids))
        .with_for_update()
        .all()
    )
    by_id = {client.id: client for client in clients}
    if len(by_id) != len(all_ids):
        raise HTTPException(status_code=404, detail="One or more clients were not found")

    canonical = by_id[request.canonical_client_id]
    get_scoped_client(db, current_user, canonical.id)
    if canonical.merged_into_client_id:
        raise HTTPException(status_code=422, detail="Canonical client is already merged")

    company_id = canonical.company_id
    for duplicate_id in duplicate_ids:
        duplicate = by_id[duplicate_id]
        get_scoped_client(db, current_user, duplicate.id)
        if duplicate.company_id != company_id:
            raise HTTPException(status_code=422, detail="Clients must belong to the same company")
        if duplicate.merged_into_client_id:
            raise HTTPException(status_code=422, detail="One or more duplicate clients are already merged")

    # This path uses bulk SQL, so preflight protected groups explicitly rather
    # than relying on the ORM legacy-write guard.
    from models import OrderGroup, OrderGroupEntry
    grouped = db.query(OrderGroup).outerjoin(OrderGroupEntry).outerjoin(Order, OrderGroupEntry.order_id == Order.id).outerjoin(ContactLensOrder, OrderGroupEntry.contact_lens_id == ContactLensOrder.id).filter(
        or_(Order.client_id.in_(all_ids), ContactLensOrder.client_id.in_(all_ids), OrderGroup.payer_client_id.in_(all_ids))).distinct().with_for_update().all()
    if any(group.legacy_write_protected for group in grouped):
        raise HTTPException(409, {"code": "order_group_requires_update", "message": "Shared order groups cannot be reassigned by a legacy client merge."})
    if any(group.clinic_id != canonical.clinic_id for group in grouped):
        raise HTTPException(422, "Clients with orders must be merged within the same clinic")
    for group in grouped:
        if group.payer_client_id in duplicate_ids:
            group.payer_client_id = canonical.id
        group.revision += 1

    reassigned_counts = {}
    for model in (OpticalExam, Appointment, Order, ContactLensOrder, Referral, File, MedicalLog, CampaignClientExecution, PrescriptionSearchIndex):
        count = (
            db.query(model)
            .filter(model.client_id.in_(duplicate_ids))
            .update({"client_id": canonical.id}, synchronize_session=False)
        )
        reassigned_counts[model.__tablename__] = count

    db.query(RecentClientVisit).filter(RecentClientVisit.client_id.in_(duplicate_ids)).delete(synchronize_session=False)

    now = datetime.now(timezone.utc)
    for duplicate_id in duplicate_ids:
        duplicate = by_id[duplicate_id]
        duplicate.merged_into_client_id = canonical.id
        duplicate.merged_at = now
        duplicate.merged_by_user_id = current_user.id
        duplicate.merge_snapshot = _client_snapshot(duplicate)

    canonical.client_updated_date = func.now()
    db.commit()
    return {
        "canonical_client_id": canonical.id,
        "merged_client_ids": duplicate_ids,
        "reassigned_counts": reassigned_counts,
    }

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

@router.get("/{client_id}/exam-dates")
def get_client_exam_dates(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """First and last exam date of a client (glasses and contact-lens exams), computed live."""
    get_scoped_client(db, current_user, client_id)
    first_exam_date, last_exam_date = (
        db.query(func.min(OpticalExam.exam_date), func.max(OpticalExam.exam_date))
        .filter(OpticalExam.client_id == client_id)
        .one()
    )
    return {"first_exam_date": first_exam_date, "last_exam_date": last_exam_date}


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
    query = db.query(Client).filter(Client.clinic_id.in_(allowed_clinic_ids)).filter(Client.merged_into_client_id.is_(None))
    return query.all()

@router.post("/{client_id}/recent-visit")
def mark_recent_client_visit(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = get_scoped_client(db, current_user, client_id)
    if client.merged_into_client_id:
        raise HTTPException(status_code=422, detail="Cannot mark merged client as recent")

    stmt = (
        pg_insert(RecentClientVisit)
        .values(
            user_id=current_user.id,
            clinic_id=client.clinic_id,
            client_id=client.id,
            visited_at=func.now(),
        )
        .on_conflict_do_update(
            index_elements=["user_id", "clinic_id", "client_id"],
            set_={"visited_at": func.now()},
        )
        .returning(RecentClientVisit.id, RecentClientVisit.visited_at)
    )
    visit = db.execute(stmt).mappings().one()
    db.commit()
    return {"success": True, "visited_at": visit["visited_at"]}


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
    get_scoped_client(db, current_user, client_id)
    item = move_to_trash(db, current_user, "client", client_id)
    return {"message": "Client deleted successfully", "trash_item_id": item.id, "expires_at": item.expires_at, "side_effects": "backend"}

@router.get("/{client_id}/family-members", response_model=List[ClientSchema])
def get_family_members(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    client = get_scoped_client(db, current_user, client_id)
    
    if not client.family_id:
        return []
    
    return db.query(Client).filter(Client.family_id == client.family_id).filter(Client.merged_into_client_id.is_(None)).all()

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

    try:
        print(
            f"[AI DEBUG] all-data-for-ai client_id={client_id} "
            f"exams={len(exams)} appointments={len(appointments)} orders={len(orders)} "
            f"referrals={len(referrals)} files={len(files)} medical_logs={len(medical_logs)}"
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
