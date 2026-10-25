"""Clinic calendar constraints and duration-aware appointment conflicts."""
import json
from datetime import date, datetime, timedelta
from fastapi import HTTPException
from models import Appointment, Clinic, Settings, User, ClinicHolidayOverride


def minute(value):
    parsed = datetime.strptime(value, '%H:%M')
    return parsed.hour * 60 + parsed.minute


def vacation(user, day):
    for item in [*(user.system_vacation_dates or []), *(user.added_vacation_dates or [])]:
        if isinstance(item, str) and item[:10] == day.isoformat():
            return True
        if isinstance(item, dict):
            start = item.get('start') or item.get('start_date') or item.get('date')
            end = item.get('end') or item.get('end_date') or start
            if start and start[:10] <= day.isoformat() <= end[:10]:
                return True
    return False


def available(db, clinic_id, user_id, day, at, duration, exclude=None, lock=False):
    if lock:
        db.query(Clinic).filter_by(id=clinic_id).with_for_update().one()
    user = db.query(User).filter_by(id=user_id, company_id=db.get(Clinic, clinic_id).company_id, is_active=True).first()
    if not user or user.clinic_id not in (None, clinic_id):
        raise HTTPException(403, 'agent.scopeDenied')
    settings = db.query(Settings).filter_by(clinic_id=clinic_id).first()
    start, end = minute(at), minute(at) + duration
    if not 1 <= duration <= 1440 or end > 1440 or vacation(user, day):
        return False
    if settings:
        if start < minute(settings.work_start_time or '08:00') or end > minute(settings.work_end_time or '18:00'):
            return False
        if settings.break_start_time and settings.break_end_time:
            if start < minute(settings.break_end_time) and end > minute(settings.break_start_time):
                return False
        if settings.working_days:
            try:
                days = json.loads(settings.working_days)
            except (TypeError, ValueError):
                raise HTTPException(422, 'agent.invalidCalendarConfiguration') from None
            # Prysm stores JavaScript weekday numbers, Sunday=0.
            weekday = (day.weekday() + 1) % 7
            if isinstance(days, list) and weekday not in [int(item) for item in days]:
                return False
    from EndPoints.clinic_holidays import _calendar_holidays
    if any(item.date == day for item in _calendar_holidays(db, clinic_id, day.year)):
        return False
    return conflict_free(db, clinic_id, user_id, day, at, duration, exclude=exclude)


def conflict_free(db, clinic_id, user_id, day, at, duration, exclude=None, lock=False):
    if lock:
        db.query(Clinic).filter_by(id=clinic_id).with_for_update().one()
    if isinstance(day, datetime):
        day = day.date()
    start, end = minute(at), minute(at) + duration
    query = db.query(Appointment).filter(Appointment.deleted_at.is_(None), Appointment.clinic_id == clinic_id, Appointment.user_id == user_id, Appointment.date == day)
    if exclude:
        query = query.filter(Appointment.id != exclude)
    for row in query:
        if row.time and start < minute(row.time) + (row.duration or 30) and end > minute(row.time):
            return False
    return True


def find_slots(db, authority, start_date, end_date, user_id=None, duration=30, limit=20):
    first, last = date.fromisoformat(start_date), date.fromisoformat(end_date)
    if last < first or (last - first).days > 90:
        raise HTTPException(422, 'agent.invalidDateRange')
    user_id = user_id or authority.user.id
    settings = db.query(Settings).filter_by(clinic_id=authority.clinic_id).first()
    slots = []
    day = first
    while day <= last:
        beginning = minute(settings.work_start_time or '08:00') if settings else 480
        ending = minute(settings.work_end_time or '18:00') if settings else 1080
        for at in range(beginning, ending, 15):
            clock = f'{at // 60:02d}:{at % 60:02d}'
            if available(db, authority.clinic_id, user_id, day, clock, duration):
                slots.append({'date': day.isoformat(), 'time': clock, 'duration': duration, 'user_id': user_id})
                if len(slots) >= limit:
                    return {'slots': slots, 'bounded': True, 'checked_until': day.isoformat()}
        day += timedelta(days=1)
    return {'slots': slots, 'bounded': False}
