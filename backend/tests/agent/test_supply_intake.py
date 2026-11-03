"""Synthetic supplier workflows; these tests never use a configured database."""
import io
import pytest
from fastapi import HTTPException
from openpyxl import Workbook
from models import CatalogVariant, InventoryBalance, InventoryMovement
from services.supply_intake import prepare, review, commit, spreadsheet
from agent.models import AgentJob


def frame(**values):
    return {'source': {'sheet': 'Supplier', 'row': 2}, 'values': {
        'category': 'frame', 'brand': 'Demo', 'model': 'A', 'color': 'Black', 'eye_size': 50,
        'barcode': '001234', 'currency': 'ILS', **values}}


def test_workbook_preserves_sheets_rows_and_zero_identifiers():
    book = Workbook(); sheet = book.active; sheet.title = 'מסגרות'
    sheet.append(['ברקוד', 'דגם']); sheet.append([123, 'A']); sheet['A2'].number_format = '000000'
    book.create_sheet('Prices').append(['Retail', 200])
    output = io.BytesIO(); book.save(output)
    rows = spreadsheet('supplier.xlsx', output.getvalue())
    assert rows[1] == {'sheet': 'מסגרות', 'row': 2, 'cells': ['000123', 'A']}
    assert rows[2]['sheet'] == 'Prices'


def test_catalog_prepare_does_not_write_then_apply_is_idempotent(clinic):
    db, auth, *_ = clinic
    proposal = prepare(db, auth, 'catalog', [frame(default_cost=0, default_retail=200, quantity=100)])
    assert not proposal['rows'][0]['errors']
    assert db.query(CatalogVariant).count() == 0
    result = commit(db, auth, proposal['job_id'], proposal['revision'])
    assert result['status'] == 'committed'
    assert db.query(CatalogVariant).one().default_cost == 0
    assert db.query(InventoryMovement).count() == 0
    assert commit(db, auth, proposal['job_id'], proposal['revision']) == result
    assert db.query(CatalogVariant).count() == 1


def test_receipt_price_update_and_explicit_count_zero(clinic):
    db, auth, *_ = clinic
    proposal = prepare(db, auth, 'receipt', [frame(quantity=4)])
    commit(db, auth, proposal['job_id'], proposal['revision'])
    balance = db.query(InventoryBalance).one()
    assert balance.on_hand == 4
    price = prepare(db, auth, 'prices', [frame(default_retail=300)])
    assert price['rows'][0]['variant_id'] is not None
    commit(db, auth, price['job_id'], price['revision'])
    assert balance.on_hand == 4
    assert db.query(CatalogVariant).one().default_retail == 300
    count = prepare(db, auth, 'count', [frame(quantity=0)])
    commit(db, auth, count['job_id'], count['revision'])
    assert balance.on_hand == 0
    assert db.query(InventoryMovement).count() == 2


def test_unchanged_count_is_valid_without_zero_movement(clinic):
    db, auth, *_ = clinic
    proposal = prepare(db, auth, 'count', [frame(quantity=0)])
    commit(db, auth, proposal['job_id'], proposal['revision'])
    assert db.query(InventoryMovement).count() == 0


@pytest.mark.parametrize('quantity', ['', None, -1, 1.5, True, 'nan'])
def test_receipt_requires_explicit_whole_quantity(clinic, quantity):
    db, auth, *_ = clinic
    proposal = prepare(db, auth, 'receipt', [frame(quantity=quantity)])
    assert proposal['rows'][0]['errors']
    with pytest.raises(HTTPException): commit(db, auth, proposal['job_id'], proposal['revision'])
    assert db.query(CatalogVariant).count() == 0


