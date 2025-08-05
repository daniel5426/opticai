from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import Referral, Client, User, ReferralEye
from schemas import ReferralCreate, ReferralUpdate, Referral as ReferralSchema

router = APIRouter(prefix="/referrals", tags=["referrals"])

@router.post("/", response_model=ReferralSchema)
def create_referral(referral: ReferralCreate, db: Session = Depends(get_db)):
    db_referral = Referral(**referral.dict())
    db.add(db_referral)
    db.commit()
    db.refresh(db_referral)
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
    db: Session = Depends(get_db)
):
    query = db.query(Referral)
    if clinic_id:
        query = query.filter(Referral.clinic_id == clinic_id)
    return query.all()

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
    db.refresh(db_referral)
    return db_referral

@router.delete("/{referral_id}")
def delete_referral(referral_id: int, db: Session = Depends(get_db)):
    referral = db.query(Referral).filter(Referral.id == referral_id).first()
    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found")
    
    db.delete(referral)
    db.commit()
    return {"message": "Referral deleted successfully"}

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