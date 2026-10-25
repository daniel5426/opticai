"""Immutable proposals; approval-gated commits use one database transaction."""
from datetime import date, timedelta
from fastapi import HTTPException
import schemas
from services.ai_privacy import clean_nested
from models import Order, ContactLensOrder, ExamLayoutInstance, User
from services.clinic_record_mutations import allowed_fields, validate_fields, mutate_record
from services.order_group_service import save_group, group_for_order, group_dict
from security.scope import normalize_user_id
from .authority import patient, writable, positive, owned_change
from .records import MODELS, project, snapshot, json_value
from .models import PreparedChange, FollowupTask, TaskEvent
from .config import now


def editable_catalog():
    return {kind: allowed_fields(kind) for kind in ('clients', 'exams', 'appointments', 'medical_logs', 'referrals')} | {
        'orders': ['client_id', 'order_date', 'type', 'dominant_eye', 'order_data'],
        'contact_lens_orders': sorted(schemas.ContactLensOrderCreate.model_fields.keys() - {'clinic_id', 'user_id', 'supply_in_clinic_id'}),
        'tasks': ['client_id', 'assigned_user_id', 'title', 'notes', 'due_date', 'source', 'status'],
        'exam_measurements': ['client_id', 'exam_id', 'layout_instance_id', 'layout_id', 'exam_data'],
    }


def record(db, authority, kind, record_id):
    model = MODELS[kind]
    query = db.query(model).filter(model.id == record_id, model.clinic_id == authority.clinic_id)
    if hasattr(model, 'deleted_at'):
        query = query.filter(model.deleted_at.is_(None))
    row = query.with_for_update().first()
    if not row:
        raise HTTPException(404, 'agent.recordNotFound')
    if kind == 'clients':
        patient(db, authority, row.id)
    elif row.client_id:
        patient(db, authority, row.client_id)
    return row


def validate_task(db, authority, fields, row=None):
    if set(fields) - set(editable_catalog()['tasks']):
        raise HTTPException(422, 'agent.invalidFields')
    if fields.get('client_id'):
        patient(db, authority, fields['client_id'])
    assignee = fields.get('assigned_user_id', row.assigned_user_id if row else authority.user.id)
    normalize_user_id(db, authority.user, assignee)
    assigned = db.get(User, positive(assignee))
    if not assigned or not assigned.is_active or assigned.clinic_id != authority.clinic_id:
        raise HTTPException(403, 'agent.scopeDenied')
    if authority.user.role_level < 3 and (assignee != authority.user.id or row and row.assigned_user_id != authority.user.id):
        raise HTTPException(403, 'agent.editPermissionRequired')
    if fields.get('source'):
        from .records import source
        value = fields['source']
        if not isinstance(value, dict) or value.get('kind') not in MODELS or not value.get('id'):
            raise HTTPException(422, 'agent.invalidFields')
        linked = record(db, authority, value['kind'], value['id'])
        if fields.get('client_id') and getattr(linked, 'client_id', linked.id if value['kind'] == 'clients' else None) != fields['client_id']:
            raise HTTPException(403, 'agent.patientContextMismatch')
        fields['source'] = source(value['kind'], linked)
    if 'status' in fields and fields['status'] not in {'open', 'completed', 'cancelled'}:
        raise HTTPException(422, 'agent.invalidFields')
    if 'due_date' in fields:
        date.fromisoformat(fields['due_date'])
    if not row and (not fields.get('title') or not fields.get('due_date')):
        raise HTTPException(422, 'agent.missingFields')
    if len(fields.get('title', '')) > 300:
        raise HTTPException(422, 'agent.invalidFields')


