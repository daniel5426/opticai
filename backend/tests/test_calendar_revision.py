import os
import sys
from datetime import date
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "development-secret-for-tests-only")
os.environ.setdefault("TOKEN_ENCRYPTION_KEY", "development-encryption-key-for-tests")

from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from models import Appointment, Client, Clinic, Company


def _setup():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    db = sessionmaker(bind=engine)()
    company = Company(name="A", owner_full_name="A")
    db.add(company)
    db.flush()
    clinic, other = Clinic(company_id=company.id, name="A", unique_id="a"), Clinic(company_id=company.id, name="B", unique_id="b")
    db.add_all([clinic, other])
    db.flush()
    client = Client(company_id=company.id, clinic_id=clinic.id, first_name="A")
    db.add(client)
    db.commit()
    return db, company, clinic, other, client


def _revisions(db, *clinics):
    db.expire_all()
    return [db.get(Clinic, clinic.id).google_calendar_revision for clinic in clinics]


def test_every_appointment_write_moves_its_clinics_calendar_revision():
    db, company, clinic, other, client = _setup()
    assert _revisions(db, clinic, other) == [0, 0]

    appointment = Appointment(company_id=company.id, clinic_id=clinic.id, client_id=client.id, date=date(2026, 11, 15), time="09:00", duration=30)
    db.add(appointment)
    db.commit()
    assert _revisions(db, clinic, other) == [1, 0]

    appointment = db.get(Appointment, appointment.id)
    appointment.time = "10:00"
    db.commit()
    assert _revisions(db, clinic, other) == [2, 0]

    # Moving it to the trash, and purging it, change the calendar too.
    appointment = db.get(Appointment, appointment.id)
    appointment.deleted_at = func.now()
    db.commit()
    assert _revisions(db, clinic, other) == [3, 0]

    db.delete(db.get(Appointment, appointment.id))
    db.commit()
    # Another clinic's calendar never moves.
    assert _revisions(db, clinic, other) == [4, 0]


def test_writes_that_do_not_touch_appointments_leave_the_revision():
    db, company, clinic, other, client = _setup()
    client = db.get(Client, client.id)
    client.first_name = "B"
    db.commit()
    assert _revisions(db, clinic) == [0]
