"""Read-only ownership checks must support pending tables without hiding schema drift."""
import pytest
from sqlalchemy import create_engine, text
from scripts.check_company_client_records import TABLES, pending_tables, preflight


@pytest.fixture
def baseline():
    engine = create_engine('sqlite:///:memory:')
    with engine.begin() as connection:
        connection.execute(text('CREATE TABLE alembic_version (version_num VARCHAR(64))'))
        connection.execute(text("INSERT INTO alembic_version VALUES ('0026_clinic_holiday_overrides')"))
        connection.execute(text('CREATE TABLE clinics (id INTEGER, company_id INTEGER)'))
        connection.execute(text('INSERT INTO clinics VALUES (1, 1), (2, 2)'))
        for table in TABLES:
            if table in ('order_groups', 'prysm_followup_tasks'):
                continue
            connection.execute(text(f'CREATE TABLE {table} (id INTEGER, company_id INTEGER, clinic_id INTEGER, client_id INTEGER, merged_into_client_id INTEGER, family_id INTEGER)'))
        connection.execute(text('INSERT INTO clients (id, company_id, clinic_id) VALUES (1, 1, 1)'))
        yield connection
    engine.dispose()


def test_pending_tables_do_not_hide_existing_ownership_conflicts(baseline):
    assert pending_tables(baseline) == {
        'order_groups': '0041_shared_order_groups',
        'prysm_followup_tasks': '0042_prysm_agents24',
    }
    assert preflight(baseline) == {}
    baseline.execute(text('INSERT INTO orders (id, company_id, clinic_id, client_id) VALUES (7, 1, 2, 1)'))
    assert preflight(baseline) == {'orders': {'count': 1, 'sample_ids': [7]}}
    assert baseline.execute(text('SELECT clinic_id FROM orders WHERE id=7')).scalar() == 2
    assert baseline.execute(text('SELECT version_num FROM alembic_version')).scalar() == '0026_clinic_holiday_overrides'


def test_missing_table_after_its_migration_blocks_preflight(baseline):
    baseline.execute(text("UPDATE alembic_version SET version_num='0042_prysm_agents24'"))
    with pytest.raises(RuntimeError, match='missing existing tables'):
        preflight(baseline)


def test_missing_legacy_table_blocks_preflight(baseline):
    baseline.execute(text('DROP TABLE orders'))
    with pytest.raises(RuntimeError, match='missing existing tables'):
        preflight(baseline)


def test_unknown_baseline_blocks_preflight(baseline):
    baseline.execute(text('DELETE FROM alembic_version'))
    with pytest.raises(RuntimeError, match='established Alembic baseline'):
        preflight(baseline)
