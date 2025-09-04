from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date
from database import get_db
from models import Appointment, Client, User, Settings
from auth import get_current_user
from sqlalchemy import and_

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/home")
def get_home_dashboard(
    clinic_id: int = Query(..., description="Clinic ID for scoping"),
    start_date: Optional[date] = Query(None, description="Start date (inclusive) in YYYY-MM-DD"),
    end_date: Optional[date] = Query(None, description="End date (inclusive) in YYYY-MM-DD"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Authorization and clinic scoping
    if current_user.role != "company_ceo":
        if not current_user.clinic_id or current_user.clinic_id != clinic_id:
            raise HTTPException(status_code=403, detail="Access denied for this clinic")

    # Appointments in range with only required fields
    filters = [Appointment.clinic_id == clinic_id]
    if start_date is not None:
        filters.append(Appointment.date >= start_date)
    if end_date is not None:
        filters.append(Appointment.date <= end_date)

    appts_rows = (
        db.query(
            Appointment.id,
            Appointment.client_id,
            Appointment.user_id,
            Appointment.date,
            Appointment.time,
            Appointment.duration,
            Appointment.exam_name,
            Appointment.note,
        )
        .filter(and_(*filters))
        .order_by(Appointment.date.asc(), Appointment.time.asc())
        .all()
    )
    appointments = [
        {
            "id": r.id,
            "client_id": r.client_id,
            "user_id": r.user_id,
            "date": r.date.isoformat() if r.date else None,
            "time": r.time,
            "duration": r.duration,
            "exam_name": r.exam_name,
            "note": r.note,
        }
        for r in appts_rows
    ]

    # Minimal clients referenced by the appointments
    client_ids = {r.client_id for r in appts_rows if r.client_id is not None}
    clients = []
    if client_ids:
        rows = (
            db.query(
                Client.id,
                Client.first_name,
                Client.last_name,
                Client.phone_mobile,
                Client.file_creation_date,
            )
            .filter(Client.id.in_(client_ids))
            .all()
        )
        clients = [
            {
                "id": r.id,
                "first_name": r.first_name,
                "last_name": r.last_name,
                "phone_mobile": r.phone_mobile,
                "file_creation_date": r.file_creation_date.isoformat() if r.file_creation_date else None,
            }
            for r in rows
        ]

    # Settings (only one per clinic)
    s = (
        db.query(
            Settings.id,
            Settings.work_start_time,
            Settings.work_end_time,
            Settings.appointment_duration,
            Settings.break_start_time,
            Settings.break_end_time,
        )
        .filter(Settings.clinic_id == clinic_id)
        .order_by(Settings.id.desc())
        .first()
    )
    settings = None
    if s:
        settings = {
            "id": s.id,
            "work_start_time": s.work_start_time,
            "work_end_time": s.work_end_time,
            "appointment_duration": s.appointment_duration,
            "break_start_time": s.break_start_time,
            "break_end_time": s.break_end_time,
        }

    # Users of the clinic with minimal fields required by the dashboard
    users_rows = (
        db.query(
            User.id,
            User.full_name,
            User.username,
            User.role,
            User.primary_theme_color,
            User.system_vacation_dates,
            User.added_vacation_dates,
        )
        .filter(User.clinic_id == clinic_id)
        .order_by(User.id.asc())
        .all()
    )
    users = [
        {
            "id": r.id,
            "full_name": r.full_name,
            "username": r.username,
            "role": r.role,
            "primary_theme_color": r.primary_theme_color,
            "system_vacation_dates": r.system_vacation_dates or [],
            "added_vacation_dates": r.added_vacation_dates or [],
        }
        for r in users_rows
    ]

    return {
        "appointments": appointments,
        "clients": clients,
        "settings": settings,
        "users": users,
    }


