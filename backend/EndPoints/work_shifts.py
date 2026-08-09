from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import date as date_type
from typing import Any, Dict, List, Optional
from database import get_db
from models import WorkShift, User, Clinic
from schemas import WorkShiftCreate, WorkShiftUpdate, WorkShift as WorkShiftSchema, WorkforceAnalyticsResponse
from auth import get_current_user
from security.scope import get_scoped_user, resolve_company_id
from services.analytics_service import add_to_series, empty_series, metric_payload, resolve_analytics_window

router = APIRouter(prefix="/work-shifts", tags=["work-shifts"])


@router.get("/analytics/{user_id}", response_model=WorkforceAnalyticsResponse)
def get_workforce_analytics(
    user_id: int,
    start_date: date_type | None = None,
    end_date: date_type | None = None,
    bucket: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    get_scoped_user(db, current_user, user_id)
    window = resolve_analytics_window(start_date, end_date, bucket)
    rows = (
        db.query(WorkShift)
        .filter(
            WorkShift.user_id == user_id,
            WorkShift.date >= window.previous_start.isoformat(),
            WorkShift.date <= window.end_date.isoformat(),
        )
        .all()
    )
    current = [row for row in rows if window.start_date.isoformat() <= row.date <= window.end_date.isoformat()]
    previous = [row for row in rows if window.previous_start.isoformat() <= row.date <= window.previous_end.isoformat()]
    series = empty_series(window, ("minutes", "shifts", "active_days"))
    current_dates: set[str] = set()
    for shift in current:
        minutes = max(0, int(shift.duration_minutes or 0))
        add_to_series(series, window, shift.date, "minutes", minutes)
        add_to_series(series, window, shift.date, "shifts", 1)
        if shift.date not in current_dates:
            add_to_series(series, window, shift.date, "active_days", 1)
            current_dates.add(shift.date)

    current_minutes = sum(max(0, int(row.duration_minutes or 0)) for row in current)
    previous_minutes = sum(max(0, int(row.duration_minutes or 0)) for row in previous)
    current_days = len({row.date for row in current})
    previous_days = len({row.date for row in previous})
    current_average = current_minutes / len(current) if current else 0
    previous_average = previous_minutes / len(previous) if previous else 0
    average_series = [
        {
            "bucket": point["bucket"],
            "label": point["label"],
            "average_minutes": round(point["minutes"] / point["shifts"], 1) if point["shifts"] else 0,
        }
        for point in series
    ]
    metrics = [
        metric_payload("total_minutes", "סה״כ שעות", current_minutes, previous_minutes, series, series_field="minutes"),
        metric_payload("shifts", "משמרות", len(current), len(previous), series, series_field="shifts"),
        metric_payload("active_days", "ימי עבודה", current_days, previous_days, series, series_field="active_days"),
        metric_payload(
            "average_minutes",
            "ממוצע למשמרת",
            current_average,
            previous_average,
            average_series,
            series_field="average_minutes",
        ),
    ]
    return {
        "range": {
            "start_date": window.start_date,
            "end_date": window.end_date,
            "previous_start": window.previous_start,
            "previous_end": window.previous_end,
            "bucket": window.bucket,
        },
        "metrics": metrics,
        "series": series,
    }

@router.post("/", response_model=WorkShiftSchema)
def create_work_shift(
    work_shift: WorkShiftCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_scoped_user(db, current_user, work_shift.user_id)
    db_work_shift = WorkShift(**work_shift.dict())
    db.add(db_work_shift)
    db.commit()
    db.refresh(db_work_shift)
    return db_work_shift

@router.get("/{work_shift_id}", response_model=WorkShiftSchema)
def get_work_shift(
    work_shift_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    work_shift = db.query(WorkShift).filter(WorkShift.id == work_shift_id).first()
    if not work_shift:
        raise HTTPException(status_code=404, detail="Work shift not found")
    get_scoped_user(db, current_user, work_shift.user_id)
    return work_shift

@router.get("/", response_model=List[WorkShiftSchema])
def get_all_work_shifts(
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(WorkShift)
    if user_id:
        get_scoped_user(db, current_user, user_id)
        query = query.filter(WorkShift.user_id == user_id)
    else:
        if (current_user.role_level or 1) >= 4:
            company_id = resolve_company_id(db, current_user)
            company_user_ids = [
                row[0]
                for row in (
                    db.query(User.id)
                    .outerjoin(Clinic, User.clinic_id == Clinic.id)
                    .filter((User.company_id == company_id) | (Clinic.company_id == company_id))
                    .all()
                )
            ]
            query = query.filter(WorkShift.user_id.in_(company_user_ids))
        elif (current_user.role_level or 1) < 3:
            query = query.filter(WorkShift.user_id == current_user.id)
        elif current_user.clinic_id:
            clinic_user_ids = [row[0] for row in db.query(User.id).filter(User.clinic_id == current_user.clinic_id).all()]
            query = query.filter(WorkShift.user_id.in_(clinic_user_ids))
    return query.all()

@router.get("/user/{user_id}", response_model=List[WorkShiftSchema])
def get_work_shifts_by_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_scoped_user(db, current_user, user_id)
    work_shifts = db.query(WorkShift).filter(WorkShift.user_id == user_id).all()
    return work_shifts

@router.get("/user/{user_id}/active", response_model=Optional[WorkShiftSchema])
def get_active_work_shift_by_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_scoped_user(db, current_user, user_id)
    work_shift = db.query(WorkShift).filter(
        WorkShift.user_id == user_id,
        WorkShift.status == "active"
    ).first()
    return work_shift

@router.get("/user/{user_id}/month/{year}/{month}", response_model=List[WorkShiftSchema])
def get_work_shifts_by_user_and_month(
    user_id: int, 
    year: int, 
    month: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_scoped_user(db, current_user, user_id)
    work_shifts = db.query(WorkShift).filter(
        WorkShift.user_id == user_id,
        WorkShift.date.like(f"{year:04d}-{month:02d}%")
    ).all()
    return work_shifts

@router.get("/user/{user_id}/date/{date}", response_model=List[WorkShiftSchema])
def get_work_shifts_by_user_and_date(
    user_id: int, 
    date: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_scoped_user(db, current_user, user_id)
    work_shifts = db.query(WorkShift).filter(
        WorkShift.user_id == user_id,
        WorkShift.date == date
    ).all()
    return work_shifts

@router.put("/{work_shift_id}", response_model=WorkShiftSchema)
def update_work_shift(
    work_shift_id: int,
    work_shift: WorkShiftUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_work_shift = db.query(WorkShift).filter(WorkShift.id == work_shift_id).first()
    if not db_work_shift:
        raise HTTPException(status_code=404, detail="Work shift not found")
    get_scoped_user(db, current_user, db_work_shift.user_id)
    if work_shift.user_id is not None:
        get_scoped_user(db, current_user, work_shift.user_id)
    
    for field, value in work_shift.dict(exclude_unset=True).items():
        setattr(db_work_shift, field, value)
    
    db.commit()
    db.refresh(db_work_shift)
    return db_work_shift

@router.delete("/{work_shift_id}")
def delete_work_shift(
    work_shift_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    work_shift = db.query(WorkShift).filter(WorkShift.id == work_shift_id).first()
    if not work_shift:
        raise HTTPException(status_code=404, detail="Work shift not found")
    get_scoped_user(db, current_user, work_shift.user_id)
    
    db.delete(work_shift)
    db.commit()
    return {"message": "Work shift deleted successfully"}

@router.get("/user/{user_id}/stats/{year}/{month}")
def get_work_shift_stats(
    user_id: int,
    year: int,
    month: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_scoped_user(db, current_user, user_id)
    work_shifts = db.query(WorkShift).filter(
        WorkShift.user_id == user_id,
        WorkShift.date.like(f"{year:04d}-{month:02d}%")
    ).all()
    
    total_shifts = len(work_shifts)
    total_minutes = sum(shift.duration_minutes or 0 for shift in work_shifts)
    average_minutes = total_minutes / total_shifts if total_shifts > 0 else 0
    
    return {
        "total_shifts": total_shifts,
        "total_minutes": total_minutes,
        "average_minutes": average_minutes
    }
