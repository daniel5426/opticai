import os
import sys
from datetime import date, datetime, timezone
from pathlib import Path

from fastapi import FastAPI
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

from EndPoints import clients as clients_endpoint
from EndPoints import migration_source_data as source_data_endpoint
from database import Base, get_db
from models import Client, Clinic, Company, ContactLensOrder, MigrationSourceLink, OpticalExam, Order, User


def _session_factory():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


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
        user_a = User(company_id=company_a.id, clinic_id=clinic_a.id, username="staff-a", role_level=2, is_active=True)
        user_b = User(company_id=company_b.id, clinic_id=clinic_b.id, username="staff-b", role_level=2, is_active=True)
        db.add_all([user_a, user_b])
        db.flush()
        client_a = Client(company_id=company_a.id, clinic_id=clinic_a.id, first_name="Dana")
        client_b = Client(company_id=company_b.id, clinic_id=clinic_b.id, first_name="Noa")
        db.add_all([client_a, client_b])
        db.flush()
        exam = OpticalExam(client_id=client_a.id, clinic_id=clinic_a.id, user_id=user_a.id, test_name="Exam")
        order = Order(client_id=client_a.id, clinic_id=clinic_a.id, user_id=user_a.id, order_date=date(2026, 8, 3), type="regular", order_data={})
        contact_order = ContactLensOrder(client_id=client_a.id, clinic_id=clinic_a.id, user_id=user_a.id, order_date=date(2026, 8, 3), type="contact")
        db.add_all([exam, order, contact_order])
        db.flush()
        captured_at = datetime(2026, 8, 3, tzinfo=timezone.utc)
        db.add_all([
            MigrationSourceLink(source_system="softoptic", source_table="account.csv", raw_row_ref="account.csv:account_code=007", source_primary_key_parts=[["account_code", "007"]], target_model="Client", target_id=client_a.id, clinic_id=clinic_a.id, company_id=company_a.id, payload={"normalized": "Dana"}, raw_payload={"account_code": "007", "notes": "  untouched  ", "blank": ""}, raw_payload_sha256="client-hash", raw_captured_at=captured_at),
            MigrationSourceLink(source_system="optitech", source_table="tblCrdGlassChecks", raw_row_ref="tblCrdGlassChecks:CheckId=9", source_primary_key_parts=[["CheckId", "9"]], target_model="OpticalExam", target_id=exam.id, clinic_id=clinic_a.id, company_id=company_a.id, payload={}, raw_payload={"CheckId": "9"}, raw_payload_sha256="exam-hash", raw_captured_at=captured_at),
            MigrationSourceLink(source_system="softoptic", source_table="optic_glasses_presc.csv", raw_row_ref="optic_glasses_presc.csv:code=4", source_primary_key_parts=[["code", "4"]], target_model="Order", target_id=order.id, clinic_id=clinic_a.id, company_id=company_a.id, payload={}, raw_payload={"code": "4"}, raw_payload_sha256="order-hash", raw_captured_at=captured_at),
            MigrationSourceLink(source_system="softoptic", source_table="optic_contact_presc.csv", raw_row_ref="optic_contact_presc.csv:code=5", source_primary_key_parts=[["code", "5"]], target_model="ContactLensOrder", target_id=contact_order.id, clinic_id=clinic_a.id, company_id=company_a.id, payload={}, raw_payload={"code": "5"}, raw_payload_sha256="contact-order-hash", raw_captured_at=captured_at),
        ])
        db.commit()
        return {"user_a": user_a.id, "user_b": user_b.id, "client_a": client_a.id, "client_b": client_b.id, "exam": exam.id, "order": order.id, "contact_order": contact_order.id}


def _client(SessionLocal, user_id: int):
    app = FastAPI()
    app.include_router(source_data_endpoint.router, prefix="/api/v1")
    app.include_router(clients_endpoint.router, prefix="/api/v1")

    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    def override_current_user():
        with SessionLocal() as db:
            return db.query(User).filter(User.id == user_id).one()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[source_data_endpoint.get_current_user] = override_current_user
    app.dependency_overrides[clients_endpoint.get_current_user] = override_current_user
    return TestClient(app)


def test_source_data_is_scoped_and_never_leaks_into_normal_client_data():
    SessionLocal = _session_factory()
    ids = _seed(SessionLocal)

    with _client(SessionLocal, ids["user_a"]) as client:
        summary = client.get(f"/api/v1/migration-source-data/client/{ids['client_a']}/summary")
        response = client.get(f"/api/v1/migration-source-data/client/{ids['client_a']}")
        normal_client = client.get(f"/api/v1/clients/{ids['client_a']}")

    assert summary.status_code == 200
    assert summary.json()["available"] is True
    assert summary.json()["source_systems"] == ["softoptic"]
    assert response.status_code == 200
    row = response.json()["rows"][0]
    assert row["raw_payload"] == {"account_code": "007", "notes": "  untouched  ", "blank": ""}
    assert row["raw_payload_sha256"] == "client-hash"
    assert "payload" not in row
    assert normal_client.status_code == 200
    assert "raw_payload" not in normal_client.json()


def test_source_data_covers_supported_records_and_rejects_cross_clinic_access():
    SessionLocal = _session_factory()
    ids = _seed(SessionLocal)
    with _client(SessionLocal, ids["user_a"]) as client:
        for record_type, record_id in (("exam", ids["exam"]), ("order", ids["order"]), ("contact_lens_order", ids["contact_order"])):
            response = client.get(f"/api/v1/migration-source-data/{record_type}/{record_id}")
            assert response.status_code == 200, response.text
            assert response.json()["rows"][0]["raw_payload"]

    with _client(SessionLocal, ids["user_b"]) as client:
        response = client.get(f"/api/v1/migration-source-data/client/{ids['client_a']}")
    assert response.status_code == 403


def test_existing_trace_link_without_raw_snapshot_is_not_viewable():
    SessionLocal = _session_factory()
    ids = _seed(SessionLocal)
    with SessionLocal() as db:
        legacy = Client(company_id=1, clinic_id=1, first_name="Existing")
        db.add(legacy)
        db.flush()
        db.add_all([
            MigrationSourceLink(source_system="softoptic", source_table="account.csv", raw_row_ref="legacy", source_primary_key_parts=[], target_model="Client", target_id=legacy.id, clinic_id=1, company_id=1, payload={}),
            MigrationSourceLink(source_system="optitech", source_table="tblPerData", raw_row_ref="legacy-json-null", source_primary_key_parts=[], target_model="Client", target_id=legacy.id, clinic_id=1, company_id=1, payload={}, raw_payload=None),
        ])
        db.commit()
        legacy_id = legacy.id

    with _client(SessionLocal, ids["user_a"]) as client:
        assert client.get(f"/api/v1/migration-source-data/client/{legacy_id}/summary").json()["available"] is False
        assert client.get(f"/api/v1/migration-source-data/client/{legacy_id}").status_code == 404
