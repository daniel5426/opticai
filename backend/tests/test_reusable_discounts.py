import importlib.util
from decimal import Decimal

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from auth import get_current_user
from database import Base, get_db
from EndPoints.discounts import router
from EndPoints.order_groups import router as groups_router
from models import Billing, BillingPayment, Clinic, Client, Company, User
from services.order_group_service import save_group


@pytest.fixture
def context():
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine, autoflush=False)()
    company = Company(name='Test', owner_full_name='Owner')
    other = Company(name='Other', owner_full_name='Other')
    db.add_all([company, other]); db.flush()
    clinic = Clinic(company_id=company.id, name='Test', unique_id='discount-test')
    foreign = Clinic(company_id=other.id, name='Other', unique_id='discount-other')
    db.add_all([clinic, foreign]); db.flush()
    user = User(company_id=company.id, clinic_id=clinic.id, role_level=2, username='tester')
    client = Client(company_id=company.id, clinic_id=clinic.id, first_name='Test')
    db.add_all([user, client]); db.commit()
    app = FastAPI()
    app.include_router(router)
    app.include_router(groups_router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user
    with TestClient(app) as http:
        yield db, user, clinic, foreign, client, http
    db.close(); engine.dispose()


def test_definition_permissions_validation_and_snapshot(context):
    db, user, clinic, foreign, client, http = context
    url = f'/discounts?clinic_id={clinic.id}'
    data = {'description': ' Loyalty ', 'amount': 25.5, 'currency': 'ILS'}
    assert http.post(url, json=data).status_code == 200
    saved = http.get(url).json()[0]
    assert saved['description'] == 'Loyalty'
    assert Decimal(str(saved['amount'])) == Decimal('25.50')
    assert http.get(f'/discounts?clinic_id={foreign.id}').status_code == 403
    assert http.put(f'/discounts/{saved["id"]}?clinic_id={foreign.id}', json=data).status_code == 403
    for changes in ({'amount': 0}, {'amount': -1}, {'amount': 'NaN'}, {'amount': 1.001}, {'description': '  '}, {'currency': 'GBP'}):
        assert http.post(url, json={**data, **changes}).status_code == 422
    group = save_group(db, user, {
        'clinic_id': clinic.id, 'payer_client_id': client.id,
        'entries': [{'client_key': 'a', 'kind': 'regular', 'order': {'client_id': client.id, 'type': 'regular'}}],
        'billing': {'currency': 'ILS'},
        'line_items': [{'price': 100, 'quantity': 1}, {'description': saved['description'], 'price': 0, 'quantity': 1, 'discount': saved['amount']}],
    }, creation_key='snapshot')
    assert group['billing']['total_after_discount'] == 74.5
    edit_url = f'/discounts/{saved["id"]}?clinic_id={clinic.id}'
    assert http.put(edit_url, json={**data, 'amount': 50}).status_code == 200
    user.role_level = 1; db.commit()
    assert http.get(url).status_code == 200
    assert http.post(url, json=data).status_code == 403
    assert http.put(edit_url, json=data).status_code == 403
    assert http.delete(edit_url).status_code == 403
    user.role_level = 2; db.commit()
    assert http.delete(edit_url).status_code == 200
    reopened = http.get(f'/order-groups/{group["id"]}').json()
    assert reopened['line_items'][1]['description'] == 'Loyalty'
    assert reopened['line_items'][1]['line_total'] == -25.5


@pytest.mark.parametrize("method", ["PUT", "PATCH"])
@pytest.mark.parametrize("unknown_line_total", [False, True])
def test_imported_header_context_discount_edit_remove_and_payments(context, method, unknown_line_total):
    db, user, clinic, _, client, http = context
    group = save_group(db, user, {
        'clinic_id': clinic.id, 'payer_client_id': client.id,
        'entries': [{'client_key': 'a', 'kind': 'regular', 'order': {'client_id': client.id, 'type': 'regular'}}],
        'billing': {'currency': 'ILS', 'discount_amount': 10},
        'line_items': [{'description': 'Imported lens', 'price': 200, 'quantity': 1, 'discount': 50}],
    }, creation_key='imported')
    bill = db.get(Billing, group['billing']['id'])
    # Source header context differs from product sums and has a known source discrepancy.
    if unknown_line_total:
        from models import OrderLineItem
        db.query(OrderLineItem).filter_by(billings_id=bill.id).first().line_total = None
    bill.line_subtotal_offset = bill.line_total_offset = None
    bill.total_before_discount = 120
    bill.total_after_discount = 108
    bill.prepayment_amount = 30
    db.commit()
    url = f'/order-groups/{group["id"]}'
    original = http.get(url).json()
    assert original['billing']['line_total_offset'] is None
    def save(items):
        current = http.get(url).json()
        data = {'revision': current['revision'], 'line_items': items}
        if method == 'PUT':
            data['billing'] = current['billing']
        response = http.request(method, url + ('/billing' if method == 'PATCH' else ''), json=data)
        assert response.status_code == 200, response.text
        return response.json()
    discount = {'description': 'Loyalty', 'price': 0, 'quantity': 1, 'discount': 25}
    applied = save([*original['line_items'], discount])
    assert applied['billing']['total_before_discount'] == 95
    assert applied['billing']['total_after_discount'] == 83
    assert applied['billing']['prepayment_amount'] == 30
    from services.table_exports import ExportRequest, export_rows
    exported = list(export_rows(db, user, ExportRequest(table='orders', clinic_id=clinic.id, columns=['balance'], request_key='discount-export')))
    assert len(exported) == 1 and exported[0]['balance'] == Decimal('53')
    lines = applied['line_items']
    lines[1]['discount'] = 300
    exhausted = save(lines)
    assert exhausted['billing']['total_after_discount'] == 0
    restored = save([exhausted['line_items'][0]])
    assert restored['billing']['total_before_discount'] == 120
    assert restored['billing']['total_after_discount'] == 108
    assert restored['billing']['prepayment_amount'] == 30
    assert db.query(BillingPayment).count() == 0
    # A description-only save never normalizes the historical amounts.
    restored['line_items'][0]['description'] = 'Corrected description'
    assert save(restored['line_items'])['billing']['total_after_discount'] == 108


def test_discount_migration_is_additive_and_preserves_existing_totals(tmp_path):
    from pathlib import Path
    path = Path(__file__).parents[1] / 'alembic/versions/0054_reusable_discounts.py'
    spec = importlib.util.spec_from_file_location('discount_migration', path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = create_engine('sqlite:///' + str(tmp_path / 'migration.sqlite'))
    with engine.begin() as connection:
        connection.execute(text('CREATE TABLE clinics (id INTEGER PRIMARY KEY)'))
        connection.execute(text('CREATE TABLE billings (id INTEGER PRIMARY KEY, total_after_discount FLOAT)'))
        connection.execute(text('INSERT INTO billings VALUES (1, 108)'))
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            assert connection.execute(text('SELECT total_after_discount, line_total_offset FROM billings')).one() == (108, None)
            assert 'discount_definitions' in inspect(connection).get_table_names()
            migration.downgrade()
            assert connection.execute(text('SELECT total_after_discount FROM billings')).scalar() == 108
