"""Manual file imports use ordinary inventory auth, with no Agents24 dependency."""
import io
from pathlib import Path
import pytest
from openpyxl import Workbook
from fastapi import HTTPException
from test_inventory_v1 import _session_factory, _seed, _client
from main import app
from models import CatalogVariant, InventoryBalance, InventoryMovement
from services.inventory_spreadsheet import spreadsheet

HEADERS = ['category', 'manufacturer', 'model', 'color', 'eye_size', 'barcode', 'on_hand', 'cost', 'retail', 'reorder_point', 'target_quantity']


@pytest.fixture
def http(monkeypatch):
    monkeypatch.setenv('AGENTS24_ENABLED', 'false')
    factory = _session_factory()
    ids = _seed(factory)
    try:
        with _client(factory, ids['manager']) as client:
            yield client, factory, ids
    finally:
        app.dependency_overrides.clear()
        factory.kw['bind'].dispose()


def xlsx(*sheets):
    book = Workbook(); book.remove(book.active)
    for name, rows in sheets:
        sheet = book.create_sheet(name)
        for row in rows: sheet.append(row)
    data = io.BytesIO(); book.save(data)
    return data.getvalue()


def preview(client, name, data, worksheet=None):
    return client.post('/api/v1/inventory/import/preview-file', files={'file': (name, data)},
                       data={'worksheet': worksheet} if worksheet is not None else {})


def test_csv_preview_commit_preserves_identifiers_stock_and_legacy_contract(http):
    client, factory, ids = http
    data = (','.join(HEADERS) + '\nframe,Demo,A,Black,50,00012,3,0,0,2,4\nframe,Demo,B,Blue,48,00013,-1,5,10,0,0').encode()
    response = preview(client, 'stock.csv', data)
    assert response.status_code == 200
    value = response.json()
    assert (value['valid'], value['invalid'], value['total']) == (1, 1, 2)
    assert value['rows'][0]['data']['variant']['barcode'] == '00012'
    assert value['rows'][0]['data']['variant']['default_cost'] == 0
    assert value['rows'][1]['error_details'][0]['field'] == 'on_hand'
    assert value['rows'][0]['row_number'] == 2
    with factory() as db: assert db.query(CatalogVariant).count() == 0
    applied = client.post('/api/v1/inventory/import/commit', json={
        'clinic_id': ids['clinic'], 'import_id': 'manual-test', 'rows': [value['rows'][0]]})
    assert applied.status_code == 200 and applied.json()['created'] == 1
    with factory() as db:
        variant = db.query(CatalogVariant).one()
        assert variant.barcode == '00012' and variant.default_cost == 0 and variant.default_retail == 0
        balance = db.query(InventoryBalance).one()
        assert (balance.on_hand, balance.reorder_point, balance.target_quantity) == (3, 2, 4)
        assert db.query(InventoryMovement).one().movement_type == 'import'
    repeated = client.post('/api/v1/inventory/import/commit', json={'clinic_id': ids['clinic'], 'import_id': 'manual-test', 'rows': [value['rows'][0]]})
    assert repeated.json()['created'] == 0
    assert repeated.json()['validation_errors'][0]['error_details']
    assert client.post('/api/v1/inventory/import/preview', json={'csv_text':data.decode()}).status_code == 200


def test_excel_sheet_selection_coordinates_and_formulas(http):
    client, factory, _ = http
    book = Workbook(); book.active.title = 'Empty'
    sheet = book.create_sheet('Frames'); sheet.append([]); sheet.append(HEADERS)
    sheet.append(['frame','Demo','A','Black',50,12,3,0,0,1,3]); sheet['F3'].number_format = '00000'
    sheet.append(['frame','Demo','B','Blue',48,'00013',1,5,'=2+3',0,0])
    contacts = book.create_sheet('Contacts'); contacts.append(['category','brand','model','sph','bc','dia','pack_size'])
    contacts.append(['contact_lens','Demo','Contacts',-2,8.6,14.2,30])
    data = io.BytesIO(); book.save(data)
    response = preview(client, 'stock.xlsx', data.getvalue()).json()
    assert response['worksheets'] == ['Frames','Contacts'] and response['selected_worksheet'] == 'Frames'
    assert (response['valid'], response['invalid']) == (1,1)
    assert response['rows'][0]['row_number'] == 3
    assert response['rows'][0]['data']['variant']['barcode'] == '00012'
    assert {'key':'supply.manual.error.formula'} in response['rows'][1]['error_details']
    assert response['rows'][1]['source_values']['retail'] is None
    other = preview(client, 'stock.xlsx', data.getvalue(), 'Contacts').json()
    assert other['selected_worksheet'] == 'Contacts' and other['valid'] == 1 and other['total'] == 1
    assert preview(client, 'stock.xlsx', data.getvalue(), 'missing').status_code == 422
    with factory() as db: assert db.query(CatalogVariant).count() == 0


def test_xls_cached_formulas_are_not_imported(http):
    client, _, _ = http
    data = (Path(__file__).parent / 'fixtures/inventory-import.xls').read_bytes()
    result = preview(client, 'stock.xls', data).json()
    assert result['valid'] == 1 and result['invalid'] == 1
    assert result['rows'][0]['data']['variant']['barcode'] == '00012'
    assert result['rows'][0]['data']['variant']['default_retail'] == 0
    assert {'key':'supply.manual.error.formula'} in result['rows'][1]['error_details']
    assert spreadsheet('stock.xls', data)[2]['cells'][7] is None


def test_bad_headers_keep_other_worksheets_selectable(http):
    client, _, _ = http
    data = xlsx(('Notes', [['Supplier instructions']]), ('Stock',[HEADERS,['frame','Demo','A','Black',50,'1']]))
    result = preview(client,'stock.xlsx',data).json()
    assert result['worksheets'] == ['Notes','Stock'] and result['file_error'] == 'supply.manual.headers'
    assert preview(client,'stock.xlsx',data,'Stock').json()['valid'] == 1
    duplicated = xlsx(('Stock',[['category','model','model'],['frame','A','B']]))
    assert preview(client,'stock.xlsx',duplicated).json()['file_error'] == 'supply.manual.headers'


def test_file_limits_invalid_files_and_duplicate_rows(http, monkeypatch):
    client, _, _ = http
    assert preview(client,'bad.xlsx',b'broken').status_code == 422
    assert preview(client,'bad.pdf',b'pdf').status_code == 422
    assert preview(client,'empty.csv',b'').status_code == 422
    data = b'category,brand,model,color,eye_size,barcode\nframe,Demo,A,Black,50,01\nframe,Demo,A,Black,50,01'
    result = preview(client,'stock.csv',data).json()
    assert result['valid'] == 1 and result['invalid'] == 1
    import services.inventory_spreadsheet as reader
    monkeypatch.setattr(reader,'MAX_ROWS',2)
    assert preview(client,'stock.csv',data).status_code == 422
    monkeypatch.setattr(reader,'MAX_BYTES',10)
    assert preview(client,'stock.csv',data).status_code == 422


def test_read_only_users_cannot_preview_files(http):
    client, factory, ids = http
    from auth import get_current_user
    from models import User
    with factory() as db: viewer = db.get(User,ids['viewer'])
    app.dependency_overrides[get_current_user] = lambda: viewer
    assert preview(client,'stock.csv',b'category,model\nframe,A').status_code == 403
