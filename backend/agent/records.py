"""Canonical, explicitly projected patient records and optical comparisons."""
from datetime import date, datetime
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import inspect, or_
from models import (Client, Appointment, OpticalExam, ExamLayoutInstance, Order, ContactLensOrder,
                    Referral, MedicalLog, File, Settings, User, ClinicHolidayOverride)
from services.ai_privacy import clean_nested, CLIENT_FIELDS, RECORD_FIELDS
from .authority import patient
from .models import FollowupTask

from services.clinic_catalog import FIELDS, scoped_query, MODELS as CATALOG_MODELS
MODELS = {key: model for key, model in CATALOG_MODELS.items() if key not in {'families', 'campaigns', 'measurements'}}

def json_value(value):
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return clean_nested(value)


def project(row, kind):
    return {key: json_value(getattr(row, key)) for key in FIELDS[kind] if hasattr(row, key)}


def source(kind, row):
    client_id = row.id if kind == 'clients' else getattr(row, 'client_id', None)
    detail = {'exams': 'exams', 'orders': 'orders', 'referrals': 'referrals'}
    tabs = {'medical_logs': 'medical', 'contact_lens_orders': 'orders', 'appointments': 'appointments', 'files': 'files', 'tasks': 'details'}
    path = f'/clients/{client_id}' if client_id else '/ai-assistant'
    if kind in detail:
        path += f'/{detail[kind]}/{row.id}'
    elif kind in tabs:
        path += '?tab=' + tabs[kind]
    return {'kind': kind, 'id': row.id, 'client_id': client_id, 'path': path}


def search_clients(db, authority, text, limit=20):
    query = scoped_query(db, authority, 'clients')
    pattern = '%' + text.replace('%', r'\%').replace('_', r'\_') + '%'
    query = query.filter(or_((Client.first_name + ' ' + Client.last_name).ilike(pattern),
                            Client.phone_mobile.ilike(pattern), Client.national_id.ilike(pattern)))
    rows = query.order_by(Client.id).limit(limit + 1).all()
    return {'matches': [{**project(row, 'clients'), 'source': source('clients', row)} for row in rows[:limit]],
            'has_more': len(rows) > limit, 'ambiguous': len(rows) > 1}


def list_records(db, authority, kind, client_id=None, offset=0, limit=50):
    query = scoped_query(db, authority, kind)
    if client_id:
        patient(db, authority, client_id)
        model = MODELS[kind]
        query = query.filter((model.id if kind == 'clients' else model.client_id) == client_id)
    count = query.count()
    rows = query.order_by(MODELS[kind].id).offset(offset).limit(limit).all()
    return {'records': [{**project(row, kind), 'source': source(kind, row)} for row in rows],
            'total': count, 'offset': offset, 'next_offset': offset + limit if offset + limit < count else None}


def history(db, authority, client_id):
    row = patient(db, authority, client_id)
    result = {'client': {**project(row, 'clients'), 'source': source('clients', row)}}
    for kind in MODELS:
        if kind != 'clients':
            result[kind] = list_records(db, authority, kind, client_id)
    # Measurements belong to layout instances, not the OpticalExam header.
    instances = db.query(ExamLayoutInstance, OpticalExam.exam_date).join(OpticalExam).filter(
        OpticalExam.client_id == row.id, OpticalExam.clinic_id == authority.clinic_id, OpticalExam.deleted_at.is_(None)).order_by(ExamLayoutInstance.id).all()
    result['exam_layouts'] = [{'id': item.id, 'exam_id': item.exam_id, 'is_active': item.is_active,
                              'data': clean_nested(item.exam_data), 'exam_date': json_value(exam_date),
                              'source': {'kind': 'exams', 'id': item.exam_id, 'path': f'/clients/{row.id}/exams/{item.exam_id}'}}
                             for item, exam_date in instances]
    return result


