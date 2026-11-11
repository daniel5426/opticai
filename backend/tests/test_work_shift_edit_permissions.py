import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "development-secret-for-tests-only")
os.environ.setdefault("TOKEN_ENCRYPTION_KEY", "development-encryption-key-for-tests")

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from EndPoints.work_shifts import update_work_shift
from models import Clinic, Company, User, WorkShift
from schemas import WorkShiftUpdate


@pytest.fixture
def setup():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    db = sessionmaker(bind=engine)()
    company = Company(name="A", owner_full_name="A")
    db.add(company)
    db.flush()
    clinic = Clinic(company_id=company.id, name="A", unique_id="a")
    db.add(clinic)
    db.flush()
    users = {
        level: User(company_id=company.id, clinic_id=clinic.id, username=f"user{level}", role_level=level)
        for level in (1, 3, 4)
    }
    db.add_all(users.values())
    db.flush()
    shift = WorkShift(user_id=users[1].id, start_time="09:00", end_time="17:00", duration_minutes=480, date="2026-11-10", status="completed")
    db.add(shift)
    db.commit()
    return db, users, shift


def test_a_ceo_edits_a_workers_shift(setup):
    db, users, shift = setup
    updated = update_work_shift(shift.id, WorkShiftUpdate(start_time="08:30", duration_minutes=510), db, users[4])
    assert (updated.start_time, updated.duration_minutes) == ("08:30", 510)


def test_a_manager_cannot_edit_a_workers_shift(setup):
    db, users, shift = setup
    with pytest.raises(HTTPException) as error:
        update_work_shift(shift.id, WorkShiftUpdate(start_time="08:30"), db, users[3])
    assert error.value.status_code == 403
    db.refresh(shift)
    assert shift.start_time == "09:00"


def test_a_worker_still_updates_their_own_shift(setup):
    db, users, shift = setup
    updated = update_work_shift(shift.id, WorkShiftUpdate(end_time="18:00"), db, users[1])
    assert updated.end_time == "18:00"
