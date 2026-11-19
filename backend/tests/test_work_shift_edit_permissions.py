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
from EndPoints.work_shifts import create_work_shift, delete_work_shift, update_work_shift
from models import Clinic, Company, User, WorkShift
from schemas import WorkShiftCreate, WorkShiftUpdate


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
        for level in (1, 2, 3, 4)
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


@pytest.mark.parametrize("role_level", [1, 2])
def test_clock_in_stays_available_without_manual_shift_permissions(setup, role_level):
    db, users, _ = setup
    user = users[role_level]
    clock_in = WorkShiftCreate(user_id=user.id, start_time="09:00", date="2026-11-11")
    shift = create_work_shift(clock_in, db, user)
    assert shift.status == "active"

    with pytest.raises(HTTPException) as create_error:
        create_work_shift(clock_in.model_copy(update={"end_time": "17:00", "status": "completed"}), db, user)
    with pytest.raises(HTTPException) as delete_error:
        delete_work_shift(shift.id, db, user)
    assert create_error.value.status_code == delete_error.value.status_code == 403
    assert db.get(WorkShift, shift.id) is not None


@pytest.mark.parametrize("role_level", [3, 4])
def test_manager_and_ceo_can_add_and_delete_completed_shifts(setup, role_level):
    db, users, _ = setup
    manual_shift = WorkShiftCreate(
        user_id=users[2].id, start_time="22:00", end_time="06:00",
        date="2026-11-11", duration_minutes=480, status="completed",
    )
    shift = create_work_shift(manual_shift, db, users[role_level])
    assert (shift.user_id, shift.duration_minutes, shift.status) == (users[2].id, 480, "completed")
    shift_id = shift.id
    delete_work_shift(shift_id, db, users[role_level])
    assert db.get(WorkShift, shift_id) is None


def test_manager_cannot_add_or_delete_shifts_for_another_clinic(setup):
    db, users, shift = setup
    other_clinic = Clinic(company_id=users[3].company_id, name="B", unique_id="b")
    db.add(other_clinic)
    db.flush()
    users[1].clinic_id = other_clinic.id
    db.commit()

    manual_shift = WorkShiftCreate(
        user_id=users[1].id, start_time="09:00", end_time="17:00",
        date="2026-11-11", duration_minutes=480, status="completed",
    )
    with pytest.raises(HTTPException) as create_error:
        create_work_shift(manual_shift, db, users[3])
    with pytest.raises(HTTPException) as delete_error:
        delete_work_shift(shift.id, db, users[3])
    assert create_error.value.status_code == delete_error.value.status_code == 403
