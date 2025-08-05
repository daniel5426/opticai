from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import EmailLog, Appointment
from schemas import EmailLogCreate, EmailLogUpdate, EmailLog as EmailLogSchema

router = APIRouter(prefix="/email-logs", tags=["email-logs"])

@router.post("/", response_model=EmailLogSchema)
def create_email_log(email_log: EmailLogCreate, db: Session = Depends(get_db)):
    db_email_log = EmailLog(**email_log.dict())
    db.add(db_email_log)
    db.commit()
    db.refresh(db_email_log)
    return db_email_log

@router.get("/{email_log_id}", response_model=EmailLogSchema)
def get_email_log(email_log_id: int, db: Session = Depends(get_db)):
    email_log = db.query(EmailLog).filter(EmailLog.id == email_log_id).first()
    if not email_log:
        raise HTTPException(status_code=404, detail="Email log not found")
    return email_log

@router.get("/", response_model=List[EmailLogSchema])
def get_all_email_logs(db: Session = Depends(get_db)):
    email_logs = db.query(EmailLog).all()
    return email_logs

@router.get("/appointment/{appointment_id}", response_model=List[EmailLogSchema])
def get_email_logs_by_appointment(appointment_id: int, db: Session = Depends(get_db)):
    email_logs = db.query(EmailLog).filter(EmailLog.appointment_id == appointment_id).all()
    return email_logs

@router.put("/{email_log_id}", response_model=EmailLogSchema)
def update_email_log(email_log_id: int, email_log: EmailLogUpdate, db: Session = Depends(get_db)):
    db_email_log = db.query(EmailLog).filter(EmailLog.id == email_log_id).first()
    if not db_email_log:
        raise HTTPException(status_code=404, detail="Email log not found")
    
    for field, value in email_log.dict(exclude_unset=True).items():
        setattr(db_email_log, field, value)
    
    db.commit()
    db.refresh(db_email_log)
    return db_email_log

@router.delete("/{email_log_id}")
def delete_email_log(email_log_id: int, db: Session = Depends(get_db)):
    email_log = db.query(EmailLog).filter(EmailLog.id == email_log_id).first()
    if not email_log:
        raise HTTPException(status_code=404, detail="Email log not found")
    
    db.delete(email_log)
    db.commit()
    return {"message": "Email log deleted successfully"} 