def prescription(values):
    """Compare minus-cylinder equivalents, preserving eye and original values."""
    result = {}
    for eye in ('r', 'l'):
        sph, cyl, axis = (values.get(f'{eye}_{key}') for key in ('sph', 'cyl', 'ax'))
        if sph is None:
            result[eye] = None
            continue
        if cyl is not None and float(cyl) != 0 and axis is None:
            result[eye] = {'incomplete': True, 'sph': sph, 'cyl': cyl, 'ax': None}
            continue
        sph, cyl = Decimal(str(sph)), Decimal(str(cyl or 0))
        if cyl > 0:
            sph, cyl, axis = sph + cyl, -cyl, (float(axis) + 90) % 180
        result[eye] = {'sph': float(sph), 'cyl': float(cyl), 'ax': (float(axis) % 180 if cyl else None)}
        for key in ('ad', 'pris', 'base', 'pd', 'va'):
            if f'{eye}_{key}' in values:
                result[eye][key] = values[f'{eye}_{key}']
    return result


def compare(db, authority, client_id, first_instance, second_instance):
    patient(db, authority, client_id)
    rows = []
    for identifier in (first_instance, second_instance):
        row = db.query(ExamLayoutInstance).join(OpticalExam).filter(
            ExamLayoutInstance.id == identifier, OpticalExam.client_id == client_id,
            OpticalExam.clinic_id == authority.clinic_id, OpticalExam.deleted_at.is_(None)).first()
        if not row:
            raise HTTPException(404, 'agent.recordNotFound')
        rows.append(row)
    comparisons = {}
    for key in sorted(set(rows[0].exam_data or {}) & set(rows[1].exam_data or {})):
        first, second = (row.exam_data[key] for row in rows)
        if isinstance(first, dict) and isinstance(second, dict) and any(k.endswith('_sph') for k in first):
            comparisons[key] = prescription_comparison(first, second)
    return {'prescription_comparisons': comparisons, 'first': clean_nested(rows[0].exam_data), 'second': clean_nested(rows[1].exam_data),
            'sources': [{'kind': 'exams', 'id': row.exam_id, 'path': f'/clients/{client_id}/exams/{row.exam_id}'} for row in rows]}


def snapshot(row):
    kind = next((name for name, model in MODELS.items() if isinstance(row, model)), None)
    if not kind:
        raise HTTPException(422, 'agent.invalidFields')
    return project(row, kind)


def prescription_comparison(first, second):
    before, after = prescription(first), prescription(second)
    differences = {}
    for eye in ('r', 'l'):
        a, b = before[eye], after[eye]
        if a is None or b is None or a.get('incomplete') or b.get('incomplete'):
            differences[eye] = {'comparable': False}
            continue
        changed = {key: {'before': a.get(key), 'after': b.get(key)} for key in set(a) | set(b) if a.get(key) != b.get(key)}
        differences[eye] = {'comparable': True, 'equivalent': not changed, 'changes': changed}
    return {'before_minus_cylinder': before, 'after_minus_cylinder': after, 'eyes': differences}


def check_order(db, authority, client_id, order_id, layout_instance_id, prescription_key, contact=False):
    patient(db, authority, client_id)
    kind = 'contact_lens_orders' if contact else 'orders'
    order = scoped_query(db, authority, kind).filter(MODELS[kind].id == order_id, MODELS[kind].client_id == client_id).first()
    layout = db.query(ExamLayoutInstance).join(OpticalExam).filter(ExamLayoutInstance.id == layout_instance_id,
        OpticalExam.client_id == client_id, OpticalExam.clinic_id == authority.clinic_id, OpticalExam.deleted_at.is_(None)).first()
    if not order or not layout:
        raise HTTPException(404, 'agent.recordNotFound')
    exam_values, order_values = (layout.exam_data or {}).get(prescription_key), (order.order_data or {}).get(prescription_key)
    if not isinstance(exam_values, dict) or not isinstance(order_values, dict):
        return {'status': 'missing_prescription', 'sources': [source(kind, order)]}
    return {'status': 'review', 'comparison': prescription_comparison(exam_values, order_values),
        'exam_values': clean_nested(exam_values), 'order_values': clean_nested(order_values),
        'sources': [source(kind, order), {'kind': 'exams', 'id': layout.exam_id, 'path': f'/clients/{client_id}/exams/{layout.exam_id}'}]}
