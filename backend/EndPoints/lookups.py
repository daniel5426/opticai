from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
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
from auth import get_current_user
from models import User
from security.scope import assert_clinic_scope

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
    clinic_id: int
    name: str

class LookupUpdate(BaseModel):
    name: str


def _require_lookup_edit(current_user: User) -> None:
    if (current_user.role_level or 1) < 2:
        raise HTTPException(status_code=403, detail="Access denied")


def _require_lookup_delete(current_user: User) -> None:
    if (current_user.role_level or 1) < 1:
        raise HTTPException(status_code=403, detail="Access denied")


def _get_lookup_model(lookup_type: str):
    if lookup_type not in LOOKUP_MODELS:
        raise HTTPException(status_code=400, detail=f"Invalid lookup type: {lookup_type}")
    return LOOKUP_MODELS[lookup_type]


def _serialize_lookup(lookup):
    return {
        "id": lookup.id,
        "clinic_id": lookup.clinic_id,
        "name": lookup.name,
        "created_at": lookup.created_at,
    }


def _normalize_name(name: str) -> str:
    value = (name or "").strip()
    if not value:
        raise HTTPException(status_code=400, detail="Name is required")
    return value


def _get_scoped_lookup(db: Session, model_class, lookup_id: int, clinic_id: int):
    lookup = (
        db.query(model_class)
        .filter(model_class.id == lookup_id)
        .filter(model_class.clinic_id == clinic_id)
        .first()
    )
    if not lookup:
        raise HTTPException(status_code=404, detail="Lookup not found")
    return lookup

@router.get("/types")
def get_lookup_types(current_user: User = Depends(get_current_user)):
    return {"lookup_types": list(LOOKUP_MODELS.keys())}

@router.get("/{lookup_type}")
def get_all_lookups(
    lookup_type: str,
    clinic_id: int = Query(..., description="Clinic ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assert_clinic_scope(db, current_user, clinic_id)
    model_class = _get_lookup_model(lookup_type)
    lookups = (
        db.query(model_class)
        .filter(model_class.clinic_id == clinic_id)
        .order_by(model_class.name.asc())
        .all()
    )
    return [_serialize_lookup(lookup) for lookup in lookups]

@router.post("/{lookup_type}")
def create_lookup(
    lookup_type: str,
    lookup: LookupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_lookup_edit(current_user)
    assert_clinic_scope(db, current_user, lookup.clinic_id)
    model_class = _get_lookup_model(lookup_type)
    name = _normalize_name(lookup.name)

    existing = (
        db.query(model_class)
        .filter(model_class.clinic_id == lookup.clinic_id)
        .filter(model_class.name == name)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Name already exists")

    db_lookup = model_class(clinic_id=lookup.clinic_id, name=name)
    db.add(db_lookup)
    db.commit()
    db.refresh(db_lookup)
    return _serialize_lookup(db_lookup)

@router.get("/{lookup_type}/{lookup_id}")
def get_lookup(
    lookup_type: str,
    lookup_id: int,
    clinic_id: int = Query(..., description="Clinic ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assert_clinic_scope(db, current_user, clinic_id)
    model_class = _get_lookup_model(lookup_type)
    return _serialize_lookup(_get_scoped_lookup(db, model_class, lookup_id, clinic_id))

@router.put("/{lookup_type}/{lookup_id}")
def update_lookup(
    lookup_type: str,
    lookup_id: int,
    lookup: LookupUpdate,
    clinic_id: int = Query(..., description="Clinic ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_lookup_edit(current_user)
    assert_clinic_scope(db, current_user, clinic_id)
    model_class = _get_lookup_model(lookup_type)
    db_lookup = _get_scoped_lookup(db, model_class, lookup_id, clinic_id)
    name = _normalize_name(lookup.name)

    existing = (
        db.query(model_class)
        .filter(model_class.clinic_id == clinic_id)
        .filter(model_class.name == name)
        .filter(model_class.id != lookup_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Name already exists")

    db_lookup.name = name
    db.commit()
    db.refresh(db_lookup)
    return _serialize_lookup(db_lookup)

@router.delete("/{lookup_type}/{lookup_id}")
def delete_lookup(
    lookup_type: str,
    lookup_id: int,
    clinic_id: int = Query(..., description="Clinic ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_lookup_delete(current_user)
    assert_clinic_scope(db, current_user, clinic_id)
    model_class = _get_lookup_model(lookup_type)
    lookup = _get_scoped_lookup(db, model_class, lookup_id, clinic_id)
    db.delete(lookup)
    db.commit()
    return {"message": "Lookup deleted successfully"}
