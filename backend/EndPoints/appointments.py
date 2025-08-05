from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from database import get_db
from models import Appointment, Client, User
from schemas import AppointmentCreate, AppointmentUpdate, Appointment as AppointmentSchema
from auth import get_current_user

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
        print(f"Current user: {current_user.username} (role: {current_user.role})")
        
        if not appointment.client_id:
            raise HTTPException(status_code=422, detail="client_id is required")
        
        client = db.query(Client).filter(Client.id == appointment.client_id).first()
        if not client:
            raise HTTPException(status_code=422, detail=f"Client with id {appointment.client_id} not found")
        
        if appointment.user_id:
            user = db.query(User).filter(User.id == appointment.user_id).first()
            if not user:
                raise HTTPException(status_code=422, detail=f"User with id {appointment.user_id} not found")
        
        # Set clinic_id if not provided
        if not appointment.clinic_id:
            appointment.clinic_id = current_user.clinic_id
        
        # Set user_id if not provided
        if not appointment.user_id:
            appointment.user_id = current_user.id
        
        # Apply role-based access control
        if current_user.role == "company_ceo":
            # CEO can create appointments in any clinic
            pass
        elif current_user.role == "clinic_manager":
            # Clinic manager can only create appointments in their clinic
            if appointment.clinic_id != current_user.clinic_id:
                raise HTTPException(status_code=403, detail="Can only create appointments in your clinic")
        else:
            # Other users can only create appointments in their clinic
            if appointment.clinic_id != current_user.clinic_id:
                raise HTTPException(status_code=403, detail="Can only create appointments in your clinic")
        
        print(f"Creating appointment with final data: {appointment.dict()}")
        db_appointment = Appointment(**appointment.dict())
        db.add(db_appointment)
        db.commit()
        db.refresh(db_appointment)
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

@router.get("/{appointment_id}", response_model=AppointmentSchema)
def get_appointment(appointment_id: int, db: Session = Depends(get_db)):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appointment

@router.get("/", response_model=List[AppointmentSchema])
def get_all_appointments(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    db: Session = Depends(get_db)
):
    query = db.query(Appointment)
    if clinic_id:
        query = query.filter(Appointment.clinic_id == clinic_id)
    return query.all()

@router.get("/client/{client_id}", response_model=List[AppointmentSchema])
def get_appointments_by_client(client_id: int, db: Session = Depends(get_db)):
    appointments = db.query(Appointment).filter(Appointment.client_id == client_id).all()
    return appointments

@router.get("/user/{user_id}", response_model=List[AppointmentSchema])
def get_appointments_by_user(user_id: int, db: Session = Depends(get_db)):
    appointments = db.query(Appointment).filter(Appointment.user_id == user_id).all()
    return appointments

@router.put("/{appointment_id}", response_model=AppointmentSchema)
def update_appointment(appointment_id: int, appointment: AppointmentUpdate, db: Session = Depends(get_db)):
    db_appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not db_appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    for field, value in appointment.dict(exclude_unset=True).items():
        setattr(db_appointment, field, value)
    
    db.commit()
    db.refresh(db_appointment)
    return db_appointment

@router.delete("/{appointment_id}")
def delete_appointment(appointment_id: int, db: Session = Depends(get_db)):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    db.delete(appointment)
    db.commit()
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
    return {"message": "Google event ID updated successfully"} 