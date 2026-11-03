import csv
import io
import json
import threading
from datetime import date, datetime, timezone, timedelta

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from openpyxl import load_workbook
from pydantic import ValidationError
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
from auth import get_current_user
from models import Company, Clinic, User, Client, OpticalExam, Appointment, Referral, File, CatalogProduct, CatalogVariant, InventoryBalance, Order
from agent.models import AgentJob
from services import table_exports as exports
from EndPoints.table_exports import router


@pytest.fixture
def context(tmp_path, monkeypatch):
    engine = create_engine('sqlite:///' + str(tmp_path / 'data.sqlite'), connect_args={'check_same_thread': False})
    @event.listens_for(engine, 'connect')
    def sqlite_functions(connection, _):
        import re
        connection.create_function('to_char', 2, lambda value, fmt: value)
        connection.create_function('regexp_replace', 4, lambda value, pattern, replacement, flags: re.sub(pattern, replacement, value or ''))
    with engine.connect() as connection:
        connection.exec_driver_sql('PRAGMA journal_mode=WAL')
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False)
    db = sessions()
    company = Company(name='Test', owner_full_name='Owner')
    other = Company(name='Other', owner_full_name='Other')
    db.add_all([company, other]); db.flush()
    clinic = Clinic(company_id=company.id, name='Test clinic', unique_id='test')
    second = Clinic(company_id=company.id, name='Second clinic', unique_id='second')
    foreign = Clinic(company_id=other.id, name='Foreign', unique_id='foreign')
    db.add_all([clinic, second, foreign]); db.flush()
    user = User(company_id=company.id, clinic_id=clinic.id, role_level=3, username='manager', is_active=True)
    patient = Client(company_id=company.id, clinic_id=clinic.id, first_name='Élodie', last_name='כהן', gender='נקבה', national_id='001234', phone_mobile='0500123456', file_creation_date=date(2026, 11, 1))
    outsider = Client(company_id=other.id, clinic_id=foreign.id, first_name='Invisible')
    db.add_all([user, patient, outsider]); db.commit()
    monkeypatch.setattr(exports, 'data_directory', lambda: tmp_path)
    from config import settings
    monkeypatch.setattr(settings, 'SUBSCRIPTION_ENFORCEMENT_MODE', 'off')
    yield db, user, clinic, second, patient, sessions
    db.close(); engine.dispose()


def request(table='clients', **kwargs):
    return exports.ExportRequest.model_validate({'table': table, 'columns': list(exports.COLUMNS[table]), 'request_key': 'test', 'locale': 'en', **kwargs})


def test_count_matches_list_and_exports_all_pages(context):
    db, user, clinic, _, patient, _ = context
    db.add_all([Client(company_id=user.company_id, clinic_id=clinic.id, first_name='Élodie', last_name=str(i), file_creation_date=date(2026, 11, 1)) for i in range(130)])
    db.commit()
    req = request(clinic_id=clinic.id, search='lodie', sort='last_name_asc', start_date='2026-11-01', end_date='2026-11-01')
    assert exports.count(db, user, req) == 131
    rows = list(exports.export_rows(db, user, req))
    assert len(rows) == 131
    assert {row['first_name'] for row in rows} == {'Élodie'}
    assert rows[0]['last_name'] == '0'
    req.filters = {'gender': 'נקבה'}
    assert exports.count(db, user, req) == 1


def test_missing_dates_deleted_and_merged_clients_excluded(context):
    db, user, clinic, _, patient, _ = context
    db.add_all([Client(company_id=user.company_id, clinic_id=clinic.id, first_name='Missing'),
        Client(company_id=user.company_id, clinic_id=clinic.id, first_name='Deleted', deleted_at=datetime.now(timezone.utc)),
        Client(company_id=user.company_id, clinic_id=clinic.id, first_name='Merged', merged_into_client_id=patient.id)])
    db.commit()
    assert exports.count(db, user, request(clinic_id=clinic.id)) == 2
    assert exports.count(db, user, request(clinic_id=clinic.id, start_date='2026-11-01', end_date='2026-11-02')) == 1


