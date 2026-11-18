import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "development-secret-for-tests-only")
os.environ.setdefault("TOKEN_ENCRYPTION_KEY", "development-encryption-key-for-tests")

from datetime import date

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from auth import get_current_user
from database import Base, get_db
from EndPoints.calendar_events import router
from EndPoints.dashboard import router as dashboard_router
from models import CalendarEvent, Clinic, Company, User


@pytest.fixture
def setup():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    db = sessionmaker(bind=engine)()
    company, other_company = Company(name="A", owner_full_name="A"), Company(name="B", owner_full_name="B")
    db.add_all([company, other_company])
    db.flush()
    clinic = Clinic(company_id=company.id, name="A", unique_id="a")
    foreign = Clinic(company_id=other_company.id, name="B", unique_id="b")
    db.add_all([clinic, foreign])
    db.flush()
    user = User(company_id=company.id, clinic_id=clinic.id, username="worker", role_level=1)
    db.add(user)
    db.commit()
    app = FastAPI()
    app.include_router(router)
    app.include_router(dashboard_router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user
    with TestClient(app) as client:
        yield db, user, clinic, foreign, client


def revision(db, clinic):
    db.expire_all()
    return db.get(Clinic, clinic.id).google_calendar_revision


def test_create_list_edit_and_delete_a_general_event(setup):
    db, user, clinic, _, http = setup
    created = http.post("/calendar-events", json={"clinic_id": clinic.id, "user_id": user.id, "date": "2026-11-17",
                                                  "time": "09:30", "duration": 45, "text": "  Staff meeting  "})
    assert created.status_code == 200, created.text
    event = created.json()
    assert event["text"] == "Staff meeting" and event["duration"] == 45
    assert revision(db, clinic) == 1

    listed = http.get(f"/calendar-events?clinic_id={clinic.id}&start_date=2026-11-01&end_date=2026-11-30").json()
    assert [item["id"] for item in listed] == [event["id"]]
    assert http.get(f"/calendar-events?clinic_id={clinic.id}&start_date=2026-12-01").json() == []
    home = http.get(f"/dashboard/home?clinic_id={clinic.id}&start_date=2026-11-01&end_date=2026-11-30").json()
    assert [item["text"] for item in home["events"]] == ["Staff meeting"]

    updated = http.put(f"/calendar-events/{event['id']}", json={"date": "2026-11-18", "time": "14:00", "duration": 30,
                                                                "text": "Lens delivery"}).json()
    assert (updated["date"], updated["time"], updated["text"]) == ("2026-11-18", "14:00", "Lens delivery")
    assert revision(db, clinic) == 2

    assert http.delete(f"/calendar-events/{event['id']}").json() == {"status": "deleted"}
    assert db.query(CalendarEvent).count() == 0
    assert revision(db, clinic) == 3


@pytest.mark.parametrize("changes", [{"text": "   "}, {"time": "9:30"}, {"time": "24:00"}, {"duration": 0}, {"color": "red"}])
def test_invalid_events_are_rejected(setup, changes):
    _, _, clinic, _, http = setup
    data = {"clinic_id": clinic.id, "date": "2026-11-17", "time": "09:30", "text": "Meeting", **changes}
    assert http.post("/calendar-events", json=data).status_code == 422


def test_other_companies_events_are_out_of_reach(setup):
    db, _, clinic, foreign, http = setup
    assert http.post("/calendar-events", json={"clinic_id": foreign.id, "date": "2026-11-17", "time": "09:30", "text": "x"}).status_code == 403
    assert http.get(f"/calendar-events?clinic_id={foreign.id}").status_code == 403
    row = CalendarEvent(company_id=foreign.company_id, clinic_id=foreign.id, date=date(2026, 11, 17), time="09:00", duration=30, text="Theirs")
    db.add(row)
    db.commit()
    assert http.put(f"/calendar-events/{row.id}", json={"date": "2026-11-17", "time": "09:00", "text": "Mine"}).status_code == 404
    assert http.delete(f"/calendar-events/{row.id}").status_code == 404
    db.expire_all()
    assert db.get(CalendarEvent, row.id).text == "Theirs"
