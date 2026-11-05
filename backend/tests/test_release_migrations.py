"""Apply the three new revisions only to a newly created disposable PostgreSQL cluster."""
from pathlib import Path
from alembic import command
from alembic.config import Config
from sqlalchemy import text
from backend.tests.test_company_record_migration import pg_engine
from database import Base
from config import settings


def test_release_migrations_preserve_existing_clients_and_fit_version_table(pg_engine, monkeypatch):
    Base.metadata.create_all(pg_engine)
    with pg_engine.begin() as connection:
        connection.execute(text('ALTER TABLE clients DROP COLUMN send_notifications'))
        connection.execute(text("INSERT INTO companies(id,name,owner_full_name) VALUES (1,'Fixture','Owner')"))
        connection.execute(text("INSERT INTO clinics(id,company_id,name,unique_id,entry_pin_version,maintenance_mode) VALUES (1,1,'Clinic','fixture',1,false)"))
        connection.execute(text("INSERT INTO clients(id,company_id,clinic_id,first_name) VALUES (1,1,1,'Preserve')"))
        for index in ('ix_optical_exams_client_id', 'ix_medical_logs_client_id', 'ix_medical_logs_clinic_id', 'ix_campaigns_clinic_id', 'ix_order_groups_clinic_opened'):
            connection.execute(text(f'DROP INDEX IF EXISTS {index}'))
    monkeypatch.setattr(settings, 'DATABASE_URL', f'postgresql+psycopg2://company_test@/postgres?host={pg_engine.url.host}&port={pg_engine.url.port}')
    config = Config(str(Path(__file__).parents[1] / 'alembic.ini'))
    config.set_main_option('script_location', str(Path(__file__).parents[1] / 'alembic'))
    command.stamp(config, '0050_agent_report_completion')
    command.upgrade(config, 'head')
    with pg_engine.connect() as connection:
        assert connection.execute(text('SELECT version_num FROM alembic_version')).scalar() == '0053_client_send_notifications'
        assert connection.execute(text('SELECT first_name,send_notifications FROM clients WHERE id=1')).one() == ('Preserve', False)
        assert connection.execute(text("SELECT count(*) FROM pg_indexes WHERE indexname IN ('ix_optical_exams_client_id','ix_medical_logs_client_id','ix_medical_logs_clinic_id','ix_campaigns_clinic_id','ix_order_groups_clinic_opened')")).scalar() == 5
