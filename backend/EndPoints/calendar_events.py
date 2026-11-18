"""General calendar events: free text at a time, with no client."""
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.orm import Session
from auth import get_current_user
from database import get_db
from models import CalendarEvent, User
from security.scope import assert_record_clinic, get_scoped_user, normalize_record_clinic, resolve_company_id

router = APIRouter(prefix="/calendar-events", tags=["calendar-events"])


class CalendarEventIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    clinic_id: Optional[int] = None
    user_id: Optional[int] = None
    date: date
    time: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    duration: int = Field(default=30, ge=5, le=24 * 60)
    text: str = Field(max_length=2000)

    @field_validator("text")
    @classmethod
    def has_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("text is required")
        return value


def serialize(row: CalendarEvent) -> dict:
    return {"id": row.id, "clinic_id": row.clinic_id, "user_id": row.user_id, "date": row.date.isoformat(),
            "time": row.time, "duration": row.duration, "text": row.text}


def scoped_event(db: Session, user: User, event_id: int, *, write: bool = False) -> CalendarEvent:
    row = db.get(CalendarEvent, event_id)
    if row is None or row.company_id != resolve_company_id(db, user):
        raise HTTPException(404, "Event not found")
    assert_record_clinic(db, user, row.clinic_id, write=write)
    return row


def events_in_range(db: Session, clinic_id: int, start: Optional[date], end: Optional[date]) -> list[dict]:
    query = db.query(CalendarEvent).filter(CalendarEvent.clinic_id == clinic_id)
    if start is not None:
        query = query.filter(CalendarEvent.date >= start)
    if end is not None:
        query = query.filter(CalendarEvent.date <= end)
    return [serialize(row) for row in query.order_by(CalendarEvent.date, CalendarEvent.time, CalendarEvent.id)]


@router.get("")
def list_events(clinic_id: int, start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None),
                db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    assert_record_clinic(db, current_user, clinic_id)
    return events_in_range(db, clinic_id, start_date, end_date)


@router.post("")
def create_event(payload: CalendarEventIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    clinic_id = normalize_record_clinic(db, current_user, payload.clinic_id)
    if payload.user_id is not None:
        get_scoped_user(db, current_user, payload.user_id)
    row = CalendarEvent(**payload.model_dump(exclude={"clinic_id"}), clinic_id=clinic_id,
                        company_id=resolve_company_id(db, current_user))
    db.add(row)
    db.commit()
    db.refresh(row)
    return serialize(row)


@router.put("/{event_id}")
def update_event(event_id: int, payload: CalendarEventIn, db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    row = scoped_event(db, current_user, event_id, write=True)
    if payload.clinic_id is not None and payload.clinic_id != row.clinic_id:
        raise HTTPException(400, "An event cannot move to another clinic")
    if payload.user_id is not None:
        get_scoped_user(db, current_user, payload.user_id)
    for key, value in payload.model_dump(exclude={"clinic_id"}).items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return serialize(row)


@router.delete("/{event_id}")
def delete_event(event_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.delete(scoped_event(db, current_user, event_id, write=True))
    db.commit()
    return {"status": "deleted"}
