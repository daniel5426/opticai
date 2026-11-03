"""Exercise the published desktop's HTTP payloads against shared order storage."""
from copy import deepcopy
from datetime import date
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from auth import get_current_user
from database import Base, get_db
from EndPoints import billing, orders, order_groups, clients, exam_layouts, unified_exam_data
from models import (Company, Clinic, User, Client, Order, ContactLensOrder, Billing,
                    BillingPayment, OrderLineItem, OrderGroup, OpticalExam, ExamLayoutInstance)
from services.order_group_service import save_group, group_dict, group_write, row_dict


@pytest.fixture
def setup():
    engine = create_engine('sqlite://', poolclass=StaticPool, connect_args={'check_same_thread': False})
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)()
    company = Company(name='Compatibility', owner_full_name='Synthetic')
    db.add(company); db.flush()
    clinic = Clinic(company_id=company.id, name='Compatibility', unique_id='compatibility')
    db.add(clinic); db.flush()
    user = User(company_id=company.id, clinic_id=clinic.id, username='staff', role_level=2)
    patients = [Client(company_id=company.id, clinic_id=clinic.id, first_name=name) for name in ('One', 'Two')]
    db.add_all([user, *patients]); db.commit()
    group = save_group(db, user, {'clinic_id': clinic.id, 'payer_client_id': patients[0].id,
        'entries': [{'kind': kind, 'client_key': str(i), 'order': {'client_id': patients[i].id,
                    'order_date': '2026-11-03', 'type': kind, 'order_data': {'new_data': {'retained': True}}}}
                    for i, kind in enumerate(['regular', 'contact'])],
        'billing': {'currency': 'ILS', 'notes': 'Original', 'discount_amount': 10},
        'line_items': [{'price': 100, 'quantity': 1, 'description': 'Prescription', 'source_client_key': '0',
                       'source_slot': 'lens', 'manually_edited': False}]}, creation_key='compatibility')
    app = FastAPI()
    for router in (orders.router, orders.cl_router, billing.router, billing.ol_router, order_groups.router,
                   clients.router, exam_layouts.router, unified_exam_data.router):
        app.include_router(router, prefix='/api/v1')
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user
    with TestClient(app) as http:
        yield SimpleNamespace(db=db, http=http, user=user, clinic=clinic, patients=patients, group=group)
    db.close(); engine.dispose()


def old_form(s, contact=False):
    entry = s.group['entries'][int(contact)]
    path = '/contact-lens-orders' if contact else '/orders'
    order = s.http.get(f'/api/v1{path}/{entry["order"]["id"]}').json()
    invoice = s.http.get(f'/api/v1/billing/{s.group["billing"]["id"]}').json()
    lines = s.http.get(f'/api/v1/order-line-items/billing/{invoice["id"]}').json()
    return path, {'order': order, 'billing': invoice, 'line_items': lines}


@pytest.mark.parametrize('contact', [False, True])
def test_old_full_editor_preserves_siblings_invoice_and_provenance(setup, contact):
    s = setup
    path, payload = old_form(s, contact)
    sibling = deepcopy(s.group['entries'][not contact])
    payload['order']['type'] = 'Edited by v1.0.79'
    payload['billing']['notes'] = 'Edited notes'
    response = s.http.post('/api/v1' + path + '/upsert-full', json=payload)
    assert response.status_code == 200, response.text
    result = group_dict(s.db, s.db.get(OrderGroup, s.group['id']))
    assert result['entries'][not contact] == sibling
    assert result['entries'][int(contact)]['order']['type'] == 'Edited by v1.0.79'
    assert [entry['position'] for entry in result['entries']] == [0, 1]
    assert result['billing']['id'] == payload['billing']['id']
    assert result['billing']['order_id'] is None and result['billing']['contact_lens_id'] is None
    assert result['billing']['total_after_discount'] == 90
    assert result['line_items'][0]['source_entry_id'] == s.group['line_items'][0]['source_entry_id']
    assert result['line_items'][0]['source_slot'] == 'lens'
    assert not result['line_items'][0]['manually_edited']
    assert result['revision'] == s.group['revision'] + 1
    assert response.json()['billing']['compatibility_token']


