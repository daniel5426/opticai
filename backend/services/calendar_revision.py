"""Open calendars poll their clinic's calendar revision, so every appointment write moves it.

The revision began as Google Calendar's pull counter; it now counts any change to a clinic's
appointments, from the API, the agent, the trash or Google, so another computer showing that
clinic's calendar reloads it within one poll.
"""
from sqlalchemy import event
from sqlalchemy.orm import Session


def install_calendar_revision():
    if not event.contains(Session, "before_flush", bump_calendar_revision):
        event.listen(Session, "before_flush", bump_calendar_revision)


def changed_clinic_ids(db) -> set:
    """The clinics whose appointments this flush adds, changes or removes."""
    from models import Appointment

    clinic_ids = set()
    for row in [*db.new, *db.dirty, *db.deleted]:
        if not isinstance(row, Appointment):
            continue
        if row in db.dirty and not db.is_modified(row):
            continue
        if row.clinic_id:
            clinic_ids.add(row.clinic_id)
    return clinic_ids


def bump_calendar_revision(db, flush_context, instances):
    clinic_ids = changed_clinic_ids(db)
    if not clinic_ids:
        return
    from models import Clinic

    with db.no_autoflush:
        for clinic_id in clinic_ids:
            clinic = db.get(Clinic, clinic_id)
            if clinic is not None:
                # In SQL, so writers on other servers never overwrite each other's increments.
                clinic.google_calendar_revision = Clinic.google_calendar_revision + 1
