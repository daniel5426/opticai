from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import Referral, Client, User, ReferralEye
from sqlalchemy import func
from schemas import ReferralCreate, ReferralUpdate, Referral as ReferralSchema
from auth import get_current_user
from security.scope import resolve_clinic_id

router = APIRouter(prefix="/referrals", tags=["referrals"])

@router.get("/paginated")
def get_referrals_paginated(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    limit: int = Query(25, ge=1, le=100, description="Max items to return"),
    offset: int = Query(0, ge=0, description="Items to skip"),
    order: Optional[str] = Query("date_desc", description="Sort order: date_desc|date_asc|id_desc|id_asc"),
    search: Optional[str] = Query(None, description="Search by type/recipient/urgency_level/client name"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from sqlalchemy import or_, func, String
    base = (
        db.query(
            Referral,
            func.concat(Client.first_name, ' ', Client.last_name).label('client_full_name'),
            func.coalesce(User.full_name, User.username).label('examiner_name')
        )
        .outerjoin(Client, Client.id == Referral.client_id)
        .outerjoin(User, User.id == Referral.user_id)
    )
    target_clinic = resolve_clinic_id(db, current_user, clinic_id, require_for_ceo=True)
    base = base.filter(Referral.clinic_id == target_clinic)
    if search:
        like = f"%{search.strip()}%"
        base = base.filter(
            or_(
                Referral.type.ilike(like),
                Referral.recipient.ilike(like),
                Referral.urgency_level.ilike(like),
                func.concat(Client.first_name, ' ', Client.last_name).ilike(like)
            )
        )
    if order == "date_desc":
        base = base.order_by(Referral.date.desc().nulls_last())
    elif order == "date_asc":
        base = base.order_by(Referral.date.asc().nulls_last())
    elif order == "id_asc":
        base = base.order_by(Referral.id.asc())
    else:
        base = base.order_by(Referral.id.desc())
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
def create_referral(referral: ReferralCreate, db: Session = Depends(get_db)):
    db_referral = Referral(**referral.dict())
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
def get_referral(referral_id: int, db: Session = Depends(get_db)):
    referral = db.query(Referral).filter(Referral.id == referral_id).first()
    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found")
    return referral

@router.get("/", response_model=List[ReferralSchema])
def get_all_referrals(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_clinic = resolve_clinic_id(db, current_user, clinic_id, require_for_ceo=True)
    return db.query(Referral).filter(Referral.clinic_id == target_clinic).all()

@router.get("/client/{client_id}", response_model=List[ReferralSchema])
def get_referrals_by_client(client_id: int, db: Session = Depends(get_db)):
    referrals = db.query(Referral).filter(Referral.client_id == client_id).all()
    return referrals

@router.put("/{referral_id}", response_model=ReferralSchema)
def update_referral(referral_id: int, referral: ReferralUpdate, db: Session = Depends(get_db)):
    db_referral = db.query(Referral).filter(Referral.id == referral_id).first()
    if not db_referral:
        raise HTTPException(status_code=404, detail="Referral not found")
    
    for field, value in referral.dict(exclude_unset=True).items():
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
def delete_referral(referral_id: int, db: Session = Depends(get_db)):
    referral = db.query(Referral).filter(Referral.id == referral_id).first()
    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found")
    
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
def get_referral_data(referral_id: int, db: Session = Depends(get_db)):
    referral = db.query(Referral).filter(Referral.id == referral_id).first()
    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found")
    return referral.referral_data or {}

@router.post("/{referral_id}/data")
async def save_referral_data(referral_id: int, request: Request, db: Session = Depends(get_db)):
    referral = db.query(Referral).filter(Referral.id == referral_id).first()
    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found")
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
def get_referral_component_data(referral_id: int, component_type: str, db: Session = Depends(get_db)):
    referral = db.query(Referral).filter(Referral.id == referral_id).first()
    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found")
    data = referral.referral_data or {}
    return data.get(component_type)

@router.post("/{referral_id}/data/component/{component_type}")
async def save_referral_component_data(referral_id: int, component_type: str, request: Request, db: Session = Depends(get_db)):
    referral = db.query(Referral).filter(Referral.id == referral_id).first()
    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found")
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
def get_referral_eyes(referral_id: int, db: Session = Depends(get_db)):
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