def prepare(db, authority, kind, action, fields, record_id=None):
    writable(authority)
    from config import settings
    if settings.SUBSCRIPTION_ENFORCEMENT_MODE == 'enforce':
        from services.subscription_service import ensure_legacy_subscription, access_mode
        if access_mode(ensure_legacy_subscription(db, authority.user.company_id)) != 'full':
            raise HTTPException(403, 'agent.readOnly')
    if not isinstance(fields, dict) or not fields or clean_nested(fields) != fields:
        raise HTTPException(422, 'agent.invalidFields')
    if action == 'update' and kind != 'tasks' and kind != 'exam_measurements':
        record_id = positive(record_id)
    if action not in {'create', 'update'} or kind not in editable_catalog():
        raise HTTPException(422, 'agent.invalidAction')
    if set(fields) - set(editable_catalog()[kind]):
        raise HTTPException(422, 'agent.invalidFields')
    if kind != 'clients' and kind != 'tasks':
        patient(db, authority, fields.get('client_id'))
    expected = {}
    if kind == 'exam_measurements':
        exam = record(db, authority, 'exams', fields.get('exam_id'))
        if exam.client_id != fields['client_id'] or not isinstance(fields.get('exam_data'), dict):
            raise HTTPException(422, 'agent.invalidFields')
        if action == 'create':
            from services.exam_measurement_mutations import template
            layout = template(db, authority.clinic_id, positive(fields.get('layout_id')))
            from hashlib import sha256
            expected = {'layout_digest': sha256(layout.layout_data.encode()).hexdigest()}
        else:
            row = db.query(ExamLayoutInstance).filter_by(id=positive(fields.get('layout_instance_id')), exam_id=exam.id).first()
            if not row:
                raise HTTPException(422, 'agent.recordNotFound')
            expected = {'data': clean_nested(row.exam_data)}
    elif action == 'update':
        row = record(db, authority, kind, record_id)
        if kind != 'clients' and fields.get('client_id') and row.client_id != fields['client_id']:
            raise HTTPException(422, 'agent.identityCannotChange')
        expected = snapshot(row)
        if kind in {'orders', 'contact_lens_orders'}:
            group = group_for_order(db, row.id, kind == 'contact_lens_orders')
            if not group:
                raise HTTPException(409, 'agent.orderGroupRequired')
            expected['group_id'] = group.id
            expected['group_revision'] = group.revision
    if kind == 'tasks':
        validate_task(db, authority, fields, row if action == 'update' else None)
    elif kind not in {'orders', 'contact_lens_orders', 'exam_measurements'}:
        parsed = validate_fields(db, authority.user, authority.clinic_id, kind, action, fields)
        fields = {key: json_value(parsed.get(key, value)) for key, value in fields.items()}
    else:
        if (authority.user.role_level or 1) < 2:
            raise HTTPException(403, 'agent.editPermissionRequired')
        if kind in {'orders', 'contact_lens_orders'}:
            schema = (schemas.ContactLensOrderCreate if kind == 'contact_lens_orders' else schemas.OrderCreate) if action == 'create' else (schemas.ContactLensOrderUpdate if kind == 'contact_lens_orders' else schemas.OrderUpdate)
            parsed = schema.model_validate({**fields, 'clinic_id': authority.clinic_id, 'user_id': authority.user.id})
            fields = {key: value for key, value in parsed.model_dump(mode='json', exclude_unset=True).items() if key in fields}
    if kind in {'orders', 'contact_lens_orders'} and action == 'update' and 'order_data' in fields:
        fields['order_data'] = merge_order_data(expected.get('order_data'), fields['order_data'])
    if kind == 'exam_measurements':
        from services.prism_axis_compatibility import normalize_prism_axis_exam_data
        fields['exam_data'] = normalize_prism_axis_exam_data({**expected.get('data', {}), **fields['exam_data']})
    proposal = PreparedChange(context_id=authority.context_id, kind=kind, action=action,
        payload={'fields': fields, 'record_id': record_id}, expected=expected, expires_at=now() + timedelta(hours=24))
    db.add(proposal)
    db.commit()
    return {'change_id': proposal.id, 'kind': kind, 'action': action, **preview(proposal),
            'requires_approval': True, 'expires_at': proposal.expires_at.isoformat()}


def merge_order_data(before, patch):
    from copy import deepcopy
    merged = deepcopy(before or {})
    for key, value in patch.items():
        if key == 'legacy_source':
            continue
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key].update(value)
        else:
            merged[key] = value
    return merged


def preview(proposal):
    before = {key: value for key, value in proposal.expected.items() if not key.startswith('group_')}
    if proposal.kind == 'exam_measurements':
        before = {'exam_data': before.get('data', {})}
    return {'before': before, 'after': proposal.payload['fields']}


