from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import MedicalLog, Client, User
from sqlalchemy import func
from schemas import MedicalLogCreate, MedicalLogUpdate, MedicalLog as MedicalLogSchema

router = APIRouter(prefix="/medical-logs", tags=["medical-logs"])

@router.post("/", response_model=MedicalLogSchema)
def create_medical_log(medical_log: MedicalLogCreate, db: Session = Depends(get_db)):
    db_medical_log = MedicalLog(**medical_log.dict())
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
def get_medical_log(medical_log_id: int, db: Session = Depends(get_db)):
    medical_log = db.query(MedicalLog).filter(MedicalLog.id == medical_log_id).first()
    if not medical_log:
        raise HTTPException(status_code=404, detail="Medical log not found")
    return medical_log

@router.get("/", response_model=List[MedicalLogSchema])
def get_all_medical_logs(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    db: Session = Depends(get_db)
):
    query = db.query(MedicalLog)
    if clinic_id:
        query = query.filter(MedicalLog.clinic_id == clinic_id)
    return query.all()

@router.get("/client/{client_id}", response_model=List[MedicalLogSchema])
def get_medical_logs_by_client(client_id: int, db: Session = Depends(get_db)):
    medical_logs = db.query(MedicalLog).filter(MedicalLog.client_id == client_id).all()
    return medical_logs

@router.put("/{medical_log_id}", response_model=MedicalLogSchema)
def update_medical_log(medical_log_id: int, medical_log: MedicalLogUpdate, db: Session = Depends(get_db)):
    db_medical_log = db.query(MedicalLog).filter(MedicalLog.id == medical_log_id).first()
    if not db_medical_log:
        raise HTTPException(status_code=404, detail="Medical log not found")
    
    for field, value in medical_log.dict(exclude_unset=True).items():
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
def delete_medical_log(medical_log_id: int, db: Session = Depends(get_db)):
    medical_log = db.query(MedicalLog).filter(MedicalLog.id == medical_log_id).first()
    if not medical_log:
        raise HTTPException(status_code=404, detail="Medical log not found")
    
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