@pytest.mark.parametrize('table', ['exams', 'appointments', 'referrals', 'files'])
def test_record_rows_and_dates_match_sources(context, table):
    db, user, clinic, _, patient, _ = context
    common = {'client_id': patient.id, 'clinic_id': clinic.id, 'company_id': user.company_id}
    records = {
        'exams': lambda: OpticalExam(**common, user_id=user.id, exam_date=date(2026, 11, 2), test_name='Check'),
        'appointments': lambda: Appointment(**common, user_id=user.id, date=date(2026, 11, 2), time='09:30', exam_name='Check'),
        'referrals': lambda: Referral(**common, user_id=user.id, date=date(2026, 11, 2), type='Check', referral_notes='', urgency_level='urgent'),
        'files': lambda: File(**common, uploaded_by=user.id, file_name='Document', storage_key='test', file_type='application/pdf', upload_date=datetime(2026, 11, 1, 23, 0, tzinfo=timezone.utc)),
    }
    db.add(records[table]()); db.commit()
    req = request(table, clinic_id=clinic.id, start_date='2026-11-02', end_date='2026-11-02')
    assert exports.count(db, user, req) == 1
    rows = list(exports.export_rows(db, user, req))
    assert len(rows) == 1 and rows[0]['client'] == 'Élodie כהן'
    assert exports.count(db, user, request(table, clinic_id=clinic.id, start_date='2026-11-03', end_date='2026-11-03')) == 0


def test_order_groups_keep_shared_balance_once_and_legacy_rows(context):
    from services.order_group_service import save_group
    db, user, clinic, _, patient, _ = context
    group = save_group(db, user, {'clinic_id': clinic.id, 'payer_client_id': patient.id,
        'opened_date': '2026-11-02', 'entries': [{'client_key': str(i), 'kind': kind, 'order': {'client_id': patient.id, 'type': kind, 'order_date': '2026-11-02'}} for i, kind in enumerate(['regular', 'contact'])],
        'line_items': [{'description': 'Frame', 'price': 100, 'quantity': 1}], 'billing': {'currency': 'ILS'}}, creation_key='export')
    db.add(Order(company_id=user.company_id, clinic_id=clinic.id, client_id=patient.id, order_date=date(2026, 11, 1), type='Legacy')); db.commit()
    req = request('orders', clinic_id=clinic.id, sort='date_desc')
    assert exports.count(db, user, req) == 2
    rows = list(exports.export_rows(db, user, req))
    assert len(rows) == 2
    assert sum(row['balance'] for row in rows) == 100
    assert rows[0]['payer'] == 'Élodie כהן'


def test_inventory_supplier_product_visibility_and_cost_permissions(context):
    db, user, clinic, _, _, _ = context
    product = CatalogProduct(company_id=user.company_id, category='frame', model='Model', brand='Brand', preferred_supplier=' Supplier ', normalized_key='brand-model')
    db.add(product); db.flush()
    variant = CatalogVariant(company_id=user.company_id, product_id=product.id, sku='0007', normalized_fingerprint='blue', attributes={'color': 'Blue'}, default_retail=100, default_cost=40, currency='ILS')
    db.add(variant); db.flush()
    db.add(InventoryBalance(company_id=user.company_id, clinic_id=clinic.id, variant_id=variant.id, on_hand=5, reserved=2)); db.commit()
    req = request('inventory', clinic_id=clinic.id, filters={'supplier': 'supplier', 'product_id': str(product.id)}, search='Blue')
    rows = list(exports.export_rows(db, user, req))
    assert len(rows) == 1 and rows[0]['available'] == 3 and rows[0]['cost'] == 40
    req.filters['supplier'] = '__unassigned__'
    assert exports.count(db, user, req) == 0
    req.filters['supplier'] = 'supplier'
    user.role_level = 1; db.commit()
    with pytest.raises(HTTPException) as denied:
        exports.count(db, user, req)
    assert denied.value.status_code == 403
    req.columns = ['variant', 'pricing']
    assert exports.count(db, user, req) == 1
    assert '40' not in next(exports.export_rows(db, user, req))['pricing']


