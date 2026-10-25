"""Exercise the actual migration against an old schema, preserving financial IDs."""
import importlib.util
import os
from pathlib import Path
import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations


def old_schema(connection):
    for table in ('clinics','clients','users','trash_items'):
        connection.execute(sa.text(f'CREATE TABLE {table} (id INTEGER PRIMARY KEY)'))
    for table in ('orders','contact_lens_orders'):
        connection.execute(sa.text(f'CREATE TABLE {table} (id INTEGER PRIMARY KEY, client_id INTEGER, clinic_id INTEGER, order_date DATE, order_data JSON, deleted_at TIMESTAMP, deleted_by_user_id INTEGER, trash_item_id INTEGER)'))
    connection.execute(sa.text('CREATE TABLE billings (id INTEGER PRIMARY KEY, order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE, contact_lens_id INTEGER REFERENCES contact_lens_orders(id) ON DELETE CASCADE, notes TEXT, currency VARCHAR(3), prepayment_amount FLOAT)'))
    connection.execute(sa.text('CREATE TABLE order_line_item (id INTEGER PRIMARY KEY, billings_id INTEGER REFERENCES billings(id) ON DELETE CASCADE, description TEXT, price FLOAT)'))
    connection.execute(sa.text('CREATE TABLE billing_payments (id INTEGER PRIMARY KEY, billing_id INTEGER REFERENCES billings(id) ON DELETE CASCADE, amount FLOAT)'))
    for table in ('clinics','clients','users','trash_items'):
        connection.execute(sa.text(f'INSERT INTO {table} (id) VALUES (1)'))
    connection.execute(sa.text("INSERT INTO orders VALUES (7,1,1,'2025-01-02','{\"prescription\":\"retained\"}',NULL,NULL,NULL)"))
    connection.execute(sa.text("INSERT INTO contact_lens_orders VALUES (8,1,1,'2025-02-03','{}','2025-03-04',1,1)"))
    connection.execute(sa.text("INSERT INTO billings VALUES (9,7,NULL,'retain notes','EUR',30)"))
    connection.execute(sa.text("INSERT INTO order_line_item VALUES (10,9,'retain item',80)"))
    connection.execute(sa.text('INSERT INTO billing_payments VALUES (11,9,30)'))


def run_migration(connection):
    path=Path(__file__).parents[1]/'alembic/versions/0041_shared_order_groups.py'
    spec=importlib.util.spec_from_file_location('group_migration',path)
    migration=importlib.util.module_from_spec(spec);spec.loader.exec_module(migration)
    with Operations.context(MigrationContext.configure(connection)):
        migration.upgrade()


@pytest.mark.parametrize('target',['sqlite', 'postgres'])
def test_real_backfill_keeps_payment_history(target):
    if target=='postgres':
        url=os.getenv('TEST_ORDER_GROUP_DATABASE_URL')
        if not url:pytest.skip('Isolated local Postgres not configured')
    else:url='sqlite:///:memory:'
    engine=sa.create_engine(url)
    with engine.begin() as connection:
        if target=='sqlite':connection.execute(sa.text('PRAGMA foreign_keys=ON'))
        else:
            connection.execute(sa.text('CREATE SCHEMA group_migration_test'))
            connection.execute(sa.text('SET search_path TO group_migration_test'))
        old_schema(connection);run_migration(connection)
        assert connection.execute(sa.text('SELECT COUNT(*) FROM order_groups')).scalar()==2
        assert connection.execute(sa.text('SELECT COUNT(*) FROM order_group_entries')).scalar()==2
        assert connection.execute(sa.text('SELECT id, amount FROM billing_payments')).one()==(11,30)
        assert connection.execute(sa.text('SELECT id, notes, currency, prepayment_amount FROM billings')).one()==(9,'retain notes','EUR',30)
        assert connection.execute(sa.text("SELECT deleted_at IS NOT NULL FROM order_groups WHERE creation_key='legacy:contact:8'")).scalar()
        assert connection.execute(sa.text('SELECT manually_edited FROM order_line_item WHERE id=10')).scalar()
        if target=='postgres':
            assert connection.execute(sa.text("SELECT bool_and(relrowsecurity) FROM pg_class WHERE relname IN ('order_groups','order_group_entries') AND relnamespace='group_migration_test'::regnamespace")).scalar()
            connection.execute(sa.text('DROP SCHEMA group_migration_test CASCADE'))
    engine.dispose()


def test_ambiguous_invoices_fail_before_creating_tables():
    engine=sa.create_engine('sqlite:///:memory:')
    with engine.begin() as connection:
        old_schema(connection)
        connection.execute(sa.text('INSERT INTO billings (id,order_id) VALUES (12,7)'))
        with pytest.raises(RuntimeError,match='duplicate billing'):
            run_migration(connection)
        assert 'order_groups' not in sa.inspect(connection).get_table_names()
        assert connection.execute(sa.text('SELECT COUNT(*) FROM billing_payments')).scalar()==1