def test_stale_review_and_foreign_clinic_cannot_commit(clinic):
    db, auth, clients, _ = clinic
    first = prepare(db, auth, 'receipt', [frame(quantity=3)])
    commit(db, auth, first['job_id'], first['revision'])
    proposal = prepare(db, auth, 'receipt', [frame(quantity=2)])
    balance = db.query(InventoryBalance).one(); balance.on_hand += 1; balance.version += 1; db.commit()
    with pytest.raises(HTTPException) as error: commit(db, auth, proposal['job_id'], proposal['revision'])
    assert error.value.status_code == 409
    db.rollback()
    auth.clinic_id = clients[2].clinic_id
    with pytest.raises(HTTPException) as error: commit(db, auth, proposal['job_id'], proposal['revision'])
    assert error.value.status_code == 404


def test_review_edits_revalidate_duplicates_and_selection(clinic):
    db, auth, *_ = clinic
    proposal = prepare(db, auth, 'receipt', [frame(quantity=2), frame(quantity=3)])
    assert proposal['rows'][1]['errors'] == ['supply.duplicateRow']
    rows = proposal['rows']; rows[1]['selected'] = False
    proposal = review(db, auth, db.get(AgentJob, proposal['job_id']), 'receipt', rows)
    result = commit(db, auth, db.query(AgentJob).one().id, proposal['revision'])
    assert len(result['applied']) == 1
    assert db.query(InventoryBalance).one().on_hand == 2


def test_cost_visibility_checked_for_prepare_and_commit(clinic):
    db, auth, *_ = clinic
    auth.user.role_level = 2; db.commit()
    proposal = prepare(db, auth, 'catalog', [frame(default_cost=50)])
    assert proposal['rows'][0]['errors'] == ['supply.costPermission']


def test_existing_catalog_edits_use_shared_validation(clinic):
    db, auth, *_ = clinic
    first = prepare(db, auth, 'catalog', [frame()]); commit(db, auth, first['job_id'], first['revision'])
    proposal = prepare(db, auth, 'catalog', [frame(color='Blue', default_retail=120)])
    commit(db, auth, proposal['job_id'], proposal['revision'])
    variant = db.query(CatalogVariant).one()
    assert variant.attributes['color'] == 'Blue'
    assert variant.default_retail == 120


def test_csv_supports_hebrew_windows_encoding_and_semicolon():
    rows = spreadsheet('supplier.csv', 'מותג;דגם;ברקוד\nדוגמה;A;00123'.encode('cp1255'))
    assert rows[0]['cells'] == ['מותג', 'דגם', 'ברקוד']
    assert rows[1]['cells'][2] == '00123'


def test_pagination_and_aggregates_include_more_than_one_thousand_items(clinic):
    from services.inventory_service import create_product
    from EndPoints.inventory import list_variants, inventory_summary
    db, auth, *_ = clinic
    product = create_product(db, company_id=auth.user.company_id, category='frame', data={'brand':'Demo','model':'A'})
    variants = [CatalogVariant(company_id=auth.user.company_id, product_id=product.id, normalized_fingerprint=f'fixture-{index}', attributes={'color':str(index),'eye_size':50}, currency='ILS', default_cost=1, default_retail=2, is_stockable=True) for index in range(1001)]
    db.add_all(variants); db.flush()
    db.add_all([InventoryBalance(company_id=auth.user.company_id, clinic_id=auth.clinic_id, variant_id=variant.id, on_hand=1, reserved=0, reorder_point=0, target_quantity=0, version=1) for variant in variants]); db.commit()
    arguments = dict(clinic_id=auth.clinic_id, category=None, search=None, barcode=None, include_archived=False, stockable_only=False, limit=500, db=db, current_user=auth.user)
    first = list_variants(**arguments, offset=0)
    last = list_variants(**arguments, offset=1000)
    assert len(first['items']) == 500 and first['has_more']
    assert len(last['items']) == 1 and not last['has_more']
    summary = inventory_summary(clinic_id=auth.clinic_id, db=db, current_user=auth.user)
    assert summary['on_hand'] == summary['variant_count'] == 1001
