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


def test_reconnect_releases_credentials_before_waiting_on_an_inflight_appointment(pg_engine, monkeypatch):
    from sqlalchemy import event
    from unittest.mock import Mock
    from datetime import timedelta
    from EndPoints.google_calendar import connect, Connection
    Base.metadata.create_all(pg_engine)
    sessions=sessionmaker(bind=pg_engine,autoflush=False,expire_on_commit=False)
    with sessions() as db:
        company=Company(name='Reconnect locking test',owner_full_name='Synthetic');db.add(company);db.flush()
        clinic=Clinic(company_id=company.id,name='Synthetic',unique_id='calendar-reconnect-lock');db.add(clinic);db.flush()
        user=User(company_id=company.id,clinic_id=clinic.id,username='calendar-reconnect-lock',google_account_connected=True,
            google_calendar_sync_enabled=True,google_account_email='synthetic@example.com',google_access_token=encrypt_secret('marker'))
        client=Client(company_id=company.id,clinic_id=clinic.id,first_name='Synthetic');db.add_all([user,client]);db.flush()
        appt=Appointment(company_id=company.id,clinic_id=clinic.id,user_id=user.id,client_id=client.id,date=date.today()+timedelta(days=1),time='10:00')
        db.add(appt);calendar.enqueue(db,appt);db.commit();user_id=user.id
    entered, release=threading.Event(),threading.Event()
    original=calendar.process
    def paused(db,row):
        entered.set();assert release.wait(5);original(db,row)
    monkeypatch.setattr(calendar,'process',paused)
    monkeypatch.setattr(calendar.settings,'GOOGLE_WEB_CLIENT_ID','web-client')
    monkeypatch.setattr(calendar.requests,'request',Mock(return_value=SimpleNamespace(status_code=200,ok=True,json=lambda:{})))
    monkeypatch.setattr(calendar.requests,'get',Mock(side_effect=[
        SimpleNamespace(ok=True,json=lambda:{'aud':'web-client','scope':calendar.CALENDAR_SCOPE}),
        SimpleNamespace(ok=True,json=lambda:{'email':'synthetic@example.com','verified_email':True})]))
    def consume():
        with sessions() as db:return calendar.run_once(db)
    def reconnect():
        with sessions() as db:
            event.listen(db,'after_commit',lambda _:release.set())
            return connect(Connection(access_token='new-marker',refresh_token='new-refresh'),db,db.get(User,user_id))
    with ThreadPoolExecutor(2) as pool:
        worker=pool.submit(consume)
        try:
            assert entered.wait(5)
            result=pool.submit(reconnect).result(timeout=8)
            assert result['connected']
            assert worker.result(timeout=5)
        finally:release.set()
