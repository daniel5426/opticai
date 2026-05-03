from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from database import get_db
from models import Appointment, Client, User, Clinic
from schemas import AppointmentCreate, AppointmentUpdate, Appointment as AppointmentSchema
from auth import get_current_user
from utils.date_search import DateSearchHelper
from sqlalchemy import func
from security.scope import (
    apply_clinic_user_scope,
    get_allowed_clinic_ids,
    get_scoped_appointment,
    get_scoped_client,
    get_scoped_user,
    normalize_client_id,
    normalize_clinic_id_for_company,
    normalize_user_id,
    resolve_company_id,
)


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
        
        payload = apply_clinic_user_scope(db, current_user, appointment.dict())
        payload["user_id"] = normalize_user_id(db, current_user, payload.get("user_id"))
        payload["client_id"] = normalize_client_id(db, current_user, payload["client_id"], payload["clinic_id"])
        
        print(f"Creating appointment with final data: {payload}")
        db_appointment = Appointment(**payload)
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
    date_scope: Optional[str] = Query(None, description="Filter by date scope: all|today|upcoming|past"),
    exam_name: Optional[str] = Query(None, description="Filter by exact exam name"),
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
    allowed_clinic_ids = get_allowed_clinic_ids(db, current_user, clinic_id)
    base = base.filter(Appointment.clinic_id.in_(allowed_clinic_ids))
    if exam_name and exam_name != "all":
        base = base.filter(Appointment.exam_name == exam_name)
    today = date.today()
    if date_scope == "today":
        base = base.filter(Appointment.date == today)
    elif date_scope == "upcoming":
        base = base.filter(Appointment.date > today)
    elif date_scope == "past":
        base = base.filter(Appointment.date < today)
    if search:
        like = f"%{search.strip()}%"
        date_search_conditions = DateSearchHelper.build_date_search_conditions(
            Appointment.date, search
        )
        base = base.filter(
            or_(
                func.cast(Appointment.date, String).ilike(like),
                Appointment.time.ilike(like),
                Appointment.exam_name.ilike(like),
                Appointment.note.ilike(like),
                func.concat(Client.first_name, ' ', Client.last_name).ilike(like),
                func.coalesce(User.full_name, User.username).ilike(like),
                *date_search_conditions,
            )
        )
    
    order_columns = {
        "date": Appointment.date,
        "time": Appointment.time,
        "id": Appointment.id,
        "client": func.concat(Client.first_name, ' ', Client.last_name),
        "exam_name": Appointment.exam_name,
        "examiner": func.coalesce(User.full_name, User.username),
        "note": Appointment.note,
    }
    order_key, _, order_direction = (order or "date_desc").rpartition("_")
    order_column = order_columns.get(order_key, Appointment.date)
    if order_direction == "asc":
        base = base.order_by(order_column.asc().nulls_last(), Appointment.id.asc())
    else:
        base = base.order_by(order_column.desc().nulls_last(), Appointment.id.desc())
    
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
def get_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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
    get_scoped_appointment(db, current_user, appointment_id)
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
    allowed_clinic_ids = get_allowed_clinic_ids(db, current_user, clinic_id)
    base = base.filter(Appointment.clinic_id.in_(allowed_clinic_ids))
    rows = base.all()
    items = []
    for row in rows:
        appt = row[0]
        setattr(appt, 'client_full_name', row[1])
        setattr(appt, 'examiner_name', row[2])
        items.append(appt)
    return items

@router.get("/client/{client_id}", response_model=List[AppointmentSchema])
def get_appointments_by_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_scoped_client(db, current_user, client_id)
    rows = (
        db.query(
            Appointment,
            func.concat(Client.first_name, ' ', Client.last_name).label('client_full_name'),
            func.coalesce(User.full_name, User.username).label('examiner_name')
        )
        .outerjoin(Client, Client.id == Appointment.client_id)
        .outerjoin(User, User.id == Appointment.user_id)
        .filter(Appointment.client_id == client_id)
        .order_by(Appointment.date.desc().nulls_last(), Appointment.id.desc())
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
def get_appointments_by_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_scoped_user(db, current_user, user_id)
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
def update_appointment(
    appointment_id: int,
    appointment: AppointmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_appointment = get_scoped_appointment(db, current_user, appointment_id)
    update_fields = appointment.dict(exclude_unset=True)
    if update_fields:
        candidate = {
            "client_id": db_appointment.client_id,
            "clinic_id": db_appointment.clinic_id,
            "user_id": db_appointment.user_id,
        }
        candidate.update({k: update_fields[k] for k in candidate.keys() & update_fields.keys()})
        scoped = apply_clinic_user_scope(db, current_user, candidate)
        for key in ("client_id", "clinic_id", "user_id"):
            if key in update_fields:
                update_fields[key] = scoped[key]
    for field, value in update_fields.items():
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
def delete_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    appointment = get_scoped_appointment(db, current_user, appointment_id)
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    appointment = get_scoped_appointment(db, current_user, appointment_id)
    
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
