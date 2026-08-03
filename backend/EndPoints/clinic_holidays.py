from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pyluach import dates as jewish_dates
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import ClinicHolidayOverride, User
from schemas import CalendarHoliday, ClinicHolidayOverride as ClinicHolidayOverrideSchema
from schemas import ClinicHolidayOverrideCreate, ClinicHolidayOverrideUpdate
from security.scope import normalize_clinic_id_for_company


MANAGER_LEVEL = 3
MIN_SUPPORTED_YEAR = 1900
MAX_SUPPORTED_YEAR = 2200

router = APIRouter(prefix="/clinic-holidays", tags=["clinic-holidays"])


def _require_manager(current_user: User) -> None:
    if (current_user.role_level or 1) < MANAGER_LEVEL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to manage clinic holidays",
        )


def _official_holidays_for_year(year: int) -> dict[date, str]:
    """Return Israeli Jewish calendar observances for every Gregorian date in a year."""
    holidays: dict[date, str] = {}
    current = date(year, 1, 1)
    end = date(year + 1, 1, 1)
    while current < end:
        holiday_name = jewish_dates.GregorianDate(
            current.year,
            current.month,
            current.day,
        ).to_heb().festival(
            israel=True,
            hebrew=True,
            include_working_days=True,
            prefix_day=True,
        )
        if holiday_name:
            holidays[current] = holiday_name
        current += timedelta(days=1)
    return holidays


def _calendar_holidays(db: Session, clinic_id: int, year: int) -> list[CalendarHoliday]:
    official_holidays = _official_holidays_for_year(year)
    start = date(year, 1, 1)
    end = date(year + 1, 1, 1)
    overrides = (
        db.query(ClinicHolidayOverride)
        .filter(ClinicHolidayOverride.clinic_id == clinic_id)
        .filter(ClinicHolidayOverride.holiday_date >= start)
        .filter(ClinicHolidayOverride.holiday_date < end)
        .all()
    )

    result: dict[date, CalendarHoliday] = {
        holiday_date: CalendarHoliday(
            date=holiday_date,
            name=name,
            source="official",
        )
        for holiday_date, name in official_holidays.items()
    }
    for override in overrides:
        result[override.holiday_date] = CalendarHoliday(
            id=override.id,
            date=override.holiday_date,
            name=override.name,
            source="clinic",
        )
    return [result[holiday_date] for holiday_date in sorted(result)]


@router.get("/", response_model=List[CalendarHoliday])
def list_clinic_holidays(
    year: int = Query(..., ge=MIN_SUPPORTED_YEAR, le=MAX_SUPPORTED_YEAR),
    clinic_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scoped_clinic_id = normalize_clinic_id_for_company(db, current_user, clinic_id)
    return _calendar_holidays(db, scoped_clinic_id, year)


@router.post("/", response_model=ClinicHolidayOverrideSchema)
def create_or_replace_clinic_holiday(
    payload: ClinicHolidayOverrideCreate,
    clinic_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_manager(current_user)
    scoped_clinic_id = normalize_clinic_id_for_company(db, current_user, clinic_id)
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Holiday name is required")

    override = (
        db.query(ClinicHolidayOverride)
        .filter(ClinicHolidayOverride.clinic_id == scoped_clinic_id)
        .filter(ClinicHolidayOverride.holiday_date == payload.holiday_date)
        .first()
    )
    if override:
        override.name = name
    else:
        override = ClinicHolidayOverride(
            clinic_id=scoped_clinic_id,
            holiday_date=payload.holiday_date,
            name=name,
        )
        db.add(override)
    db.commit()
    db.refresh(override)
    return override


@router.put("/{holiday_id}", response_model=ClinicHolidayOverrideSchema)
def update_clinic_holiday(
    holiday_id: int,
    payload: ClinicHolidayOverrideUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_manager(current_user)
    override = db.get(ClinicHolidayOverride, holiday_id)
    if not override:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clinic holiday not found")
    normalize_clinic_id_for_company(db, current_user, override.clinic_id)
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Holiday name is required")
    override.name = name
    db.commit()
    db.refresh(override)
    return override


@router.delete("/{holiday_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_clinic_holiday(
    holiday_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_manager(current_user)
    override = db.get(ClinicHolidayOverride, holiday_id)
    if not override:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clinic holiday not found")
    normalize_clinic_id_for_company(db, current_user, override.clinic_id)
    db.delete(override)
    db.commit()
