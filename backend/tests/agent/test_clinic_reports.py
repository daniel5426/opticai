from datetime import date
import io
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from auth import get_current_user
from database import get_db
from EndPoints.clinic_reports import router
from models import Clinic, Client, Order


@pytest.fixture
def http(clinic):
    db, auth, clients, _ = clinic
    auth.user.role_level = 4
    db.add(Order(client_id=clients[1].id, clinic_id=auth.clinic_id, order_date=date(2026, 9, 15)))
    db.add(Order(client_id=clients[0].id, clinic_id=auth.clinic_id, order_date=date(2026, 10, 20)))
    db.commit()
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: auth.user
    with TestClient(app) as client:
        yield db, auth, client


def test_catalog_lists_only_report_datasets(http):
    _, auth, client = http
    datasets = client.get(f'/clinic-reports/catalog?clinic_id={auth.clinic_id}').json()['datasets']
    assert 'orders' in datasets and datasets['orders']['fields']['order_date'] == 'date'
    assert 'campaigns' not in datasets and 'measurements' not in datasets


def test_grouped_report_with_dates_conditions_and_comparison(http):
    _, auth, client = http
    report = {'dataset': 'orders', 'date_field': 'order_date', 'start_date': '2026-10-01', 'end_date': '2026-10-31',
              'group_by': ['client.first_name'], 'aggregates': [{'field': 'id', 'operation': 'count'}],
              'where': {'match': 'all', 'conditions': [{'field': 'client.first_name', 'operator': 'contains', 'value': 'oy'}]}}
    result = client.post(f'/clinic-reports/run?clinic_id={auth.clinic_id}', json=report).json()
    assert result['columns'] == ['client.first_name', 'count_id']
    assert result['rows'] == [{'client.first_name': 'Boy', 'count_id': 2}]
    assert result['comparison']['start'] == '2026-08-31' and result['comparison']['rows'] == []
    report['where']['conditions'][0]['value'] = 'Girl'
    report['start_date'] = '2026-09-01'
    assert client.post(f'/clinic-reports/run?clinic_id={auth.clinic_id}', json=report).json()['total'] == 1


def test_list_report_never_shows_other_companies(http):
    _, auth, client = http
    result = client.post(f'/clinic-reports/run?clinic_id={auth.clinic_id}',
                         json={'dataset': 'clients', 'columns': ['first_name', 'last_name'], 'sort_by': ['first_name']}).json()
    assert [row['first_name'] for row in result['rows']] == ['Boy', 'Girl']


def test_only_company_managers_of_that_clinic_can_report(http):
    db, auth, client = http
    foreign = db.query(Clinic).filter_by(unique_id='foreign').one()
    assert client.get(f'/clinic-reports/catalog?clinic_id={foreign.id}').status_code == 403
    auth.user.role_level = 3
    db.commit()
    assert client.get(f'/clinic-reports/catalog?clinic_id={auth.clinic_id}').status_code == 403


def test_invalid_fields_and_presets_are_rejected(http):
    _, auth, client = http
    url = f'/clinic-reports/run?clinic_id={auth.clinic_id}'
    assert client.post(url, json={'dataset': 'orders', 'columns': ['password']}).status_code == 422
    assert client.post(url, json={'dataset': 'campaigns'}).status_code == 422
    assert client.post(url, json={'dataset': 'orders', 'preset': 'business_health'}).status_code == 422
    assert client.post(url, json={'dataset': 'orders', 'date_field': 'order_date', 'start_date': '2026-10-01'}).status_code == 422


@pytest.mark.parametrize('format', ['xlsx', 'csv'])
def test_export_uses_labels(http, format):
    _, auth, client = http
    response = client.post(f'/clinic-reports/export?clinic_id={auth.clinic_id}&format={format}',
                           json={'title': 'Revenue by clinic/date', 'dataset': 'clients',
                                 'columns': ['first_name'], 'sort_by': ['first_name'],
                                 'presentation': {'labels': {'first_name': 'שם פרטי'}}})
    assert response.status_code == 200
    if format == 'csv':
        assert response.content.decode('utf-8-sig').splitlines()[:2] == ['שם פרטי', 'Boy']
    else:
        from openpyxl import load_workbook
        sheet = load_workbook(io.BytesIO(response.content)).active
        assert sheet.title == 'Revenue by clinic date'
        assert sheet['A1'].data_type == 's'
        assert [cell.value for cell in sheet['A'][:3]] == ['שם פרטי', 'Boy', 'Girl']


def test_saved_templates_round_trip(http):
    _, auth, client = http
    url = f'/clinic-reports/saved?clinic_id={auth.clinic_id}'
    saved = client.post(url, json={'action': 'save', 'title': 'Orders', 'definition': {'dataset': 'orders', 'columns': ['order_date']}}).json()
    assert [item['title'] for item in client.get(url).json()['items']] == ['Orders']
    assert client.post(url, json={'action': 'delete', 'report_id': saved['id'], 'revision': saved['revision']}).json() == {'status': 'deleted'}
    assert client.get(url).json()['items'] == []
