from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import Clinic, Company
from schemas import ClinicCreate, ClinicUpdate, Clinic as ClinicSchema
from auth import get_current_user, get_password_hash
from models import User
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
    clinic_payload.pop("has_entry_pin", None)
    entry_pin = (clinic_payload.pop("entry_pin", None) or "").strip()
    if len(entry_pin) < 4:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Clinic PIN must be at least 4 characters")
    if len(entry_pin.encode("utf-8")) > 72:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Clinic PIN must be 72 bytes or fewer")
    
    db_clinic = Clinic(
        **clinic_payload,
        entry_pin_hash=get_password_hash(entry_pin),
        entry_pin_version=1,
    )
    db.add(db_clinic)
    db.commit()
    db.refresh(db_clinic)
    return db_clinic

@router.get("/", response_model=List[ClinicSchema])
def get_clinics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role_level >= CEO_LEVEL:
        clinics = db.query(Clinic).all()
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
    
    if current_user.role_level < CEO_LEVEL and current_user.clinic_id != clinic_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
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
    
    # Check permissions
    if current_user.role_level >= CEO_LEVEL:
        # CEO can see all clinics in their company
        clinics = db.query(Clinic).filter(Clinic.company_id == company_id).all()
    else:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return clinics

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
    
    update_data = clinic.dict(exclude_unset=True)
    entry_pin = update_data.pop("entry_pin", None)
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

    for field, value in update_data.items():
        if field == "has_entry_pin":
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
    if current_user.role_level < CEO_LEVEL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only company CEOs can delete clinics"
        )
    
    db_clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if db_clinic is None:
        raise HTTPException(status_code=404, detail="Clinic not found")
    
    db.delete(db_clinic)
    db.commit()
    return {"message": "Clinic deleted successfully"} 
