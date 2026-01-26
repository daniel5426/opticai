from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from database import get_db
from models import (
    LookupSupplier, LookupClinic, LookupOrderType, LookupReferralType,
    LookupLensModel, LookupColor, LookupMaterial, LookupCoating,
    LookupManufacturer, LookupFrameModel, LookupContactLensType,
    LookupContactEyeLensType,     LookupContactEyeMaterial, LookupContactLensModel,
    LookupCleaningSolution, LookupDisinfectionSolution, LookupRinsingSolution,
    LookupManufacturingLab, LookupAdvisor, LookupVAMeter, LookupVADecimal
)
from pydantic import BaseModel

router = APIRouter(prefix="/lookups", tags=["lookups"])

# Lookup table mapping
LOOKUP_MODELS = {
    'suppliers': LookupSupplier,
    'clinics': LookupClinic,
    'order-types': LookupOrderType,
    'referral-types': LookupReferralType,
    'lens-models': LookupLensModel,
    'colors': LookupColor,
    'materials': LookupMaterial,
    'coatings': LookupCoating,
    'manufacturers': LookupManufacturer,
    'frame-models': LookupFrameModel,
    'contact-lens-types': LookupContactLensType,
    'contact-eye-lens-types': LookupContactEyeLensType,
    'contact-eye-materials': LookupContactEyeMaterial,
    'contact-lens-models': LookupContactLensModel,
    'cleaning-solutions': LookupCleaningSolution,
    'disinfection-solutions': LookupDisinfectionSolution,
    'rinsing-solutions': LookupRinsingSolution,
    'manufacturing-labs': LookupManufacturingLab,
    'advisors': LookupAdvisor,
    'va-meter': LookupVAMeter,
    'va-decimal': LookupVADecimal
}

class LookupCreate(BaseModel):
    name: str

class LookupUpdate(BaseModel):
    name: str

@router.get("/types")
def get_lookup_types():
    return {"lookup_types": list(LOOKUP_MODELS.keys())}

@router.get("/{lookup_type}")
def get_all_lookups(lookup_type: str, db: Session = Depends(get_db)):
    if lookup_type not in LOOKUP_MODELS:
        raise HTTPException(status_code=400, detail=f"Invalid lookup type: {lookup_type}")
    
    model_class = LOOKUP_MODELS[lookup_type]
    lookups = db.query(model_class).all()
    
    return [
        {
            "id": lookup.id,
            "name": lookup.name,
            "created_at": lookup.created_at
        }
        for lookup in lookups
    ]

@router.post("/{lookup_type}")
def create_lookup(lookup_type: str, lookup: LookupCreate, db: Session = Depends(get_db)):
    if lookup_type not in LOOKUP_MODELS:
        raise HTTPException(status_code=400, detail=f"Invalid lookup type: {lookup_type}")
    
    model_class = LOOKUP_MODELS[lookup_type]
    
    # Check if name already exists
    existing = db.query(model_class).filter(model_class.name == lookup.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Name already exists")
    
    db_lookup = model_class(name=lookup.name)
    db.add(db_lookup)
    db.commit()
    db.refresh(db_lookup)
    
    return {
        "id": db_lookup.id,
        "name": db_lookup.name,
        "created_at": db_lookup.created_at
    }

@router.get("/{lookup_type}/{lookup_id}")
def get_lookup(lookup_type: str, lookup_id: int, db: Session = Depends(get_db)):
    if lookup_type not in LOOKUP_MODELS:
        raise HTTPException(status_code=400, detail=f"Invalid lookup type: {lookup_type}")
    
    model_class = LOOKUP_MODELS[lookup_type]
    lookup = db.query(model_class).filter(model_class.id == lookup_id).first()
    
    if not lookup:
        raise HTTPException(status_code=404, detail="Lookup not found")
    
    return {
        "id": lookup.id,
        "name": lookup.name,
        "created_at": lookup.created_at
    }

@router.put("/{lookup_type}/{lookup_id}")
def update_lookup(lookup_type: str, lookup_id: int, lookup: LookupUpdate, db: Session = Depends(get_db)):
    if lookup_type not in LOOKUP_MODELS:
        raise HTTPException(status_code=400, detail=f"Invalid lookup type: {lookup_type}")
    
    model_class = LOOKUP_MODELS[lookup_type]
    db_lookup = db.query(model_class).filter(model_class.id == lookup_id).first()
    
    if not db_lookup:
        raise HTTPException(status_code=404, detail="Lookup not found")
    
    # Check if name already exists (excluding current record)
    existing = db.query(model_class).filter(
        model_class.name == lookup.name,
        model_class.id != lookup_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Name already exists")
    
    db_lookup.name = lookup.name
    db.commit()
    db.refresh(db_lookup)
    
    return {
        "id": db_lookup.id,
        "name": db_lookup.name,
        "created_at": db_lookup.created_at
    }

@router.delete("/{lookup_type}/{lookup_id}")
def delete_lookup(lookup_type: str, lookup_id: int, db: Session = Depends(get_db)):
    if lookup_type not in LOOKUP_MODELS:
        raise HTTPException(status_code=400, detail=f"Invalid lookup type: {lookup_type}")
    
    model_class = LOOKUP_MODELS[lookup_type]
    lookup = db.query(model_class).filter(model_class.id == lookup_id).first()
    
    if not lookup:
        raise HTTPException(status_code=404, detail="Lookup not found")
    
    db.delete(lookup)
    db.commit()
    return {"message": "Lookup deleted successfully"} 