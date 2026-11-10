"""Replica locking qualified against disposable PostgreSQL, never staging."""
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from types import SimpleNamespace
from sqlalchemy.orm import sessionmaker
from backend.tests.test_company_record_migration import pg_engine
from database import Base
from models import Appointment, Company, Clinic, Client, User, GoogleCalendarSync
from auth import encrypt_secret
from services import google_calendar as calendar


def test_replicas_skip_the_locked_appointment_and_later_edits_remain_pending(pg_engine, monkeypatch):
    Base.metadata.create_all(pg_engine)
    sessions = sessionmaker(bind=pg_engine, autoflush=False, expire_on_commit=False)
    with sessions() as db:
        company=Company(name='Calendar replica test',owner_full_name='Synthetic');db.add(company);db.flush()
        clinic=Clinic(company_id=company.id,name='Synthetic',unique_id='calendar-replicas');db.add(clinic);db.flush()
        user=User(company_id=company.id,clinic_id=clinic.id,username='calendar-replicas',google_account_connected=True,google_calendar_sync_enabled=True,google_access_token=encrypt_secret('marker'));db.add(user)
        client=Client(company_id=company.id,clinic_id=clinic.id,first_name='Synthetic');db.add(client);db.flush()
        appointment=Appointment(company_id=company.id,clinic_id=clinic.id,client_id=client.id,user_id=user.id,date=date(2026,11,12),time='10:00');db.add(appointment)
        calendar.enqueue(db,appointment);db.commit();appointment_id=appointment.id
    entered, release = threading.Event(), threading.Event()
    def send(*args, **kwargs):
        entered.set()
        assert release.wait(5)
        return SimpleNamespace(status_code=200,ok=True,json=lambda:{})
    monkeypatch.setattr(calendar.requests,'request',send)
    def consume():
        with sessions() as db:return calendar.run_once(db)
    with ThreadPoolExecutor(2) as pool:
        first=pool.submit(consume)
        try:
            assert entered.wait(5)
            assert pool.submit(consume).result(timeout=2) is False
        finally:release.set()
        assert first.result(timeout=5) is True
    with sessions() as db:
        appointment=db.get(Appointment,appointment_id);original=appointment.google_calendar_event_id
        appointment.time='11:00';calendar.enqueue(db,appointment);db.commit()
        row=db.query(GoogleCalendarSync).filter_by(appointment_id=appointment_id).one()
        assert row.status=='pending' and row.event_id==original
        assert calendar.run_once(db)
        assert row.status=='synced' and appointment.google_calendar_event_id==original
