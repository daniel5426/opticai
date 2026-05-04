from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import Clinic, Company
from schemas import ClinicCreate, ClinicUpdate, Clinic as ClinicSchema
from auth import get_current_user, get_password_hash
from models import User
from services.default_exam_layouts import ensure_default_exam_layouts_for_clinic
from services.lookup_defaults import seed_default_lookup_values_for_clinic
from security.scope import assert_clinic_scope, assert_company_access, require_company_admin, resolve_company_id
import uuid


CEO_LEVEL = 4
MANAGER_LEVEL = 3

router = APIRouter(prefix="/clinics", tags=["clinics"])

@router.post("/", response_model=ClinicSchema)
def create_clinic(
    clinic: ClinicCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role_level < MANAGER_LEVEL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to create clinics"
        )
    
    if current_user.role_level == MANAGER_LEVEL and current_user.clinic_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Clinic managers cannot create new clinics"
        )
    
    if not clinic.unique_id:
        clinic.unique_id = str(uuid.uuid4())

    clinic_payload = clinic.dict()
    assert_company_access(db, current_user, clinic_payload["company_id"])
    clinic_payload.pop("has_entry_pin", None)
    clinic_payload.pop("remove_entry_pin", None)
    entry_pin = (clinic_payload.pop("entry_pin", None) or "").strip()
    if entry_pin and len(entry_pin) < 4:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Clinic PIN must be at least 4 characters")
    if entry_pin and len(entry_pin.encode("utf-8")) > 72:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Clinic PIN must be 72 bytes or fewer")
    
    db_clinic = Clinic(
        **clinic_payload,
        entry_pin_hash=get_password_hash(entry_pin) if entry_pin else None,
        entry_pin_version=1,
    )
    db.add(db_clinic)
    db.flush()
    ensure_default_exam_layouts_for_clinic(db, db_clinic.id)
    seed_default_lookup_values_for_clinic(db, db_clinic.id)
    db.commit()
    db.refresh(db_clinic)
    return db_clinic

@router.get("/", response_model=List[ClinicSchema])
def get_clinics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role_level >= CEO_LEVEL:
        clinics = db.query(Clinic).filter(Clinic.company_id == resolve_company_id(db, current_user)).all()
    else:
        clinics = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).all()
    return clinics

@router.get("/{clinic_id}", response_model=ClinicSchema)
def get_clinic(
    clinic_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if clinic is None:
        raise HTTPException(status_code=404, detail="Clinic not found")
    assert_clinic_scope(db, current_user, clinic_id)
    
    return clinic

@router.get("/unique/{unique_id}", response_model=ClinicSchema)
def get_clinic_by_unique_id(
    unique_id: str,
    db: Session = Depends(get_db)
):
    clinic = db.query(Clinic).filter(Clinic.unique_id == unique_id).first()
    if clinic is None:
        raise HTTPException(status_code=404, detail="Clinic not found")
    return clinic

@router.get("/company/{company_id}", response_model=List[ClinicSchema])
def get_clinics_by_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all clinics for a specific company"""
    # Check if company exists
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    assert_company_access(db, current_user, company_id)
    return db.query(Clinic).filter(Clinic.company_id == company_id).all()

@router.put("/{clinic_id}", response_model=ClinicSchema)
def update_clinic(
    clinic_id: int,
    clinic: ClinicUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role_level < MANAGER_LEVEL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to update clinics"
        )
    
    if current_user.role_level == MANAGER_LEVEL and current_user.clinic_id != clinic_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only update your own clinic"
        )
    
    db_clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if db_clinic is None:
        raise HTTPException(status_code=404, detail="Clinic not found")
    assert_clinic_scope(db, current_user, clinic_id)
    
    update_data = clinic.dict(exclude_unset=True)
    if "company_id" in update_data:
        assert_company_access(db, current_user, update_data["company_id"])
    entry_pin = update_data.pop("entry_pin", None)
    remove_entry_pin = bool(update_data.pop("remove_entry_pin", False))
    if entry_pin is not None:
        entry_pin = entry_pin.strip()
        if not entry_pin:
            entry_pin = None
        elif len(entry_pin) < 4:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Clinic PIN must be at least 4 characters")
        elif len(entry_pin.encode("utf-8")) > 72:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Clinic PIN must be 72 bytes or fewer")
        if entry_pin:
            db_clinic.entry_pin_hash = get_password_hash(entry_pin)
            db_clinic.entry_pin_version = (db_clinic.entry_pin_version or 1) + 1
    if remove_entry_pin and not entry_pin and db_clinic.entry_pin_hash:
        db_clinic.entry_pin_hash = None
        db_clinic.entry_pin_version = (db_clinic.entry_pin_version or 1) + 1

    for field, value in update_data.items():
        if field in {"has_entry_pin", "remove_entry_pin"}:
            continue
        setattr(db_clinic, field, value)
    
    db.commit()
    db.refresh(db_clinic)
    return db_clinic

@router.delete("/{clinic_id}")
def delete_clinic(
    clinic_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if db_clinic is None:
        raise HTTPException(status_code=404, detail="Clinic not found")
    require_company_admin(db, current_user, db_clinic.company_id)
    
    db.delete(db_clinic)
    db.commit()
    return {"message": "Clinic deleted successfully"} 