def test_safe_localized_excel_and_csv_preserve_text_and_dates(context):
    db, user, clinic, _, patient, _ = context
    patient.first_name = '=HYPERLINK("bad")'; db.commit()
    req = request(clinic_id=clinic.id, locale='he')
    job = exports.enqueue(db, user, req)
    assert exports.materialize(db, job, lambda: False) == {'rows': 1}
    excel, csv_path = exports.paths(job)
    workbook = load_workbook(excel)
    sheet = workbook.active
    assert sheet.sheet_view.rightToLeft
    assert sheet['A1'].value == 'מספר לקוח'
    assert sheet['B2'].data_type == 's' and sheet['B2'].value.startswith('=')
    assert sheet['E2'].value == '001234' and sheet['F2'].value == '0500123456'
    assert csv_path.read_bytes().startswith(b'\xef\xbb\xbf')
    rows = list(csv.reader(io.StringIO(csv_path.read_text(encoding='utf-8-sig'))))
    assert rows[1][1].startswith("'=")
    assert rows[1][4] == '001234'
    assert excel.stat().st_mode & 0o777 == 0o600
    workbook.close()


def test_idempotency_scope_revalidation_and_owner_isolation(context):
    db, user, clinic, second, patient, _ = context
    req = request(clinic_id=clinic.id)
    job = exports.enqueue(db, user, req)
    assert exports.enqueue(db, user, req).id == job.id
    with pytest.raises(HTTPException) as conflict:
        exports.enqueue(db, user, request(clinic_id=clinic.id, search='different'))
    assert conflict.value.status_code == 409
    stranger = User(company_id=user.company_id, clinic_id=clinic.id, role_level=3, username='stranger', is_active=True)
    db.add(stranger); db.commit()
    with pytest.raises(HTTPException) as denied:
        exports.validate_job(db, stranger, job)
    assert denied.value.status_code == 404
    user.is_active = False; db.commit()
    with pytest.raises(HTTPException):
        exports.validate_job(db, user, job)


@pytest.mark.parametrize('patch', [{'columns': ['hidden_note']}, {'columns': ['id', 'id']}, {'filters': {'sql': 'anything'}}, {'filters': {'gender': 'invalid'}}, {'sort': 'hidden_note_desc'}, {'start_date': '2026-11-03'}, {'start_date': '2026-11-03', 'end_date': '2026-11-01'}])
def test_rejects_unregistered_fields_and_invalid_dates(patch):
    with pytest.raises(ValidationError):
        request(**patch)


def test_api_validation_download_cancel_and_expiration(context):
    db, user, clinic, _, _, _ = context
    app = FastAPI(); app.include_router(router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user
    with TestClient(app) as client:
        payload = request(clinic_id=clinic.id, start_date='2026-11-01', end_date='2026-11-02').model_dump(mode='json')
        assert client.post('/table-exports/count', json=payload).json() == {'rows': 1}
        assert client.post('/table-exports', json={**payload, 'columns': ['hidden_note']}).status_code == 422
        created = client.post('/table-exports', json=payload).json()
        job_id = created['id']
        assert client.get(f'/table-exports/{job_id}/download').status_code == 409
        assert client.post(f'/table-exports/{job_id}/cancel').json()['status'] == 'cancelled'
        row = db.get(AgentJob, job_id)
        row.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1); db.commit()
        assert client.get(f'/table-exports/{job_id}').status_code == 410


def test_worker_runs_without_ai_and_expired_files_are_cleaned(context, monkeypatch):
    from workers.table_export_worker import run_once, cleanup
    db, user, clinic, _, _, sessions = context
    monkeypatch.setenv('AGENTS24_ENABLED', 'false')
    job = exports.enqueue(db, user, request(clinic_id=clinic.id))
    job_id = job.id
    assert run_once('test-worker', threading.Event(), sessions=sessions)
    db.expire_all(); job = db.get(AgentJob, job_id)
    assert job.status == 'completed' and job.result == {'rows': 1}
    assert all(path.exists() for path in exports.paths(job))
    job.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1); db.commit()
    cleanup(sessions=sessions)
    assert not any(path.exists() for path in exports.paths(job))


def test_cancelled_generation_cleans_all_private_partial_files(context):
    from openpyxl.worksheet._writer import ALL_TEMP_FILES
    db, user, clinic, _, _, _ = context
    job = exports.enqueue(db, user, request(clinic_id=clinic.id))
    before = set(ALL_TEMP_FILES)
    with pytest.raises(exports.Interrupted):
        exports.materialize(db, job, lambda: True)
    assert set(ALL_TEMP_FILES) == before
    for path in exports.paths(job):
        assert not path.exists()
        assert not list(path.parent.glob(path.name + '.part*'))


