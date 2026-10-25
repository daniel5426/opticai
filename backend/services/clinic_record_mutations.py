"""Transactional record writer shared by agent actions; caller owns commit."""
from fastapi import HTTPException
from datetime import datetime
from sqlalchemy import inspect
from models import Client, Family, OpticalExam, Appointment, MedicalLog, Referral, User
from security.scope import get_scoped_client, assert_clinic_scope, normalize_user_id
import schemas
from services.prism_axis_compatibility import normalize_prism_axis_exam_data
from services.prescription_search_index import rebuild_referral_index, rebuild_exam_instance_index
from agent.config import now

RECORD_TYPES = {
    'clients': (Client, schemas.ClientCreate, schemas.ClientUpdate),
    'exams': (OpticalExam, schemas.OpticalExamCreate, schemas.OpticalExamUpdate),
    'appointments': (Appointment, schemas.AppointmentCreate, schemas.AppointmentUpdate),
    'medical_logs': (MedicalLog, schemas.MedicalLogCreate, schemas.MedicalLogUpdate),
    'referrals': (Referral, schemas.ReferralCreate, schemas.ReferralUpdate),
}
PROTECTED = {'id', 'company_id', 'clinic_id', 'user_id', 'deleted_at', 'deleted_by_user_id',
             'trash_item_id', 'profile_picture', 'hidden_note', 'google_calendar_event_id',
             'merged_into_client_id', 'merged_at', 'merged_by_user_id', 'merge_snapshot'}


def allowed_fields(kind):
    model, create, update = RECORD_TYPES[kind]
    fields = set(create.model_fields) - PROTECTED - {key for key in create.model_fields if key.startswith('ai_')}
    if kind == 'appointments':
        fields.add('assigned_user_id')
    return sorted(fields)


def validate_fields(db, user, clinic_id, kind, action, fields):
    if (user.role_level or 1) < 2:
        raise HTTPException(403, 'agent.editPermissionRequired')
    assert_clinic_scope(db, user, clinic_id)
    if not fields or set(fields) - set(allowed_fields(kind)):
        raise HTTPException(422, 'agent.invalidFields')
    if kind != 'clients':
        target = get_scoped_client(db, user, fields.get('client_id'))
        if target.clinic_id != clinic_id:
            raise HTTPException(403, 'agent.scopeDenied')
    if fields.get('family_id'):
        family = db.get(Family, fields['family_id'])
        if not family or family.clinic_id != clinic_id:
            raise HTTPException(403, 'agent.scopeDenied')
    model, create, update = RECORD_TYPES[kind]
    forced = {'clinic_id': clinic_id}
    if kind == 'clients':
        forced['company_id'] = user.company_id
    else:
        forced['user_id'] = user.id
        if kind == 'appointments' and fields.get('assigned_user_id'):
            from agent.authority import positive
            selected = db.get(User, positive(fields['assigned_user_id']))
            if not selected or not selected.is_active or selected.clinic_id != clinic_id or user.role_level < 3 and selected.id != user.id:
                raise HTTPException(403, 'agent.scopeDenied')
            forced['user_id'] = selected.id
    parsed = (create if action == 'create' else update).model_validate({**fields, **forced})
    # Scope is server-owned even when a public schema omits company_id/user_id.
    return {**parsed.model_dump(exclude_unset=action != 'create'), **forced}


def mutate_record(db, user, clinic_id, kind, action, fields, record_id=None):
    payload = validate_fields(db, user, clinic_id, kind, action, fields)
    model = RECORD_TYPES[kind][0]
    if action == 'update':
        row = db.query(model).filter(model.id == record_id, model.clinic_id == clinic_id).with_for_update().first()
        if not row:
            raise HTTPException(404, 'agent.recordNotFound')
        if kind != 'clients' and row.client_id != fields['client_id']:
            raise HTTPException(422, 'agent.identityCannotChange')
        for key, value in payload.items():
            if key not in {'clinic_id', 'company_id', 'user_id'}:
                setattr(row, key, value)
    else:
        row = model(**payload)
        db.add(row)
    if kind == 'appointments':
        if isinstance(row.date, datetime):
            row.date = row.date.date()
        if 'assigned_user_id' in fields:
            row.user_id = payload['user_id']
        from services.appointment_schedule import available
        # A new pending row must not autoflush into its own conflict query.
        with db.no_autoflush:
            slot_available = bool(row.date and row.time and available(db, clinic_id,
                row.user_id or user.id, row.date, row.time, row.duration or 30, exclude=row.id, lock=True))
        if not slot_available:
            raise HTTPException(409, 'agent.slotUnavailable')
    db.flush()
    if kind == 'clients':
        client = row
    else:
        client = db.get(Client, row.client_id)
    client.client_updated_date = now()
    for part in ('exam', 'order', 'referral', 'appointment', 'medical', 'file', 'contact_lens'):
        setattr(client, f'ai_{part}_state', None)
    if kind == 'referrals':
        rebuild_referral_index(db, row)
    return row
