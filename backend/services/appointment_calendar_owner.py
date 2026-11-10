"""Compatibility entry point: enqueue Calendar intent; the API consumer owns I/O."""
from services.google_calendar import enqueue


def reconcile(db, appointment, actor, previous_owner_id=None, previous_event_id=None):
    enqueue(db, appointment, previous_owner_id, previous_event_id)
