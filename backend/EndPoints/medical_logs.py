from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import MedicalLog, Client, User, Clinic
from sqlalchemy import func
from schemas import MedicalLogCreate, MedicalLogUpdate, MedicalLog as MedicalLogSchema
from auth import get_current_user
from security.scope import (
    apply_clinic_user_scope,
    get_allowed_clinic_ids,
    get_scoped_client,
    get_scoped_medical_log,
)

router = APIRouter(prefix="/medical-logs", tags=["medical-logs"])

@router.post("/", response_model=MedicalLogSchema)
def create_medical_log(
    medical_log: MedicalLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payload = apply_clinic_user_scope(db, current_user, medical_log.dict())
    db_medical_log = MedicalLog(**payload)
    db.add(db_medical_log)
    db.commit()
    db.refresh(db_medical_log)
    # bump client_updated_date and clear ai_medical_state to avoid stale AI
    try:
        if db_medical_log.client_id:
            client = db.query(Client).filter(Client.id == db_medical_log.client_id).first()
            if client:
                client.client_updated_date = func.now()
                client.ai_medical_state = None
                db.commit()
    except Exception:
        pass
    return db_medical_log

@router.get("/{medical_log_id}", response_model=MedicalLogSchema)
def get_medical_log(
    medical_log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_scoped_medical_log(db, current_user, medical_log_id)

@router.get("/", response_model=List[MedicalLogSchema])
def get_all_medical_logs(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    allowed_clinic_ids = get_allowed_clinic_ids(db, current_user, clinic_id)
    query = db.query(MedicalLog).filter(MedicalLog.clinic_id.in_(allowed_clinic_ids))
    return query.all()

@router.get("/client/{client_id}", response_model=List[MedicalLogSchema])
def get_medical_logs_by_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_scoped_client(db, current_user, client_id)
    medical_logs = (
        db.query(MedicalLog)
        .filter(MedicalLog.client_id == client_id)
        .order_by(MedicalLog.log_date.desc().nulls_last(), MedicalLog.id.desc())
        .all()
    )
    return medical_logs

@router.put("/{medical_log_id}", response_model=MedicalLogSchema)
def update_medical_log(
    medical_log_id: int,
    medical_log: MedicalLogUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_medical_log = get_scoped_medical_log(db, current_user, medical_log_id)
    update_fields = medical_log.dict(exclude_unset=True)
    if update_fields:
        candidate = {
            "client_id": db_medical_log.client_id,
            "clinic_id": db_medical_log.clinic_id,
            "user_id": db_medical_log.user_id,
        }
        candidate.update({k: update_fields[k] for k in candidate.keys() & update_fields.keys()})
        scoped = apply_clinic_user_scope(db, current_user, candidate)
        for key in ("client_id", "clinic_id", "user_id"):
            if key in update_fields:
                update_fields[key] = scoped[key]
    for field, value in update_fields.items():
        setattr(db_medical_log, field, value)
    
    db.commit()
    # bump client_updated_date and clear ai_medical_state to avoid stale AI
    try:
        if db_medical_log.client_id:
            client = db.query(Client).filter(Client.id == db_medical_log.client_id).first()
            if client:
                client.client_updated_date = func.now()
                client.ai_medical_state = None
                db.commit()
    except Exception:
        pass
    db.refresh(db_medical_log)
    return db_medical_log

@router.delete("/{medical_log_id}")
def delete_medical_log(
    medical_log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    medical_log = get_scoped_medical_log(db, current_user, medical_log_id)
    client_id = medical_log.client_id
    db.delete(medical_log)
    db.commit()
    # bump client_updated_date and clear ai_medical_state to avoid stale AI
    try:
        if client_id:
            client = db.query(Client).filter(Client.id == client_id).first()
            if client:
                client.client_updated_date = func.now()
                client.ai_medical_state = None
                db.commit()
    except Exception:
        pass
    return {"message": "Medical log deleted successfully"} 
