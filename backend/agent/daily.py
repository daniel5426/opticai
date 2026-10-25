"""Full-clinic operational facts and idempotent daily admission."""
from datetime import datetime
from zoneinfo import ZoneInfo
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_, and_
from models import Appointment, Client, Clinic, User, Order, ContactLensOrder
from .models import AgentJob, FollowupTask
from .records import project, source, history, list_records, json_value
from .reports import preview, expressions
from .authority import Authority
from .config import now

ISRAEL = ZoneInfo('Asia/Jerusalem')


def snapshot(db, authority, day):
    appointments = db.query(Appointment).filter_by(clinic_id=authority.clinic_id, date=day).filter(Appointment.deleted_at.is_(None)).order_by(Appointment.time, Appointment.id).all()
    preparations = []
    for appointment in appointments:
        patient = db.query(Client).filter_by(id=appointment.client_id, clinic_id=authority.clinic_id).first()
        if not patient:
            continue
        data = history(db, authority, patient.id)
        for kind in ('exams', 'medical_logs', 'orders', 'contact_lens_orders', 'referrals'):
            while data[kind]['next_offset'] is not None:
                page = list_records(db, authority, kind, patient.id, offset=data[kind]['next_offset'])
                data[kind]['records'].extend(page['records'])
                data[kind]['next_offset'] = page['next_offset']
        preparations.append({'appointment': project(appointment, 'appointments'),
            'patient': data['client'], 'exams': data['exams'], 'exam_layouts': data['exam_layouts'],
            'recent_medical_logs': data['medical_logs'], 'orders': data['orders'],
            'contact_lens_orders': data['contact_lens_orders'], 'referrals': data['referrals'],
            'source': source('appointments', appointment)})
    overdue = []
    for row in db.query(Order).filter_by(clinic_id=authority.clinic_id).filter(Order.deleted_at.is_(None)):
        details = (row.order_data or {}).get('details', {})
        promised, delivered = details.get('promised_date'), details.get('delivered_at')
        if promised and promised[:10] < day.isoformat() and not delivered:
            overdue.append({**project(row, 'orders'), 'source': source('orders', row)})
    for row in db.query(ContactLensOrder).filter_by(clinic_id=authority.clinic_id).filter(ContactLensOrder.deleted_at.is_(None)):
        if row.guaranteed_date and row.guaranteed_date < day and not row.delivery_date:
            overdue.append({**project(row, 'contact_lens_orders'), 'source': source('contact_lens_orders', row)})
    tasks = db.query(FollowupTask).filter(FollowupTask.clinic_id == authority.clinic_id,
        FollowupTask.status == 'open', FollowupTask.due_date <= day).order_by(FollowupTask.due_date).all()
    balances = preview(db, authority, {'dataset': 'clients', 'filters': [{'field': 'outstanding', 'operator': 'gt', 'value': 0}],
        'group_by': ['currency'], 'aggregates': [{'field': 'outstanding', 'operation': 'sum'}], 'as_of': day.isoformat()})
    inventory, fields = expressions(db, authority, 'inventory')
    stock = inventory.filter(fields['available'] <= fields['reorder_point']).with_entities(fields['id'], fields['product'], fields['available'], fields['reorder_point']).all()
    return {'date': day.isoformat(), 'appointments_count': len(appointments), 'patient_preparation': preparations,
            'overdue_orders_count': len(overdue), 'overdue_orders': overdue,
            'due_tasks': [{**project(row, 'tasks'), 'source': source('tasks', row)} for row in tasks], 'outstanding_by_currency': balances,
            'low_stock': [{'id': row[0], 'product': row[1], 'available': json_value(row[2]), 'reorder_point': json_value(row[3])} for row in stock]}


def enqueue_daily(db, at=None, clinic_ids=None):
    local = (at or now()).astimezone(ISRAEL)
    if local.hour < 6:
        return 0
    count = 0
    clinics = db.query(Clinic).filter(Clinic.is_active.is_(True))
    if clinic_ids is not None:
        clinics = clinics.filter(Clinic.id.in_(clinic_ids))
    for clinic in clinics.all():
        user = db.query(User).filter(User.company_id == clinic.company_id, User.is_active.is_(True),
            or_(User.clinic_id == clinic.id, and_(User.clinic_id.is_(None), User.role_level >= 4))).order_by(User.role_level.desc(), User.id).first()
        if not user:
            continue
        for language in ('he', 'en', 'fr'):
            key = f'brief:{clinic.id}:{local.date()}:{language}'
            if db.query(AgentJob.id).filter_by(unique_key=key).first():
                continue
            db.add(AgentJob(unique_key=key, company_id=clinic.company_id, clinic_id=clinic.id,
                user_id=user.id, kind='brief', locale=language, business_date=local.date()))
            try:
                db.commit()
                count += 1
            except IntegrityError:
                db.rollback()
    return count