def test_new_workspace_change_rejects_old_stale_full_save_atomically(setup):
    s = setup
    path, payload = old_form(s)
    payload['order']['type'] = 'Stale edit'
    save_group(s.db, s.user, {'revision': s.group['revision'], 'billing': s.group['billing'],
        'line_items': [*s.group['line_items'], {'price': 50, 'quantity': 1, 'description': 'Added in new app'}]}, group_id=s.group['id'])
    before = group_dict(s.db, s.db.get(OrderGroup, s.group['id']))
    response = s.http.post('/api/v1' + path + '/upsert-full', json=payload)
    assert response.status_code == 409
    assert response.json()['detail']['code'] == 'order_group_conflict'
    s.db.rollback()
    assert group_dict(s.db, s.db.get(OrderGroup, s.group['id'])) == before
    path, refreshed = old_form(s)
    refreshed['order']['type'] = 'Reloaded edit'
    assert s.http.post('/api/v1' + path + '/upsert-full', json=refreshed).status_code == 200
    assert s.db.query(OrderLineItem).count() == 2


def test_old_payment_delta_and_manual_paid_amount_keep_shared_ledger(setup):
    s = setup
    invoice_id = s.group['billing']['id']
    response = s.http.post(f'/api/v1/billing/{invoice_id}/payments', json={'amount': 20, 'paid_at': '2026-11-03'})
    assert response.status_code == 200, response.text
    path, payload = old_form(s)
    payload['billing']['prepayment_amount'] = 35
    assert s.http.post('/api/v1' + path + '/upsert-full', json=payload).status_code == 200
    assert sorted((p.kind, p.amount) for p in s.db.query(BillingPayment)) == [('adjustment', 15), ('payment', 20)]
    assert s.db.get(Billing, invoice_id).prepayment_amount == 35
    assert s.http.delete(f'/api/v1/billing/{invoice_id}/payments/{response.json()["id"]}').status_code == 200
    assert s.db.get(Billing, invoice_id).prepayment_amount == 15


@pytest.mark.parametrize('change', ['foreign-billing', 'foreign-item', 'identity', 'currency', 'forged-receipt'])
def test_old_full_payload_cannot_reassign_shared_ownership(setup, change):
    s = setup
    path, payload = old_form(s)
    if change == 'foreign-billing': payload['billing']['id'] += 1000
    if change == 'foreign-item': payload['line_items'][0]['id'] += 1000
    if change == 'identity': payload['order']['client_id'] = s.patients[1].id
    if change == 'currency': payload['billing']['currency'] = 'EUR'
    if change == 'forged-receipt': payload['billing']['compatibility_token'] = 'forged'
    before = group_dict(s.db, s.db.get(OrderGroup, s.group['id']))
    assert s.http.post('/api/v1' + path + '/upsert-full', json=payload).status_code in (409, 422)
    s.db.rollback()
    assert group_dict(s.db, s.db.get(OrderGroup, s.group['id'])) == before


def test_legacy_json_edit_and_tab_delete_preserve_other_orders_and_money(setup):
    s = setup
    order_id = s.group['entries'][0]['order']['id']
    response = s.http.post(f'/api/v1/orders/{order_id}/data', json={'details': {'order_status': 'Ready'}})
    assert response.status_code == 200, response.text
    assert s.db.get(Order, order_id).order_data['new_data'] == {'retained': True}
    deleted = s.http.delete(f'/api/v1/orders/{order_id}')
    assert deleted.status_code == 200
    assert s.db.get(Billing, s.group['billing']['id']).total_after_discount == 90
    assert s.db.query(ContactLensOrder).count() == 1
    assert s.db.query(Order).count() == 0
    from services.trash_service import restore_item
    restore_item(s.db, s.user, deleted.json()['trash_item_id'])
    assert s.db.query(Order).count() == 1
    assert s.db.get(Billing, s.group['billing']['id']).total_after_discount == 90


def test_explicit_legacy_item_operations_keep_shared_totals_and_currency(setup):
    s = setup
    invoice_id = s.group['billing']['id']
    existing = s.group['line_items'][0]['id']
    response = s.http.post('/api/v1/order-line-items/', json={
        'billings_id': invoice_id, 'price': 25, 'quantity': 2, 'description': 'Old client addition'})
    assert response.status_code == 200, response.text
    added = response.json()['id']
    assert response.json()['currency'] == 'ILS'
    assert s.db.get(Billing, invoice_id).total_after_discount == 140
    assert s.http.put(f'/api/v1/order-line-items/{added}', json={'quantity': 3}).status_code == 200
    assert s.db.get(Billing, invoice_id).total_after_discount == 165
    assert s.http.delete(f'/api/v1/order-line-items/{added}').status_code == 200
    assert s.db.get(Billing, invoice_id).total_after_discount == 90
    assert s.db.get(OrderLineItem, existing).source_slot == 'lens'


