"""Authorized, explicit record projections shared by search and reporting."""
from datetime import date, datetime
from sqlalchemy import func, select, case
from fastapi import HTTPException
from models import (Client, Family, Appointment, OpticalExam, Order, ContactLensOrder, Referral,
                    MedicalLog, File, BillingPayment, InventoryBalance, CatalogVariant, CatalogProduct, PrescriptionSearchIndex, Campaign)
from agent.models import FollowupTask
from services.ai_privacy import CLIENT_FIELDS, RECORD_FIELDS
from services.clinic_finance import invoice_ledger, payment_amount

CONTACT_FIELDS = frozenset(('id client_id clinic_id order_date type dominant_eye order_status advisor delivery_date '
    'guaranteed_date approval_date priority notes supplier_notes order_data l_lens_type l_model l_supplier l_material '
    'l_color l_quantity l_order_quantity l_dx r_lens_type r_model r_supplier r_material r_color r_quantity r_order_quantity r_dx').split())
MODELS = {'clients': Client, 'families': Family, 'appointments': Appointment, 'exams': OpticalExam,
    'orders': Order, 'contact_lens_orders': ContactLensOrder, 'referrals': Referral, 'medical_logs': MedicalLog,
    'files': File, 'tasks': FollowupTask, 'measurements': PrescriptionSearchIndex, 'campaigns': Campaign}
FIELDS = {**RECORD_FIELDS, 'clients': CLIENT_FIELDS | {'referring_party', 'sorting_group'},
    'families': frozenset('id clinic_id name notes created_date'.split()), 'contact_lens_orders': CONTACT_FIELDS,
    'tasks': frozenset('id clinic_id client_id assigned_user_id title notes due_date source status revision'.split()),
    'measurements': frozenset('id clinic_id client_id source_type source_id source_date exam_id layout_instance_id component_key card_type eye sph cyl ax add va pd'.split()),
    'campaigns': frozenset('id clinic_id name active created_at'.split())}
CLIENT_REPORT_FIELDS = ['first_name', 'last_name', 'gender', 'date_of_birth', 'phone_mobile', 'email',
    'address_city', 'referring_party', 'sorting_group']
GRAINS = {**{k: 'one ' + k for k in MODELS}, 'clients': 'one patient per currency when balance fields are selected',
    'measurements': 'one eye in one measurement component', 'billing': 'one invoice, attributed to its payer', 'payments': 'one signed payment/refund', 'inventory': 'one clinic stock variant'}


def scope_conditions(model, clinic_ids):
    conditions = [model.clinic_id.in_(clinic_ids)]
    if hasattr(model, 'deleted_at'):
        conditions.append(model.deleted_at.is_(None))
    if model is Client:
        conditions.append(Client.merged_into_client_id.is_(None))
    elif hasattr(model, 'client_id'):
        clients = select(Client.id).where(Client.clinic_id.in_(clinic_ids), Client.deleted_at.is_(None), Client.merged_into_client_id.is_(None))
        conditions.append(model.client_id.in_(clients) | model.client_id.is_(None) if model is FollowupTask else model.client_id.in_(clients))
    return conditions


def age_at(day):
    return func.extract('year', day) - func.extract('year', Client.date_of_birth) - case(
        (func.extract('month', Client.date_of_birth) * 100 + func.extract('day', Client.date_of_birth) > day.month * 100 + day.day, 1), else_=0)


def scoped_query(db, authority, kind):
    if kind not in MODELS:
        raise HTTPException(422, 'agent.unsupportedReportField')
    model = MODELS[kind]
    query = db.query(model).filter(*scope_conditions(model, [authority.clinic_id]))
    if kind == 'clients':
        query = query.filter(Client.merged_into_client_id.is_(None))
        if authority.patient_id:
            query = query.filter(Client.id == authority.patient_id)
    elif kind == 'families':
        if authority.patient_id:
            query = query.filter(Family.id == select(Client.family_id).where(Client.id == authority.patient_id).scalar_subquery())
    elif kind == 'campaigns':
        if authority.patient_id:
            query = query.filter(False)
    else:
        allowed = select(Client.id).where(Client.clinic_id == authority.clinic_id, Client.deleted_at.is_(None), Client.merged_into_client_id.is_(None))
        if authority.patient_id:
            allowed = allowed.where(Client.id == authority.patient_id)
        query = query.filter(model.client_id.in_(allowed) if kind != 'tasks' or authority.patient_id
            else (model.client_id.is_(None) | model.client_id.in_(allowed)))
    return query


