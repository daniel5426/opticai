from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from database import get_db
from models import Appointment, Client, User, Clinic
from schemas import AppointmentCreate, AppointmentUpdate, Appointment as AppointmentSchema
from auth import get_current_user
from sqlalchemy import func
from security.scope import resolve_company_id, assert_clinic_belongs_to_company, normalize_clinic_id_for_company


CEO_LEVEL = 4

router = APIRouter(prefix="/appointments", tags=["appointments"])

@router.post("/", response_model=AppointmentSchema)
def create_appointment(
    appointment: AppointmentCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        print(f"Received appointment data: {appointment.dict()}")
        print(f"Date field: {appointment.date} (type: {type(appointment.date)})")
        print(f"Current user: {current_user.username} (role_level: {current_user.role_level})")
        
        if not appointment.client_id:
            raise HTTPException(status_code=422, detail="client_id is required")
        
        client = db.query(Client).filter(Client.id == appointment.client_id).first()
        if not client:
            raise HTTPException(status_code=422, detail=f"Client with id {appointment.client_id} not found")
        
        if appointment.user_id:
            user = db.query(User).filter(User.id == appointment.user_id).first()
            if not user:
                raise HTTPException(status_code=422, detail=f"User with id {appointment.user_id} not found")
        
        appointment.clinic_id = normalize_clinic_id_for_company(db, current_user, appointment.clinic_id)
        
        # Set user_id if not provided
        if not appointment.user_id:
            appointment.user_id = current_user.id
        
        company_id = resolve_company_id(db, current_user)
        assert_clinic_belongs_to_company(db, appointment.clinic_id, company_id)
        
        print(f"Creating appointment with final data: {appointment.dict()}")
        db_appointment = Appointment(**appointment.dict())
        db.add(db_appointment)
        db.commit()
        db.refresh(db_appointment)
        # bump client_updated_date and clear ai_appointment_state to avoid stale AI
        try:
            if db_appointment.client_id:
                client = db.query(Client).filter(Client.id == db_appointment.client_id).first()
                if client:
                    client.client_updated_date = func.now()
                    client.ai_appointment_state = None
                    db.commit()
        except Exception:
            pass
        print(f"Successfully created appointment with ID: {db_appointment.id}")
        return db_appointment
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error creating appointment: {str(e)}")
        print(f"Error type: {type(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=422, detail=f"Error creating appointment: {str(e)}")

@router.get("/paginated")
def get_appointments_paginated(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    limit: int = Query(25, ge=1, le=100, description="Max items to return"),
    offset: int = Query(0, ge=0, description="Items to skip"),
    order: Optional[str] = Query("date_desc", description="Sort order: date_desc|date_asc|id_desc|id_asc"),
    search: Optional[str] = Query(None, description="Search by date/time/exam_name/note or client name"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from sqlalchemy import or_, func, String
    # Build base query with joins to include client and user names
    base = (
        db.query(
            Appointment,
            func.concat(Client.first_name, ' ', Client.last_name).label('client_full_name'),
            func.coalesce(User.full_name, User.username).label('examiner_name')
        )
        .outerjoin(Client, Client.id == Appointment.client_id)
        .outerjoin(User, User.id == Appointment.user_id)
    )
    company_id = resolve_company_id(db, current_user)
    base = base.join(Clinic, Clinic.id == Appointment.clinic_id).filter(Clinic.company_id == company_id)
    if clinic_id is not None:
        assert_clinic_belongs_to_company(db, clinic_id, company_id)
        base = base.filter(Appointment.clinic_id == clinic_id)
    if search:
        like = f"%{search.strip()}%"
        base = base.filter(
            or_(
                func.cast(Appointment.date, String).ilike(like),
                Appointment.time.ilike(like),
                Appointment.exam_name.ilike(like),
                Appointment.note.ilike(like),
                func.concat(Client.first_name, ' ', Client.last_name).ilike(like)
            )
        )
    
    # Apply ordering
    if order == "date_desc":
        base = base.order_by(Appointment.date.desc().nulls_last())
    elif order == "date_asc":
        base = base.order_by(Appointment.date.asc().nulls_last())
    elif order == "id_asc":
        base = base.order_by(Appointment.id.asc())
    else:  # default to id_desc
        base = base.order_by(Appointment.id.desc())
    
    total = base.count()
    rows = base.offset(offset).limit(limit).all()
    # rows are tuples (Appointment, client_full_name, examiner_name)
    items = []
    for row in rows:
        appt = row[0]
        setattr(appt, 'client_full_name', row[1])
        setattr(appt, 'examiner_name', row[2])
        items.append(appt)
    return {"items": items, "total": total}

@router.get("/{appointment_id}", response_model=AppointmentSchema)
def get_appointment(appointment_id: int, db: Session = Depends(get_db)):
    row = (
        db.query(
            Appointment,
            func.concat(Client.first_name, ' ', Client.last_name).label('client_full_name'),
            func.coalesce(User.full_name, User.username).label('examiner_name')
        )
        .outerjoin(Client, Client.id == Appointment.client_id)
        .outerjoin(User, User.id == Appointment.user_id)
        .filter(Appointment.id == appointment_id)
        .first()
    )
    appointment = row[0] if row else None
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    setattr(appointment, 'client_full_name', row[1])
    setattr(appointment, 'examiner_name', row[2])
    return appointment

@router.get("/", response_model=List[AppointmentSchema])
def get_all_appointments(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    base = (
        db.query(
            Appointment,
            func.concat(Client.first_name, ' ', Client.last_name).label('client_full_name'),
            func.coalesce(User.full_name, User.username).label('examiner_name')
        )
        .outerjoin(Client, Client.id == Appointment.client_id)
        .outerjoin(User, User.id == Appointment.user_id)
    )
    company_id = resolve_company_id(db, current_user)
    base = base.join(Clinic, Clinic.id == Appointment.clinic_id).filter(Clinic.company_id == company_id)
    if clinic_id is not None:
        assert_clinic_belongs_to_company(db, clinic_id, company_id)
        base = base.filter(Appointment.clinic_id == clinic_id)
    rows = base.all()
    items = []
    for row in rows:
        appt = row[0]
        setattr(appt, 'client_full_name', row[1])
        setattr(appt, 'examiner_name', row[2])
        items.append(appt)
    return items

@router.get("/client/{client_id}", response_model=List[AppointmentSchema])
def get_appointments_by_client(client_id: int, db: Session = Depends(get_db)):
    rows = (
        db.query(
            Appointment,
            func.concat(Client.first_name, ' ', Client.last_name).label('client_full_name'),
            func.coalesce(User.full_name, User.username).label('examiner_name')
        )
        .outerjoin(Client, Client.id == Appointment.client_id)
        .outerjoin(User, User.id == Appointment.user_id)
        .filter(Appointment.client_id == client_id)
        .all()
    )
    items = []
    for row in rows:
        appt = row[0]
        setattr(appt, 'client_full_name', row[1])
        setattr(appt, 'examiner_name', row[2])
        items.append(appt)
    return items

@router.get("/user/{user_id}", response_model=List[AppointmentSchema])
def get_appointments_by_user(user_id: int, db: Session = Depends(get_db)):
    rows = (
        db.query(
            Appointment,
            func.concat(Client.first_name, ' ', Client.last_name).label('client_full_name'),
            func.coalesce(User.full_name, User.username).label('examiner_name')
        )
        .outerjoin(Client, Client.id == Appointment.client_id)
        .outerjoin(User, User.id == Appointment.user_id)
        .filter(Appointment.user_id == user_id)
        .all()
    )
    items = []
    for row in rows:
        appt = row[0]
        setattr(appt, 'client_full_name', row[1])
        setattr(appt, 'examiner_name', row[2])
        items.append(appt)
    return items

@router.put("/{appointment_id}", response_model=AppointmentSchema)
def update_appointment(appointment_id: int, appointment: AppointmentUpdate, db: Session = Depends(get_db)):
    db_appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not db_appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    for field, value in appointment.dict(exclude_unset=True).items():
        setattr(db_appointment, field, value)
    
    db.commit()
    # bump client_updated_date and clear ai_appointment_state to avoid stale AI
    try:
        if db_appointment.client_id:
            client = db.query(Client).filter(Client.id == db_appointment.client_id).first()
            if client:
                client.client_updated_date = func.now()
                client.ai_appointment_state = None
                db.commit()
    except Exception:
        pass
    db.refresh(db_appointment)
    return db_appointment

@router.delete("/{appointment_id}")
def delete_appointment(appointment_id: int, db: Session = Depends(get_db)):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    client_id = appointment.client_id
    db.delete(appointment)
    db.commit()
    # bump client_updated_date and clear ai_appointment_state to avoid stale AI
    try:
        if client_id:
            client = db.query(Client).filter(Client.id == client_id).first()
            if client:
                client.client_updated_date = func.now()
                client.ai_appointment_state = None
                db.commit()
    except Exception:
        pass
    return {"message": "Appointment deleted successfully"}

@router.put("/{appointment_id}/google-event-id")
def update_appointment_google_event_id(
    appointment_id: int, 
    google_event_id: Optional[str], 
    db: Session = Depends(get_db)
):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    appointment.google_calendar_event_id = google_event_id
    db.commit()
    # bump client_updated_date and clear ai_appointment_state to avoid stale AI
    try:
        if appointment.client_id:
            client = db.query(Client).filter(Client.id == appointment.client_id).first()
            if client:
                client.client_updated_date = func.now()
                client.ai_appointment_state = None
                db.commit()
    except Exception:
        pass
    return {"message": "Google event ID updated successfully"} 

@router.get("/stats/company/{company_id}")
def get_company_appointments_stats(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role_level < CEO_LEVEL:
        raise HTTPException(status_code=403, detail="Access denied")
    month_expr = func.date_trunc('month', Appointment.date)
    month_str = func.to_char(month_expr, 'YYYY-MM')
    rows = (
        db.query(month_str.label('month'), func.count(Appointment.id).label('count'))
        .join(Clinic, Clinic.id == Appointment.clinic_id)
        .filter(Clinic.company_id == company_id)
        .group_by(month_expr)
        .order_by(month_expr)
        .all()
    )
    return [{"month": r.month, "count": int(r.count)} for r in rows]