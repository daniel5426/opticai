"""Keep scan badges compatible with clients unaware of selection provenance."""
import json

def preserve_provenance(previous, incoming):
    if not isinstance(incoming, dict):
        return incoming
    previous = previous if isinstance(previous, dict) else {}
    result = dict(incoming)
    for key, value in tuple(result.items()):
        if isinstance(value, dict):
            result[key] = preserve_provenance(previous.get(key), value)
    raw = incoming.get('_scan_provenance', previous.get('_scan_provenance'))
    if raw is None and all(result[key] is value for key, value in incoming.items()):
        return incoming
    try:
        metadata = json.loads(raw) if isinstance(raw, str) else raw
        if not isinstance(metadata, dict):
            metadata = {}
        valid = {slot: entry for slot, entry in metadata.items() if isinstance(entry, dict)
            and isinstance(entry.get('fields'), dict) and entry['fields']
            and all(str(result.get(key) if result.get(key) is not None else '') == str(value if value is not None else '') for key, value in entry['fields'].items())}
    except (ValueError, TypeError):
        valid = {}
    if raw is not None:
        result['_scan_provenance'] = json.dumps(valid, ensure_ascii=False)
    return result


def install_provenance_preservation():
    from sqlalchemy import event, inspect, select
    from sqlalchemy.orm import Session
    from models import Order, ContactLensOrder, ExamLayoutInstance
    fields = {Order: 'order_data', ContactLensOrder: 'order_data', ExamLayoutInstance: 'exam_data'}
    @event.listens_for(Session, 'before_flush')
    def preserve(session, *_):
        for obj in session.dirty:
            field = fields.get(type(obj))
            if not field or not inspect(obj).attrs[field].history.has_changes():
                continue
            previous = session.connection().execute(select(getattr(type(obj), field)).where(type(obj).id == obj.id)).scalar_one_or_none()
            setattr(obj, field, preserve_provenance(previous, getattr(obj, field)))