def test_partial_billing_metadata_and_manual_paid_updates_use_receipt(setup):
    s = setup
    invoice_id = s.group['billing']['id']
    invoice = s.http.get(f'/api/v1/billing/{invoice_id}').json()
    response = s.http.put(f'/api/v1/billing/{invoice_id}', json={
        **invoice, 'notes': 'Changed by old editor', 'prepayment_amount': 20})
    assert response.status_code == 200, response.text
    assert response.json()['order_id'] is None
    assert response.json()['total_after_discount'] == 90
    assert s.db.query(BillingPayment).one().amount == 20
    assert s.db.query(OrderLineItem).count() == 1


def test_legacy_layout_save_cannot_remove_an_unrenderable_card(setup):
    import json
    s = setup
    exam = OpticalExam(client_id=s.patients[0].id, clinic_id=s.clinic.id)
    s.db.add(exam); s.db.flush()
    old = {'id': 'notes-1', 'type': 'notes', 'x': 0, 'y': 0}
    new = {'id': 'imported-1', 'type': 'opticplus-ocular-health', 'x': 0, 'y': 10}
    instance = ExamLayoutInstance(exam_id=exam.id, layout_data=json.dumps({'version': 2, 'items': [old, new]}), exam_data={})
    s.db.add(instance); s.db.commit()
    payload = {'layout_data': json.dumps({'version': 2, 'items': [old]})}
    response = s.http.put(f'/api/v1/exam-layouts/instances/{instance.id}', json=payload)
    assert response.status_code == 200, response.text
    assert json.loads(response.json()['layout_data'])['items'] == [old, new]
    response = s.http.put(f'/api/v1/exam-layouts/instances/{instance.id}', json=payload,
                         headers={'X-Prysm-Exam-Write': 'replace-v1', 'X-Prysm-Exam-Components': 'notes,opticplus-ocular-health'})
    assert json.loads(response.json()['layout_data'])['items'] == [old]


def test_legacy_write_cannot_bypass_read_only_role(setup):
    s = setup
    s.user.role_level = 1
    s.db.commit()
    order_id = s.group['entries'][0]['order']['id']
    assert s.http.put(f'/api/v1/orders/{order_id}', json={'type': 'Denied'}).status_code == 403
    assert s.http.post(f'/api/v1/billing/{s.group["billing"]["id"]}/payments',
                       json={'amount': 5, 'paid_at': '2026-11-03'}).status_code == 403


def test_old_patient_delete_keeps_other_patient_and_shared_invoice(setup):
    s = setup
    response = s.http.delete(f'/api/v1/clients/{s.patients[0].id}')
    assert response.status_code == 200, response.text
    assert response.json()['expires_at']
    assert s.db.query(Client).count() == 1
    assert s.db.query(ContactLensOrder).count() == 1
    assert s.db.query(Order).count() == 0
    assert s.db.get(Billing, s.group['billing']['id']).total_after_discount == 90
    from services.trash_service import restore_item
    restore_item(s.db, s.user, response.json()['trash_item_id'])
    assert s.db.query(Client).count() == 2
    assert s.db.query(Order).count() == 1


@pytest.mark.parametrize('endpoint', ['unified', 'instance', 'clear'])
def test_old_exam_writes_preserve_new_cards_and_current_writes_can_delete(setup, endpoint):
    s = setup
    exam = OpticalExam(client_id=s.patients[0].id, clinic_id=s.clinic.id)
    s.db.add(exam); s.db.flush()
    new_card = {'clinical_note': 'New clinical data', 'bindings': {'field': 'value'}}
    instance = ExamLayoutInstance(exam_id=exam.id, exam_data={'notes': {'text': 'Before'}, 'opticplus-ocular-health-1': new_card})
    s.db.add(instance); s.db.commit()
    if endpoint == 'unified':
        url, method, payload = f'/api/v1/unified-exam-data/{instance.id}', 'POST', {'notes': {'text': 'Edited'}}
    elif endpoint == 'instance':
        url, method, payload = f'/api/v1/exam-layouts/instances/{instance.id}', 'PUT', {'exam_data': {'notes': {'text': 'Edited'}}}
    else:
        url, method, payload = f'/api/v1/unified-exam-data/{instance.id}', 'DELETE', None
    response = s.http.request(method, url, json=payload)
    assert response.status_code == 200, response.text
    s.db.refresh(instance)
    assert instance.exam_data['opticplus-ocular-health-1'] == new_card
    response = s.http.request(method, url, json=payload, headers={
        'X-Prysm-Exam-Write': 'replace-v1', 'X-Prysm-Exam-Components': 'notes,opticplus-ocular-health'})
    assert response.status_code == 200, response.text
    s.db.refresh(instance)
    assert 'opticplus-ocular-health-1' not in instance.exam_data


