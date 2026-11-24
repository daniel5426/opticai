"""Apply the new release revisions only to a newly created disposable PostgreSQL cluster."""
from pathlib import Path
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import text
from backend.tests.test_company_record_migration import pg_engine
from database import Base
from config import settings


def test_release_migrations_preserve_existing_clients_and_fit_version_table(pg_engine, monkeypatch):
    Base.metadata.create_all(pg_engine)
    with pg_engine.begin() as connection:
        # Match Supabase's existing roles in this disposable cluster.
        connection.execute(text('CREATE ROLE anon'))
        connection.execute(text('CREATE ROLE authenticated'))
        # These additive campaign tables are newer than the stamped release fixture.
        connection.execute(text('ALTER TABLE users DROP COLUMN google_calendar_routes'))
        connection.execute(text('ALTER TABLE users DROP COLUMN google_calendar_pull_at, DROP COLUMN google_calendar_pull_since, DROP COLUMN google_calendar_pull_error'))
        connection.execute(text('ALTER TABLE clinics DROP COLUMN google_calendar_revision'))
        connection.execute(text('DROP TABLE google_calendar_sync'))
        for table in ('lookup_frame_supplier', 'lookup_contact_lens_supplier', 'lookup_frame_color', 'lookup_contact_lens_color'):
            connection.execute(text(f'DROP TABLE {table}'))
        connection.execute(text('DROP TABLE calendar_events'))
        connection.execute(text('DROP TABLE exam_layout_clinic_activation'))
        connection.execute(text('ALTER TABLE exam_layouts DROP COLUMN company_id, DROP COLUMN canonical_layout_id'))
        connection.execute(text('ALTER TABLE users DROP COLUMN google_token_key_id'))
        connection.execute(text('ALTER TABLE users DROP COLUMN google_oauth_client_type'))
        connection.execute(text('ALTER TABLE users DROP COLUMN google_token_expiry'))
        names = ['scanner_events','scanner_scans','scanner_attempts','scanner_pairings','scanner_grants','scanner_phones','scanner_devices','messaging_periods','messaging_consents','messaging_provider_states','messaging_refunds','messaging_events','messaging_suppressions','campaign_contact_claims','campaign_deliveries','campaign_runs','campaign_details','messaging_topups','messaging_ledger','messaging_clinics','messaging_catalog','messaging_accounts']
        for name in names:
            connection.execute(text('DROP TABLE ' + name))
        # Recreate the pre-release shape instead of leaving newer model columns in place.
        connection.execute(text('DROP TABLE discount_definitions'))
        connection.execute(text('ALTER TABLE billings DROP COLUMN line_subtotal_offset'))
        connection.execute(text('ALTER TABLE billings DROP COLUMN line_total_offset'))
        connection.execute(text('ALTER TABLE auth_action_tokens DROP COLUMN failed_attempts'))
        connection.execute(text('ALTER TABLE clients DROP COLUMN send_notifications'))
        connection.execute(text('ALTER TABLE order_line_item DROP COLUMN discount_percent'))
        connection.execute(text('ALTER TABLE optical_exams DROP COLUMN creation_request_hash'))
        connection.execute(text('ALTER TABLE optical_exams DROP COLUMN creation_key CASCADE'))
        connection.execute(text('ALTER TABLE exam_layouts DROP COLUMN appointment_duration'))
        connection.execute(text('ALTER TABLE exam_layouts DROP COLUMN appointment_color'))
        connection.execute(text("INSERT INTO companies(id,name,owner_full_name) VALUES (1,'Fixture','Owner')"))
        connection.execute(text("INSERT INTO clinics(id,company_id,name,unique_id,entry_pin_version,maintenance_mode) VALUES (1,1,'Clinic','fixture',1,false)"))
        connection.execute(text("INSERT INTO clients(id,company_id,clinic_id,first_name) VALUES (1,1,1,'Preserve')"))
        connection.execute(text("INSERT INTO clinics(id,company_id,name,unique_id,entry_pin_version,maintenance_mode) VALUES (2,1,'Second','second',1,false)"))
        connection.execute(text("""
            INSERT INTO exam_layouts(id,clinic_id,name,layout_data,is_default,is_active,sort_index,seed_key,seed_version,is_seeded_default)
            VALUES (1,1,'Seed','{}',true,true,1,'seed',1,true),
                   (2,2,'Seed','{}',true,false,1,'seed',1,true),
                   (3,2,'Customized','{"custom": true}',true,true,2,'custom',1,true)
        """))
        connection.execute(text("INSERT INTO optical_exams(id,company_id,clinic_id,client_id) VALUES (1,1,2,1)"))
        connection.execute(text("INSERT INTO exam_layout_instances(id,exam_id,layout_id,exam_data) VALUES (1,1,2,'{}')"))
        connection.execute(text("INSERT INTO appointments(id,company_id,clinic_id,client_id,exam_layout_id) VALUES (1,1,2,1,2)"))
        connection.execute(text("INSERT INTO lookup_supplier(clinic_id,name) VALUES (1,'Fixture supplier')"))
        connection.execute(text("INSERT INTO lookup_color(clinic_id,name) VALUES (1,'Fixture color')"))
        for index in ('ix_optical_exams_client_id', 'ix_medical_logs_client_id', 'ix_medical_logs_clinic_id', 'ix_campaigns_clinic_id', 'ix_order_groups_clinic_opened'):
            connection.execute(text(f'DROP INDEX IF EXISTS {index}'))
    monkeypatch.setattr(settings, 'DATABASE_URL', f'postgresql+psycopg2://company_test@/postgres?host={pg_engine.url.host}&port={pg_engine.url.port}')
    config = Config(str(Path(__file__).parents[1] / 'alembic.ini'))
    config.set_main_option('script_location', str(Path(__file__).parents[1] / 'alembic'))
    command.stamp(config, '0050_agent_report_completion')
    command.upgrade(config, 'head')
    with pg_engine.connect() as connection:
        assert connection.execute(text('SELECT version_num FROM alembic_version')).scalar() == ScriptDirectory.from_config(config).get_current_head()
        assert connection.execute(text("SELECT data_type FROM information_schema.columns WHERE table_name='exam_layouts' AND column_name='appointment_duration'")).scalar() == 'integer'
        assert connection.execute(text("SELECT data_type FROM information_schema.columns WHERE table_name='exam_layouts' AND column_name='appointment_color'")).scalar() == 'character varying'
        assert connection.execute(text(
            'SELECT id, company_id, canonical_layout_id FROM exam_layouts ORDER BY id'
        )).all() == [(1, 1, None), (2, 1, 1), (3, 1, None)]
        assert connection.execute(text(
            'SELECT layout_id, clinic_id, is_active FROM exam_layout_clinic_activation'
        )).one() == (1, 2, False)
        assert connection.execute(text('SELECT layout_id FROM exam_layout_instances')).scalar_one() == 1
        assert connection.execute(text('SELECT exam_layout_id FROM appointments')).scalar_one() == 1
        assert connection.execute(text('SELECT email_per_clinic,sms_per_clinic FROM messaging_catalog WHERE id=1')).one() == (1000,200)
        assert connection.execute(text('SELECT count(*) FROM messaging_consents')).scalar() == 0
        assert connection.execute(text('SELECT provider_login,checkout_mode FROM messaging_topups LIMIT 1')).first() is None
        assert connection.execute(text('SELECT first_name,send_notifications FROM clients WHERE id=1')).one() == ('Preserve', False)
        for table in ('lookup_supplier', 'lookup_frame_supplier', 'lookup_contact_lens_supplier'):
            assert connection.execute(text(f'SELECT clinic_id, name FROM {table}')).one() == (1, 'Fixture supplier')
        for table in ('lookup_color', 'lookup_frame_color', 'lookup_contact_lens_color'):
            assert connection.execute(text(f'SELECT clinic_id, name FROM {table}')).one() == (1, 'Fixture color')
        assert connection.execute(text(
            "SELECT count(*) FROM pg_class WHERE relrowsecurity AND relname IN "
            "('lookup_frame_supplier', 'lookup_contact_lens_supplier', 'lookup_frame_color', 'lookup_contact_lens_color')"
        )).scalar() == 4
        assert connection.execute(text("SELECT count(*) FROM pg_indexes WHERE indexname IN ('ix_optical_exams_client_id','ix_medical_logs_client_id','ix_medical_logs_clinic_id','ix_campaigns_clinic_id','ix_order_groups_clinic_opened')")).scalar() == 5

        for table in ('terminal_connections', 'terminal_checkouts', 'terminal_operations'):
            row = connection.execute(text("""
                SELECT relrowsecurity,
                       has_table_privilege('anon', oid, 'SELECT'),
                       has_table_privilege('authenticated', oid, 'SELECT')
                FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relname = :table
            """), {'table': table}).one()
            assert row == (True, False, False)
            assert connection.execute(text(f'SELECT count(*) FROM {table}')).scalar_one() == 0