def test_read_only_staff_can_export_without_ai_and_foreign_scope_is_denied(context, monkeypatch):
    from models import Subscription
    from config import settings
    db, user, clinic, _, _, _ = context
    user.role_level = 1
    db.add(Subscription(id='export-read-only', plan_code='growth', company_id=user.company_id, status='legacy_active', provider='manual', access_override='read_only', ai_enabled=False))
    db.commit()
    monkeypatch.setattr(settings, 'SUBSCRIPTION_ENFORCEMENT_MODE', 'enforce')
    assert exports.enqueue(db, user, request(clinic_id=clinic.id)).kind == 'table_export'
    foreign = db.query(Clinic).filter(Clinic.company_id != user.company_id).first()
    with pytest.raises(HTTPException) as denied:
        exports.count(db, user, request(clinic_id=foreign.id))
    assert denied.value.status_code in (403, 404)


def test_completed_export_download_is_authenticated_and_uses_localized_filename(context):
    db, user, clinic, _, _, sessions = context
    from workers.table_export_worker import run_once
    app = FastAPI(); app.include_router(router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user
    with TestClient(app) as client:
        job_id = client.post('/table-exports', json=request(clinic_id=clinic.id, locale='he').model_dump(mode='json')).json()['id']
        assert run_once('download-test', threading.Event(), sessions=sessions)
        db.expire_all()
        result = client.get(f'/table-exports/{job_id}/download')
        assert result.status_code == 200 and result.content.startswith(b'PK')
        assert result.headers['cache-control'] == 'no-store'
        assert 'filename*=UTF-8' in result.headers['content-disposition']
        app.dependency_overrides[get_current_user] = lambda: User(id=user.id + 100, company_id=user.company_id, clinic_id=clinic.id, is_active=True)
        assert client.get(f'/table-exports/{job_id}/download').status_code == 404


def test_in_memory_api_lifecycle_does_not_start_a_background_consumer(monkeypatch):
    import asyncio
    import database
    from workers import table_export_worker
    engine = create_engine('sqlite:///:memory:')
    monkeypatch.setattr(database, 'engine', engine)
    def unexpected_thread(*args, **kwargs):
        pytest.fail('In-memory SQLite must not spawn a concurrent consumer')
    monkeypatch.setattr(table_export_worker.threading, 'Thread', unexpected_thread)
    async def lifespan():
        async with table_export_worker.table_export_services():
            pass
    asyncio.run(lifespan())
    engine.dispose()


def test_order_export_reuses_legacy_list_adapter_on_older_installations(context, monkeypatch):
    from services import order_group_service
    from EndPoints import orders
    db, user, clinic, _, patient, _ = context
    monkeypatch.setattr(order_group_service, 'order_groups_available', lambda db: False)
    calls = []
    def legacy_list(**kwargs):
        calls.append(kwargs)
        if kwargs['count_only']:
            return {'items': [], 'total': 2, 'has_more': False}
        return {'items': [{'id': 1, 'clientName': 'Élodie כהן', 'order_date': '2026-11-01', 'type': 'glasses', 'billing_total_after_discount': 100, 'billing_prepayment_amount': 20},
            {'id': 2, 'clientName': 'Élodie כהן', 'order_date': '2026-10-01', '__contact': True, 'type': 'contact-lens'}], 'has_more': False}
    monkeypatch.setattr(orders, 'get_orders_paginated', legacy_list)
    req = request('orders', clinic_id=clinic.id, search='כהן', filters={'kind': 'all', 'status': 'all'})
    assert exports.count(db, user, req) == 2
    assert calls[-1]['search'] == 'כהן' and calls[-1]['current_user'].id == user.id
    req.start_date, req.end_date = date(2026, 11, 1), date(2026, 11, 30)
    assert exports.count(db, user, req) == 1
    rows = list(exports.export_rows(db, user, req))
    assert len(rows) == 1 and rows[0]['balance'] == 80 and rows[0]['kind'] == 'Glasses order'
