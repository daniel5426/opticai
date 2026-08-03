import os
import sys
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "development-secret-for-tests-only")
os.environ.setdefault("TOKEN_ENCRYPTION_KEY", "development-encryption-key-for-tests")

from auth import get_current_user
from database import Base, get_db
from EndPoints.clinic_holidays import _official_holidays_for_year
from main import app
from models import Clinic, Company, User


def _session_factory():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    return SessionLocal


def _client(SessionLocal, current_user_id: int):
    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    def override_current_user():
        with SessionLocal() as db:
            return db.get(User, current_user_id)

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_current_user
    return TestClient(app)


def _seed(SessionLocal):
    with SessionLocal() as db:
        company = Company(name="Company", owner_full_name="Owner")
        db.add(company)
        db.flush()
        clinic = Clinic(company_id=company.id, name="Clinic", unique_id="holiday-clinic")
        db.add(clinic)
        db.flush()
        manager = User(company_id=company.id, clinic_id=clinic.id, username="manager", role_level=3, is_active=True)
        user = User(company_id=company.id, clinic_id=clinic.id, username="user", role_level=2, is_active=True)
        db.add_all([manager, user])
        db.commit()
        return clinic.id, manager.id, user.id


def test_generates_2026_israeli_holidays():
    holidays = _official_holidays_for_year(2026)
    assert holidays[next(day for day in holidays if day.isoformat() == "2026-04-02")] == "א׳ פסח"
    assert holidays[next(day for day in holidays if day.isoformat() == "2026-09-21")] == "יום כיפור"


def test_manager_can_add_clinic_holiday_and_it_overrides_official_name():
    SessionLocal = _session_factory()
    clinic_id, manager_id, _ = _seed(SessionLocal)
    with _client(SessionLocal, manager_id) as client:
        response = client.post(
            f"/api/v1/clinic-holidays/?clinic_id={clinic_id}",
            json={"holiday_date": "2026-04-02", "name": "פסח - סגור במרפאה"},
        )
        assert response.status_code == 200, response.text
        holiday_id = response.json()["id"]

        response = client.get(f"/api/v1/clinic-holidays/?clinic_id={clinic_id}&year=2026")
        assert response.status_code == 200, response.text
        holiday = next(item for item in response.json() if item["date"] == "2026-04-02")
        assert holiday == {
            "id": holiday_id,
            "date": "2026-04-02",
            "name": "פסח - סגור במרפאה",
            "source": "clinic",
        }

        response = client.delete(f"/api/v1/clinic-holidays/{holiday_id}")
        assert response.status_code == 204, response.text

        response = client.get(f"/api/v1/clinic-holidays/?clinic_id={clinic_id}&year=2026")
        holiday = next(item for item in response.json() if item["date"] == "2026-04-02")
        assert holiday["name"] == "א׳ פסח"
        assert holiday["source"] == "official"


def test_non_manager_cannot_manage_clinic_holidays():
    SessionLocal = _session_factory()
    clinic_id, _, user_id = _seed(SessionLocal)
    with _client(SessionLocal, user_id) as client:
        response = client.post(
            f"/api/v1/clinic-holidays/?clinic_id={clinic_id}",
            json={"holiday_date": "2026-06-01", "name": "יום סגור"},
        )
    assert response.status_code == 403