def expressions(db, authority, dataset, as_of=None, client_balances=True):
    from agent.config import now
    from zoneinfo import ZoneInfo
    day = as_of or now().astimezone(ZoneInfo('Asia/Jerusalem')).date()
    owners = invoice_ledger(authority.clinic_id)
    if dataset in {'billing', 'payments'}:
        query = db.query(owners).join(Client, Client.id == owners.c.client_id)
        fields = dict(owners.c.items())
        if dataset == 'payments':
            query = query.join(BillingPayment, BillingPayment.billing_id == owners.c.id)
            fields = {'id': BillingPayment.id, 'billing_id': owners.c.id, 'client_id': owners.c.client_id,
                'order_date': owners.c.order_date, 'amount': payment_amount(), 'currency': BillingPayment.currency,
                'paid_at': BillingPayment.paid_at, 'kind': BillingPayment.kind}
        if authority.patient_id:
            query = query.filter(owners.c.client_id == authority.patient_id)
    elif dataset == 'inventory':
        if authority.patient_id:
            raise HTTPException(403, 'agent.patientContextMismatch')
        query = db.query(InventoryBalance).join(CatalogVariant).join(CatalogProduct).filter(
            InventoryBalance.clinic_id == authority.clinic_id, CatalogProduct.archived_at.is_(None), CatalogVariant.archived_at.is_(None))
        fields = {key: getattr(InventoryBalance, key) for key in ('id', 'clinic_id', 'variant_id', 'on_hand', 'reserved', 'reorder_point', 'target_quantity')}
        fields.update(product=CatalogProduct.model, brand=CatalogProduct.brand, category=CatalogProduct.category,
            sku=CatalogVariant.sku, barcode=CatalogVariant.barcode, available=InventoryBalance.on_hand - InventoryBalance.reserved)
    else:
        if dataset == 'measurements':
            from services.prescription_matching import eligible_index
            query = eligible_index(db, [authority.clinic_id], authority.patient_id).filter(PrescriptionSearchIndex.component_key.is_not(None))
        else:
            query = scoped_query(db, authority, dataset)
        model = MODELS[dataset]
        fields = {key: getattr(model, key) for key in FIELDS[dataset]
            if hasattr(model, key) and key not in {'exam_data', 'order_data', 'referral_data', 'source'}}
        if dataset == 'clients':
            balances = select(owners.c.client_id, owners.c.currency, func.sum(owners.c.total).label('total'),
                func.sum(owners.c.paid).label('paid'), func.sum(owners.c.outstanding).label('outstanding'))\
                .group_by(owners.c.client_id, owners.c.currency).subquery()
            if client_balances:
                query = query.outerjoin(balances, balances.c.client_id == Client.id)
            fields.update({key: func.coalesce(balances.c[key], 0) for key in ('total', 'paid', 'outstanding')})
            fields.update(currency=balances.c.currency, age=age_at(day), last_exam_date=select(func.max(OpticalExam.exam_date)).where(
                OpticalExam.client_id == Client.id, OpticalExam.clinic_id == authority.clinic_id,
                OpticalExam.deleted_at.is_(None)).correlate(Client).scalar_subquery())
        elif dataset not in {'families', 'campaigns', 'measurements'}:
            query = query.outerjoin(Client, model.client_id == Client.id) if dataset == 'tasks' else query.join(Client, model.client_id == Client.id)
        if dataset == 'orders':
            for key in ('order_status', 'promised_date', 'delivered_at', 'notes', 'lens_order_notes', 'bag_number', 'manufacturing_lab'):
                fields['details.' + key] = Order.order_data['details'][key].as_string()
    if dataset not in {'clients', 'inventory', 'families', 'campaigns'}:
        fields.update({'client.' + key: getattr(Client, key) for key in CLIENT_REPORT_FIELDS})
        fields['client.age'] = age_at(day)
    for key, column in list(fields.items()):
        try:
            dated = column.type.python_type in (date, datetime)
        except (NotImplementedError, AttributeError):
            dated = False
        if dated:
            fields[key + '.year'] = func.extract('year', column)
            fields[key + '.month'] = func.extract('year', column) * 100 + func.extract('month', column)
    return query, fields


def catalog(db, authority):
    datasets = {}
    for name in [*MODELS, 'billing', 'payments', 'inventory']:
        if name == 'inventory' and authority.patient_id:
            continue
        fields = expressions(db, authority, name)[1]
        typed = {}
        for key, expression in fields.items():
            try:
                typed[key] = expression.type.python_type.__name__
            except (NotImplementedError, AttributeError):
                typed[key] = 'number' if key in {'age', 'client.age', 'total', 'paid', 'outstanding', 'available', 'amount'} else 'str'
        datasets[name] = {'grain': GRAINS[name], 'fields': typed,
            'relationships': [key for key in MODELS if key not in {'clients', 'families', 'campaigns'}] if name == 'clients' else ['client'] if name not in {'families', 'inventory', 'campaigns'} else []}
        if name == 'measurements':
            from agent.models import PrescriptionIndexState
            state = db.get(PrescriptionIndexState, authority.clinic_id)
            datasets[name]['ready'] = bool(state and state.ready)
    return datasets
