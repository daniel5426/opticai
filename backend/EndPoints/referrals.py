from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import Referral, Client, User, ReferralEye, Clinic
from sqlalchemy import func
from schemas import ReferralCreate, ReferralUpdate, Referral as ReferralSchema
from auth import get_current_user
from utils.table_search import build_all_terms_search_condition, search_blob, spaced_concat
from security.scope import (
    apply_clinic_user_scope,
    get_allowed_clinic_ids,
    get_scoped_client,
    get_scoped_referral,
)

router = APIRouter(prefix="/referrals", tags=["referrals"])

@router.get("/paginated")
def get_referrals_paginated(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    limit: int = Query(25, ge=1, le=100, description="Max items to return"),
    offset: int = Query(0, ge=0, description="Items to skip"),
    order: Optional[str] = Query("date_desc", description="Sort order: date_desc|date_asc|id_desc|id_asc"),
    search: Optional[str] = Query(None, description="Search by type/recipient/urgency_level/client name"),
    urgency_level: Optional[str] = Query(None, description="Filter by urgency level"),
    referral_type: Optional[str] = Query(None, alias="type", description="Filter by referral type"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    base = (
        db.query(
            Referral,
            spaced_concat(Client.first_name, Client.last_name).label('client_full_name'),
            func.coalesce(User.full_name, User.username).label('examiner_name')
        )
        .outerjoin(Client, Client.id == Referral.client_id)
        .outerjoin(User, User.id == Referral.user_id)
    )
    allowed_clinic_ids = get_allowed_clinic_ids(db, current_user, clinic_id)
    base = base.filter(Referral.clinic_id.in_(allowed_clinic_ids))
    if urgency_level and urgency_level != "all":
        base = base.filter(Referral.urgency_level == urgency_level)
    if referral_type and referral_type != "all":
        base = base.filter(Referral.type == referral_type)
    search_condition = build_all_terms_search_condition(
        search,
        text_expressions=[
            search_blob(Referral.type, Referral.recipient, Referral.urgency_level),
            search_blob(Client.first_name, Client.last_name, Client.national_id, Client.phone_mobile, Client.email),
            search_blob(User.full_name, User.username, User.email, User.phone),
        ],
        date_columns=[Referral.date],
    )
    if search_condition is not None:
        base = base.filter(search_condition)
    order_columns = {
        "date": Referral.date,
        "id": Referral.id,
        "type": Referral.type,
        "client": spaced_concat(Client.first_name, Client.last_name),
        "urgency": Referral.urgency_level,
        "recipient": Referral.recipient,
    }
    order_key, _, order_direction = (order or "date_desc").rpartition("_")
    order_column = order_columns.get(order_key, Referral.date)
    if order_direction == "asc":
        base = base.order_by(order_column.asc().nulls_last(), Referral.id.asc())
    else:
        base = base.order_by(order_column.desc().nulls_last(), Referral.id.desc())
    total = base.count()
    rows = base.offset(offset).limit(limit).all()
    items = []
    for row in rows:
        ref = row[0]
        setattr(ref, 'client_full_name', row[1])
        setattr(ref, 'examiner_name', row[2])
        items.append(ref)
    return {"items": items, "total": total}

@router.post("/", response_model=ReferralSchema)
def create_referral(
    referral: ReferralCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payload = apply_clinic_user_scope(db, current_user, referral.dict())
    db_referral = Referral(**payload)
    db.add(db_referral)
    db.commit()
    db.refresh(db_referral)
    # bump client_updated_date
    try:
        if db_referral.client_id:
            client = db.query(Client).filter(Client.id == db_referral.client_id).first()
            if client:
                client.client_updated_date = func.now()
                db.commit()
    except Exception:
        pass
    return db_referral

@router.get("/{referral_id}", response_model=ReferralSchema)
def get_referral(
    referral_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_scoped_referral(db, current_user, referral_id)

@router.get("/", response_model=List[ReferralSchema])
def get_all_referrals(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    allowed_clinic_ids = get_allowed_clinic_ids(db, current_user, clinic_id)
    query = db.query(Referral).filter(Referral.clinic_id.in_(allowed_clinic_ids))
    return query.all()

@router.get("/client/{client_id}", response_model=List[ReferralSchema])
def get_referrals_by_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_scoped_client(db, current_user, client_id)
    referrals = (
        db.query(Referral)
        .filter(Referral.client_id == client_id)
        .order_by(Referral.date.desc().nulls_last(), Referral.id.desc())
        .all()
    )
    return referrals

@router.put("/{referral_id}", response_model=ReferralSchema)
def update_referral(
    referral_id: int,
    referral: ReferralUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_referral = get_scoped_referral(db, current_user, referral_id)
    update_fields = referral.dict(exclude_unset=True)
    if update_fields:
        candidate = {
            "client_id": db_referral.client_id,
            "clinic_id": db_referral.clinic_id,
            "user_id": db_referral.user_id,
        }
        candidate.update({k: update_fields[k] for k in candidate.keys() & update_fields.keys()})
        scoped = apply_clinic_user_scope(db, current_user, candidate)
        for key in ("client_id", "clinic_id", "user_id"):
            if key in update_fields:
                update_fields[key] = scoped[key]
    for field, value in update_fields.items():
        setattr(db_referral, field, value)
    
    db.commit()
    # bump client_updated_date
    try:
        if db_referral.client_id:
            client = db.query(Client).filter(Client.id == db_referral.client_id).first()
            if client:
                client.client_updated_date = func.now()
                db.commit()
    except Exception:
        pass
    db.refresh(db_referral)
    return db_referral

@router.delete("/{referral_id}")
def delete_referral(
    referral_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    referral = get_scoped_referral(db, current_user, referral_id)
    client_id = referral.client_id
    db.delete(referral)
    db.commit()
    # bump client_updated_date
    try:
        if client_id:
            client = db.query(Client).filter(Client.id == client_id).first()
            if client:
                client.client_updated_date = func.now()
                db.commit()
    except Exception:
        pass
    return {"message": "Referral deleted successfully"}

# Referral unified data endpoints
@router.get("/{referral_id}/data")
def get_referral_data(
    referral_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    referral = get_scoped_referral(db, current_user, referral_id)
    return referral.referral_data or {}

@router.post("/{referral_id}/data")
async def save_referral_data(
    referral_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    referral = get_scoped_referral(db, current_user, referral_id)
    try:
        data = await request.json()
        if not isinstance(data, dict):
            raise ValueError("Body must be a JSON object")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid JSON: {str(e)}")
    referral.referral_data = data
    db.commit()
    # bump client_updated_date
    try:
        if referral.client_id:
            client = db.query(Client).filter(Client.id == referral.client_id).first()
            if client:
                client.client_updated_date = func.now()
                db.commit()
    except Exception:
        pass
    db.refresh(referral)
    return {"success": True}

@router.get("/{referral_id}/data/component/{component_type}")
def get_referral_component_data(
    referral_id: int,
    component_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    referral = get_scoped_referral(db, current_user, referral_id)
    data = referral.referral_data or {}
    return data.get(component_type)

@router.post("/{referral_id}/data/component/{component_type}")
async def save_referral_component_data(
    referral_id: int,
    component_type: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    referral = get_scoped_referral(db, current_user, referral_id)
    try:
        component_data = await request.json()
        if not isinstance(component_data, dict):
            raise ValueError("Body must be a JSON object")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid JSON: {str(e)}")
    data = referral.referral_data or {}
    data[component_type] = component_data
    referral.referral_data = data
    db.commit()
    # bump client_updated_date
    try:
        if referral.client_id:
            client = db.query(Client).filter(Client.id == referral.client_id).first()
            if client:
                client.client_updated_date = func.now()
                db.commit()
    except Exception:
        pass
    db.refresh(referral)
    return {"success": True}

@router.get("/{referral_id}/eyes", response_model=List[dict])
def get_referral_eyes(
    referral_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_scoped_referral(db, current_user, referral_id)
    referral_eyes = db.query(ReferralEye).filter(ReferralEye.referral_id == referral_id).all()
    return [
        {
            "id": eye.id,
            "eye": eye.eye,
            "sph": eye.sph,
            "cyl": eye.cyl,
            "ax": eye.ax,
            "pris": eye.pris,
            "base": eye.base,
            "va": eye.va,
            "add_power": eye.add_power,
            "decent": eye.decent,
            "s_base": eye.s_base,
            "high": eye.high,
            "pd": eye.pd
        }
        for eye in referral_eyes
    ] 