def test_replacement_protocol_does_not_erase_components_from_a_future_version(setup):
    s = setup
    exam = OpticalExam(client_id=s.patients[0].id, clinic_id=s.clinic.id)
    s.db.add(exam); s.db.flush()
    instance = ExamLayoutInstance(exam_id=exam.id, exam_data={
        'notes': {'text': 'Before'}, 'future-clinical-card-1': {'finding': 'Preserve'}})
    s.db.add(instance); s.db.commit()
    response = s.http.post(f'/api/v1/unified-exam-data/{instance.id}', json={'notes': {'text': 'After'}},
        headers={'X-Prysm-Exam-Write': 'replace-v1', 'X-Prysm-Exam-Components': 'notes,opticplus-ocular-health'})
    assert response.status_code == 200
    s.db.refresh(instance)
    assert instance.exam_data['future-clinical-card-1'] == {'finding': 'Preserve'}


def test_concurrent_legacy_payments_lock_the_shared_balance():
    import os
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from sqlalchemy import text
    from sqlalchemy.engine import make_url
    from schemas import BillingPaymentCreate
    from security.scope import get_scoped_billing

    url = os.environ.get('TEST_ORDER_GROUP_DATABASE_URL')
    if not url:
        pytest.skip('Isolated PostgreSQL not configured')
    parsed = make_url(url)
    assert parsed.host in {None, 'localhost', '127.0.0.1'}
    assert parsed.database == 'compatibility_concurrency' or parsed.database.endswith('_test')
    if parsed.host is None:
        assert parsed.query.get('host', '').startswith('/tmp/opticai-compat-')
    admin = create_engine(url)
    schema = 'legacy_payment_concurrency_test'
    with admin.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA {schema}'))
    engine = create_engine(url, connect_args={'options': f'-csearch_path={schema}'})
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    try:
        Base.metadata.create_all(engine)
        with sessions() as db:
            company = Company(name='Concurrency', owner_full_name='Synthetic')
            db.add(company); db.flush()
            clinic = Clinic(company_id=company.id, name='Concurrency', unique_id='concurrency')
            db.add(clinic); db.flush()
            user = User(company_id=company.id, clinic_id=clinic.id, username='staff', role_level=2)
            patient = Client(company_id=company.id, clinic_id=clinic.id, first_name='Synthetic')
            db.add_all([user, patient]); db.commit()
            result = save_group(db, user, {'clinic_id': clinic.id, 'payer_client_id': patient.id,
                'entries': [{'kind': kind, 'order': {'client_id': patient.id}} for kind in ('regular', 'contact')],
                'billing': {'currency': 'ILS'}, 'line_items': []}, creation_key='concurrent-old-payments')
            invoice_id, user_id = result['billing']['id'], user.id
        barrier = Barrier(2)

        def pay():
            with sessions() as db:
                user = db.get(User, user_id)
                # Both sessions cache the same old balance before either lock.
                get_scoped_billing(db, user, invoice_id)
                barrier.wait(timeout=5)
                return billing.create_billing_payment(invoice_id, BillingPaymentCreate(amount=20, paid_at=date.today()), db, user).id

        with ThreadPoolExecutor(max_workers=2) as pool:
            first, second = pool.submit(pay), pool.submit(pay)
            assert first.result(timeout=10) != second.result(timeout=10)
        with sessions() as db:
            assert db.get(Billing, invoice_id).prepayment_amount == 40
            assert db.query(BillingPayment).count() == 2
            assert db.get(OrderGroup, result['id']).revision == result['revision'] + 2
        # A receipt cannot claim a newer revision while returning a cached old
        # balance if a writer commits during the GET's authorization checks.
        from services.legacy_order_compatibility import billing_response
        with sessions() as reader:
            user = reader.get(User, user_id)
            cached = get_scoped_billing(reader, user, invoice_id)
            assert cached.prepayment_amount == 40
            with sessions() as writer:
                billing.create_billing_payment(invoice_id, BillingPaymentCreate(amount=20, paid_at=date.today()),
                                               writer, writer.get(User, user_id))
            current = billing_response(reader, user, cached)
            assert current.prepayment_amount == 60
            assert current.compatibility_token
    finally:
        engine.dispose()
        with admin.begin() as connection:
            connection.execute(text(f'DROP SCHEMA {schema} CASCADE'))
        admin.dispose()
