"""Open calendars poll their clinic's calendar revision, so every appointment write moves it.

The revision began as Google Calendar's pull counter; it now counts any change to a clinic's
appointments, from the API, the agent, the trash or Google, so another computer showing that
clinic's calendar reloads it within one poll.
"""
from sqlalchemy import event, inspect
from sqlalchemy.orm import Session


def install_calendar_revision():
    if not event.contains(Session, "before_flush", bump_calendar_revision):
        event.listen(Session, "before_flush", bump_calendar_revision)


def changed_clinic_ids(db) -> set[int]:
    """The clinics whose appointments or general events this flush adds, changes or removes."""
    from models import Appointment, CalendarEvent

    clinic_ids = set()
    for row in [*db.new, *db.dirty, *db.deleted]:
        if not isinstance(row, (Appointment, CalendarEvent)):
            continue
        if row in db.dirty and row not in db.deleted:
            state = inspect(row)
            # The worker may write a provider event ID without changing the calendar.
            if not any(
                state.attrs[column.key].history.has_changes()
                for column in state.mapper.column_attrs
                if column.key != "google_calendar_event_id"
            ):
                continue
            clinic_ids.update(id_ for id_ in state.attrs.clinic_id.history.deleted if id_ is not None)
        if row.clinic_id:
            clinic_ids.add(row.clinic_id)
    return clinic_ids


def bump_calendar_revision(db, flush_context, instances):
    clinic_ids = changed_clinic_ids(db)
    if not clinic_ids:
        return
    from models import Clinic

    with db.no_autoflush:
        for clinic_id in sorted(clinic_ids):
            clinic = db.get(Clinic, clinic_id)
            if clinic is not None:
                # In SQL, so writers on other servers never overwrite each other's increments.
                clinic.google_calendar_revision = Clinic.google_calendar_revision + 1
