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
from main import app
from models import Client, Clinic, Company, Order, User


def _session_factory():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    return TestingSessionLocal


def _seed(SessionLocal):
    with SessionLocal() as db:
        company_a = Company(name="A", owner_full_name="Owner A")
        company_b = Company(name="B", owner_full_name="Owner B")
        db.add_all([company_a, company_b])
        db.flush()

        clinic_a = Clinic(company_id=company_a.id, name="A1", unique_id="a1")
        clinic_b = Clinic(company_id=company_b.id, name="B1", unique_id="b1")
        db.add_all([clinic_a, clinic_b])
        db.flush()

        ceo = User(company_id=company_a.id, clinic_id=None, username="ceo", role_level=4, is_active=True)
        clinic_user = User(company_id=company_a.id, clinic_id=clinic_a.id, username="clinic-user", role_level=2, is_active=True)
        other_user = User(company_id=company_b.id, clinic_id=clinic_b.id, username="other-user", role_level=2, is_active=True)
        db.add_all([ceo, clinic_user, other_user])
        db.flush()

        client_a = Client(company_id=company_a.id, clinic_id=clinic_a.id, first_name="A", last_name="Client")
        client_b = Client(company_id=company_b.id, clinic_id=clinic_b.id, first_name="B", last_name="Client")
        db.add_all([client_a, client_b])
        db.commit()

        return {
            "ceo": ceo.id,
            "clinic_user": clinic_user.id,
            "other_user": other_user.id,
            "clinic_a": clinic_a.id,
            "clinic_b": clinic_b.id,
            "client_a": client_a.id,
            "client_b": client_b.id,
        }


def _client(SessionLocal, current_user_id):
    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    def override_current_user():
        with SessionLocal() as db:
            return db.query(User).filter(User.id == current_user_id).one()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_current_user
    return TestClient(app)


def test_ceo_can_create_order_for_company_clinic_and_user_id_zero_defaults():
    SessionLocal = _session_factory()
    ids = _seed(SessionLocal)

    with _client(SessionLocal, ids["ceo"]) as client:
        response = client.post(
            "/api/v1/orders/upsert-full",
            json={
                "order": {
                    "client_id": ids["client_a"],
                    "clinic_id": ids["clinic_a"],
                    "order_date": "2026-05-03",
                    "type": "regular",
                    "user_id": 0,
                    "order_data": {},
                },
                "billing": None,
                "line_items": [],
            },
        )

    assert response.status_code == 200, response.text
    with SessionLocal() as db:
        order = db.query(Order).one()
        assert order.user_id == ids["ceo"]
        assert order.clinic_id == ids["clinic_a"]


def test_order_upsert_rejects_invalid_assigned_user_without_integrity_error():
    SessionLocal = _session_factory()
    ids = _seed(SessionLocal)

    with _client(SessionLocal, ids["ceo"]) as client:
        response = client.post(
            "/api/v1/orders/upsert-full",
            json={
                "order": {
                    "client_id": ids["client_a"],
                    "clinic_id": ids["clinic_a"],
                    "order_date": "2026-05-03",
                    "type": "regular",
                    "user_id": ids["other_user"],
                    "order_data": {},
                },
                "billing": None,
                "line_items": [],
            },
        )

    assert response.status_code == 403
    assert "IntegrityError" not in response.text
    with SessionLocal() as db:
        assert db.query(Order).count() == 0


def test_clinic_user_cannot_create_order_for_other_company_client_or_clinic():
    SessionLocal = _session_factory()
    ids = _seed(SessionLocal)

    with _client(SessionLocal, ids["clinic_user"]) as client:
        response = client.post(
            "/api/v1/orders/upsert-full",
            json={
                "order": {
                    "client_id": ids["client_b"],
                    "clinic_id": ids["clinic_b"],
                    "order_date": "2026-05-03",
                    "type": "regular",
                    "user_id": ids["clinic_user"],
                    "order_data": {},
                },
                "billing": None,
                "line_items": [],
            },
        )

    assert response.status_code == 403
    with SessionLocal() as db:
        assert db.query(Order).count() == 0
