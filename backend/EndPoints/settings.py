from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import Settings, Clinic
from schemas import SettingsCreate, SettingsUpdate, Settings as SettingsSchema

router = APIRouter(prefix="/settings", tags=["settings"])

@router.post("/", response_model=SettingsSchema)
def create_settings(settings: SettingsCreate, db: Session = Depends(get_db)):
    db_settings = Settings(**settings.dict())
    db.add(db_settings)
    db.commit()
    db.refresh(db_settings)
    return db_settings

@router.get("/clinic/{clinic_id}", response_model=SettingsSchema)
def get_settings_by_clinic(clinic_id: int, db: Session = Depends(get_db)):
    settings = db.query(Settings).filter(Settings.clinic_id == clinic_id).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found for clinic")
    return settings

@router.get("/", response_model=List[SettingsSchema])
def get_all_settings(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    company_id: Optional[int] = Query(None, description="Filter by company ID"),
    db: Session = Depends(get_db)
):
    query = db.query(Settings)
    if clinic_id:
        query = query.filter(Settings.clinic_id == clinic_id)
    elif company_id:
        clinic_ids = db.query(Clinic.id).filter(Clinic.company_id == company_id).all()
        clinic_id_list = [c[0] for c in clinic_ids]
        query = query.filter(Settings.clinic_id.in_(clinic_id_list))
    return query.all()

@router.get("/{settings_id}", response_model=SettingsSchema)
def get_settings(settings_id: int, db: Session = Depends(get_db)):
    settings = db.query(Settings).filter(Settings.id == settings_id).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    return settings

@router.put("/{settings_id}", response_model=SettingsSchema)
def update_settings(settings_id: int, settings: SettingsUpdate, db: Session = Depends(get_db)):
    db_settings = db.query(Settings).filter(Settings.id == settings_id).first()
    if not db_settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    
    for field, value in settings.dict(exclude_unset=True).items():
        setattr(db_settings, field, value)
    
    db.commit()
    db.refresh(db_settings)
    return db_settings

@router.delete("/{settings_id}")
def delete_settings(settings_id: int, db: Session = Depends(get_db)):
    settings = db.query(Settings).filter(Settings.id == settings_id).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    
    db.delete(settings)
    db.commit()
    return {"message": "Settings deleted successfully"} 