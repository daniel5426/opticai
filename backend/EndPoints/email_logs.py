from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import EmailLog, Appointment, User
from schemas import EmailLogCreate, EmailLogUpdate, EmailLog as EmailLogSchema
from auth import get_current_user
from security.scope import get_scoped_appointment

router = APIRouter(prefix="/email-logs", tags=["email-logs"])

@router.post("/", response_model=EmailLogSchema)
def create_email_log(
    email_log: EmailLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_scoped_appointment(db, current_user, email_log.appointment_id)
    db_email_log = EmailLog(**email_log.dict())
    db.add(db_email_log)
    db.commit()
    db.refresh(db_email_log)
    return db_email_log

@router.get("/{email_log_id}", response_model=EmailLogSchema)
def get_email_log(
    email_log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    email_log = db.query(EmailLog).filter(EmailLog.id == email_log_id).first()
    if not email_log:
        raise HTTPException(status_code=404, detail="Email log not found")
    get_scoped_appointment(db, current_user, email_log.appointment_id)
    return email_log

@router.get("/", response_model=List[EmailLogSchema])
def get_all_email_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(EmailLog).join(Appointment, Appointment.id == EmailLog.appointment_id)
    if (current_user.role_level or 1) < 4:
        if current_user.clinic_id is None:
            return []
        query = query.filter(Appointment.clinic_id == current_user.clinic_id)
    else:
        from models import Clinic
        from security.scope import resolve_company_id
        company_id = resolve_company_id(db, current_user)
        query = query.join(Clinic, Clinic.id == Appointment.clinic_id).filter(Clinic.company_id == company_id)
    email_logs = query.all()
    return email_logs

@router.get("/appointment/{appointment_id}", response_model=List[EmailLogSchema])
def get_email_logs_by_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_scoped_appointment(db, current_user, appointment_id)
    email_logs = db.query(EmailLog).filter(EmailLog.appointment_id == appointment_id).all()
    return email_logs

@router.put("/{email_log_id}", response_model=EmailLogSchema)
def update_email_log(
    email_log_id: int,
    email_log: EmailLogUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_email_log = db.query(EmailLog).filter(EmailLog.id == email_log_id).first()
    if not db_email_log:
        raise HTTPException(status_code=404, detail="Email log not found")
    get_scoped_appointment(db, current_user, db_email_log.appointment_id)
    if email_log.appointment_id is not None:
        get_scoped_appointment(db, current_user, email_log.appointment_id)
    
    for field, value in email_log.dict(exclude_unset=True).items():
        setattr(db_email_log, field, value)
    
    db.commit()
    db.refresh(db_email_log)
    return db_email_log

@router.delete("/{email_log_id}")
def delete_email_log(
    email_log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    email_log = db.query(EmailLog).filter(EmailLog.id == email_log_id).first()
    if not email_log:
        raise HTTPException(status_code=404, detail="Email log not found")
    get_scoped_appointment(db, current_user, email_log.appointment_id)
    
    db.delete(email_log)
    db.commit()
    return {"message": "Email log deleted successfully"}