def save_order(db, authority, proposal):
    kind, fields = proposal.kind, proposal.payload['fields']
    contact = kind == 'contact_lens_orders'
    group_id = proposal.expected.get('group_id')
    if group_id:
        from services.order_group_service import get_group
        group = get_group(db, authority.user, group_id, lock=True)
        if group.revision != proposal.expected['group_revision']:
            raise HTTPException(409, 'agent.staleChange')
        payload = group_dict(db, group)
        payload['revision'] = group.revision
        for entry in payload['entries']:
            if entry['order']['id'] == proposal.payload['record_id'] and entry['kind'] == ('contact' if contact else 'regular'):
                updated = dict(fields)
                if 'order_data' in updated:
                    updated['order_data'] = merge_order_data(entry['order'].get('order_data'), updated['order_data'])
                entry['order'].update(updated)
    else:
        payload = {'clinic_id': authority.clinic_id, 'payer_client_id': fields['client_id'],
                   'entries': [{'kind': 'contact' if contact else 'regular', 'order': fields}]}
    return save_group(db, authority.user, payload, group_id=group_id, creation_key=proposal.id, commit=False)


def approve(db, authority, change_id):
    """Only the authenticated product approval action can grant this receipt."""
    writable(authority)
    proposal = owned_change(db, authority, change_id, lock=True)
    if not proposal or proposal.status not in {'prepared', 'approved'}:
        raise HTTPException(409, 'agent.approvalUnavailable')
    expiry = proposal.expires_at
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=now().tzinfo)
    if expiry <= now():
        raise HTTPException(409, 'agent.expiredChange')
    if proposal.status == 'prepared':
        proposal.status = 'approved'
        proposal.result = {'approval': {'user_id': authority.user.id, 'at': now().isoformat()}}
        db.commit()
    return {'status': proposal.status}


def commit(db, authority, change_id):
    writable(authority)
    from config import settings
    if settings.SUBSCRIPTION_ENFORCEMENT_MODE == 'enforce':
        from services.subscription_service import ensure_legacy_subscription, access_mode
        if access_mode(ensure_legacy_subscription(db, authority.user.company_id)) != 'full':
            raise HTTPException(403, 'agent.readOnly')
    proposal = owned_change(db, authority, change_id, lock=True)
    if not proposal:
        raise HTTPException(404, 'agent.recordNotFound')
    if proposal.status == 'committed':
        return proposal.result
    if proposal.status != 'approved' or (proposal.result or {}).get('approval', {}).get('user_id') != authority.user.id:
        raise HTTPException(403, 'agent.approvalRequired')
    expiry = proposal.expires_at
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=now().tzinfo)
    if expiry <= now():
        raise HTTPException(409, 'agent.expiredChange')
    kind, fields, record_id = proposal.kind, proposal.payload['fields'], proposal.payload['record_id']
    if kind != 'clients' and fields.get('client_id'):
        patient(db, authority, fields['client_id'])
    if proposal.action == 'update' and kind != 'exam_measurements':
        row = record(db, authority, kind, record_id)
        before = {k: v for k, v in proposal.expected.items() if not k.startswith('group_')}
        if snapshot(row) != before:
            raise HTTPException(409, 'agent.staleChange')
    if kind in {'orders', 'contact_lens_orders', 'exam_measurements'} and (authority.user.role_level or 1) < 2:
        raise HTTPException(403, 'agent.editPermissionRequired')
    if kind in {'orders', 'contact_lens_orders'}:
        result = save_order(db, authority, proposal)
    elif kind == 'tasks':
        row = record(db, authority, kind, record_id) if proposal.action == 'update' else None
        validate_task(db, authority, fields, row)
        values = {**fields}
        if 'due_date' in values:
            values['due_date'] = date.fromisoformat(values['due_date'])
        if row:
            for key, value in values.items():
                setattr(row, key, value)
            row.revision += 1
            row.updated_at = now()
        else:
            row = FollowupTask(**{'assigned_user_id': authority.user.id, **values},
                              clinic_id=authority.clinic_id, created_by_user_id=authority.user.id)
            db.add(row)
        db.flush()
        db.add(TaskEvent(task_id=row.id, user_id=authority.user.id, change=fields))
        result = project(row, 'tasks')
    elif kind == 'exam_measurements':
        from services.exam_measurement_mutations import save
        result = save(db, authority.user, authority.clinic_id, fields['exam_id'], fields, proposal.expected, proposal.action)
    else:
        row = mutate_record(db, authority.user, authority.clinic_id, kind, proposal.action, fields, record_id)
        result = project(row, kind)
    from .records import json_value
    proposal.result = {**json_value(result), 'approval': proposal.result['approval']}
    proposal.status = 'committed'
    db.commit()
    return proposal.result
