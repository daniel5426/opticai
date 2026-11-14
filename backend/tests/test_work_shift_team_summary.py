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

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from fastapi import HTTPException

from EndPoints.work_shifts import get_team_work_summary, get_work_shifts_by_user_and_range
from models import Clinic, Company, User, WorkShift


@pytest.fixture
def setup():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    db = sessionmaker(bind=engine)()
    company = Company(name="A", owner_full_name="A")
    db.add(company)
    db.flush()
    clinic, other = Clinic(company_id=company.id, name="A", unique_id="a"), Clinic(company_id=company.id, name="B", unique_id="b")
    db.add_all([clinic, other])
    db.flush()
    worker = User(company_id=company.id, clinic_id=clinic.id, username="worker", role_level=1)
    manager = User(company_id=company.id, clinic_id=clinic.id, username="manager", role_level=3)
    elsewhere = User(company_id=company.id, clinic_id=other.id, username="elsewhere", role_level=1)
    db.add_all([worker, manager, elsewhere])
    db.flush()
    db.add_all([
        WorkShift(user_id=worker.id, start_time="09:00", end_time="17:00", duration_minutes=480, date="2026-11-02", status="completed"),
        WorkShift(user_id=worker.id, start_time="18:00", end_time="20:00", duration_minutes=120, date="2026-11-02", status="completed"),
        WorkShift(user_id=worker.id, start_time="09:00", end_time=None, duration_minutes=None, date="2026-11-03", status="active"),
        WorkShift(user_id=worker.id, start_time="09:00", end_time="12:00", duration_minutes=180, date="2026-10-31", status="completed"),
        WorkShift(user_id=elsewhere.id, start_time="09:00", end_time="10:00", duration_minutes=60, date="2026-11-02", status="completed"),
    ])
    db.commit()
    return db, worker, manager, elsewhere


def test_a_manager_sees_each_workers_hours_in_the_range(setup):
    db, worker, manager, elsewhere = setup
    ids = f"{worker.id},{manager.id},{elsewhere.id}"
    rows = {row["user_id"]: row for row in get_team_work_summary(ids, date(2026, 11, 1), date(2026, 11, 30), db, manager)}
    assert rows[worker.id] == {"user_id": worker.id, "total_minutes": 600, "shifts": 3, "active_days": 2, "open_shifts": 1}
    assert rows[manager.id]["shifts"] == 0
    # Another clinic's worker is outside a manager's scope.
    assert elsewhere.id not in rows


def test_a_worker_only_gets_their_own_hours(setup):
    db, worker, manager, elsewhere = setup
    rows = get_team_work_summary(f"{worker.id},{manager.id}", date(2026, 11, 1), date(2026, 11, 30), db, worker)
    assert [row["user_id"] for row in rows] == [worker.id]


def test_a_workers_shifts_in_the_range_come_in_order(setup):
    db, worker, manager, elsewhere = setup
    shifts = get_work_shifts_by_user_and_range(worker.id, date(2026, 11, 1), date(2026, 11, 30), db, manager)
    assert [(shift.date, shift.start_time) for shift in shifts] == [("2026-11-02", "09:00"), ("2026-11-02", "18:00"), ("2026-11-03", "09:00")]
    with pytest.raises(HTTPException):
        get_work_shifts_by_user_and_range(elsewhere.id, date(2026, 11, 1), date(2026, 11, 30), db, manager)
