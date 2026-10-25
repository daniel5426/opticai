"""Execute the additive migrations and verify real PostgreSQL access controls."""
import importlib.util
import os
from pathlib import Path
from uuid import uuid4

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations


def load(name):
    path = Path(__file__).resolve().parents[2] / 'alembic/versions' / (name + '.py')
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize('target', ['sqlite', 'postgres'])
def test_agent_migrations_preserve_clinic_records_and_restrict_public_access(target):
    url = os.getenv('TEST_AGENT_DATABASE_URL') if target == 'postgres' else 'sqlite:///:memory:'
    if not url:
        pytest.skip('Isolated PostgreSQL test database not configured')
    parsed = sa.engine.make_url(url)
    if target == 'postgres':
        assert parsed.host in {None, 'localhost', '127.0.0.1'}
        assert parsed.database == 'opticai_agent_dev', 'Never run migration fixtures against a shared clinic database'
    engine = sa.create_engine(url)
    with engine.connect() as connection:
        transaction = connection.begin()
        try:
            schema = 'agent_migration_' + uuid4().hex
            if target == 'postgres':
                connection.execute(sa.text(f'CREATE SCHEMA {schema}'))
                connection.execute(sa.text(f'SET LOCAL search_path TO {schema}'))
            for table in ['companies', 'clinics', 'users', 'clients']:
                connection.execute(sa.text(f'CREATE TABLE {table} (id INTEGER PRIMARY KEY, name TEXT)'))
            connection.execute(sa.text('CREATE TABLE auth_sessions (id VARCHAR(36) PRIMARY KEY)'))
            connection.execute(sa.text("INSERT INTO clients VALUES (7, 'Existing clinic record')"))
            with Operations.context(MigrationContext.configure(connection)):
                load('0042_prysm_agents24').upgrade()
                load('0043_agent_principal_binding').upgrade()
                security = load('0044_agent_backend_access')
                roles = []
                if target == 'postgres':
                    roles = connection.execute(sa.text("SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated')")).scalars().all()
                    for table in security.TABLES:
                        connection.execute(sa.text(f'GRANT SELECT ON "{table}" TO PUBLIC'))
                        for role in roles:
                            connection.execute(sa.text(f'GRANT SELECT ON "{table}" TO {role}'))
                security.upgrade()
            assert connection.execute(sa.text('SELECT id, name FROM clients')).one() == (7, 'Existing clinic record')
            assert 'platform_principal_ref' in {c['name'] for c in sa.inspect(connection).get_columns('prysm_agent_contexts')}
            if target == 'postgres':
                for table in security.TABLES:
                    assert connection.execute(sa.text('SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass(:table)'), {'table': schema + '.' + table}).scalar() is True
                    for role in roles:
                        assert connection.execute(sa.text("SELECT has_table_privilege(:role,:table,'SELECT')"), {'role': role, 'table': schema + '.' + table}).scalar() is False
        finally:
            transaction.rollback()
    engine.dispose()


@pytest.mark.parametrize('target', ['sqlite', 'postgres'])
def test_report_schema_and_component_index_migrations_preserve_existing_rows(target):
    url = os.getenv('TEST_AGENT_DATABASE_URL') if target == 'postgres' else 'sqlite:///:memory:'
    if not url:
        pytest.skip('Isolated PostgreSQL test database not configured')
    parsed = sa.engine.make_url(url)
    if target == 'postgres':
        assert parsed.host in {None, 'localhost', '127.0.0.1'}
        assert parsed.database == 'opticai_agent_dev', 'Never run migration fixtures against a shared clinic database'
    engine = sa.create_engine(url)
    schema = 'agent_report_migration_' + uuid4().hex
    with engine.connect() as connection:
        if target == 'postgres':
            connection.execute(sa.text(f'CREATE SCHEMA {schema}'))
            connection.execute(sa.text(f'SET search_path TO {schema}'))
            connection.commit()
        try:
            _verify_report_migrations(connection)
        finally:
            connection.rollback()
            if target == 'postgres':
                connection.execute(sa.text(f'DROP SCHEMA {schema} CASCADE'))
                connection.commit()
    engine.dispose()


def _verify_report_migrations(connection):
    context = MigrationContext.configure(connection)
    with context.begin_transaction():
        for table in ['clinics', 'users', 'clients', 'files']:
            connection.execute(sa.text(f'CREATE TABLE {table} (id INTEGER PRIMARY KEY)'))
        connection.execute(sa.text('CREATE TABLE prysm_agent_jobs (id VARCHAR(36) PRIMARY KEY)'))
        connection.execute(sa.text('CREATE TABLE prescription_search_index (id INTEGER PRIMARY KEY, source_type TEXT, source_id INTEGER, eye TEXT)'))
        connection.execute(sa.text("INSERT INTO prescription_search_index VALUES (1, 'exam', 9, 'R')"))
        with Operations.context(context):
            load('0045_agent_search_reports').upgrade()
            index = load('0046_prescription_components')
            index.upgrade(); index.upgrade()
            assert connection.execute(sa.text('SELECT component_key FROM prescription_search_index')).scalar() is None
            assert {i['name'] for i in sa.inspect(connection).get_indexes('prescription_search_index')} == {'ix_prescription_component'}
            index.downgrade()
            load('0045_agent_search_reports').downgrade()
        assert connection.execute(sa.text('SELECT id,source_type,source_id,eye FROM prescription_search_index')).one() == (1, 'exam', 9, 'R')
