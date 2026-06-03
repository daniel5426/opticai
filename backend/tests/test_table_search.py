import json
import re
from datetime import date, datetime

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import EndPoints.appointments as appointments_endpoint
import EndPoints.clients as clients_endpoint
import EndPoints.exams as exams_endpoint
import EndPoints.files as files_endpoint
import EndPoints.orders as orders_endpoint
import EndPoints.referrals as referrals_endpoint
import EndPoints.users as users_endpoint
from database import Base, get_db
from models import Appointment, Client, Clinic, Company, File, OpticalExam, Order, Referral, User


def _format_date(value, fmt):
    if value is None:
        return None
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    replacements = {
        "YYYY": f"{parsed.year:04d}",
        "YY": f"{parsed.year % 100:02d}",
        "FMMM": str(parsed.month),
        "FMDD": str(parsed.day),
        "MM": f"{parsed.month:02d}",
        "DD": f"{parsed.day:02d}",
    }
    result = fmt
    for key, replacement in replacements.items():
        result = result.replace(key, replacement)
    return result


def _json_extract_path_text(value, *path):
    current = json.loads(value) if isinstance(value, str) else value
    for key in path:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return None if current is None else str(current)


def _session_factory():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def connect(dbapi_connection, _connection_record):
        dbapi_connection.create_function("to_char", 2, _format_date)
        dbapi_connection.create_function(
            "concat_ws",
            -1,
            lambda separator, *values: str(separator).join(str(value) for value in values if value is not None),
        )
        dbapi_connection.create_function(
            "regexp_replace",
            4,
            lambda value, pattern, repl, _flags: re.sub(pattern, repl, str(value)),
        )
        dbapi_connection.create_function("json_extract_path_text", -1, _json_extract_path_text)

    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    return SessionLocal


def _seed(db):
    company = Company(name="A", owner_full_name="Owner A")
    db.add(company)
    db.flush()

    clinic = Clinic(company_id=company.id, name="Clinic A", unique_id="clinic-a")
    db.add(clinic)
    db.flush()

    current_user = User(
        company_id=company.id,
        clinic_id=clinic.id,
        username="admin",
        full_name="Admin User",
        role_level=4,
        is_active=True,
    )
    examiner = User(
        company_id=company.id,
        clinic_id=clinic.id,
        username="alice",
        full_name="Alice Optic",
        email="alice@example.test",
        phone="0501234567",
        role_level=2,
        is_active=True,
    )
    client = Client(
        company_id=company.id,
        clinic_id=clinic.id,
        first_name="John",
        last_name="Smith",
        national_id="123456789",
        phone_mobile="0521234567",
        email="john@example.test",
        date_of_birth=date(2026, 5, 4),
    )
    other_client = Client(company_id=company.id, clinic_id=clinic.id, first_name="Sarah", last_name="Cohen")
    db.add_all([current_user, examiner, client, other_client])
    db.flush()

    db.add_all(
        [
            Order(
                client_id=client.id,
                clinic_id=clinic.id,
                user_id=examiner.id,
                order_date=date(2026, 5, 5),
                type="Glasses",
                order_data={"details": {"order_status": "open"}},
            ),
            OpticalExam(
                client_id=client.id,
                clinic_id=clinic.id,
                user_id=examiner.id,
                exam_date=date(2026, 5, 6),
                test_name="Routine exam",
                type="exam",
            ),
            Appointment(
                client_id=client.id,
                clinic_id=clinic.id,
                user_id=examiner.id,
                date=date(2026, 5, 7),
                time="09:00",
                exam_name="Follow up",
                note="Annual",
            ),
            File(
                client_id=client.id,
                clinic_id=clinic.id,
                file_name="john-file.pdf",
                original_file_name="john-file.pdf",
                file_size=10,
                file_type="application/pdf",
                uploaded_by=examiner.id,
                notes="Report",
            ),
            Referral(
                client_id=client.id,
                clinic_id=clinic.id,
                user_id=examiner.id,
                referral_notes="Referral notes",
                date=date(2026, 5, 8),
                type="Specialist",
                urgency_level="routine",
                recipient="Hospital",
                referral_data={},
            ),
        ]
    )
    db.commit()
    return {"clinic_id": clinic.id, "current_user_id": current_user.id}


def _client(SessionLocal, current_user_id):
    app = FastAPI()
    for endpoint in (
        appointments_endpoint,
        clients_endpoint,
        exams_endpoint,
        files_endpoint,
        orders_endpoint,
        referrals_endpoint,
        users_endpoint,
    ):
        app.include_router(endpoint.router, prefix="/api/v1")

    def override_get_db():
        session = SessionLocal()
        try:
            yield session
        finally:
            session.close()

    def override_current_user():
        session = SessionLocal()
        try:
            return session.query(User).filter(User.id == current_user_id).one()
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    for endpoint in (
        appointments_endpoint,
        clients_endpoint,
        exams_endpoint,
        files_endpoint,
        orders_endpoint,
        referrals_endpoint,
        users_endpoint,
    ):
        app.dependency_overrides[endpoint.get_current_user] = override_current_user
    return TestClient(app)


def test_clients_paginated_matches_all_terms_and_reversed_names():
    SessionLocal = _session_factory()
    with SessionLocal() as db:
        ids = _seed(db)

    with _client(SessionLocal, ids["current_user_id"]) as client:
        for query in ("John Smith", "Smith John", "  Jo   Smi  "):
            response = client.get(
                "/api/v1/clients/paginated",
                params={"clinic_id": ids["clinic_id"], "search": query},
            )
            assert response.status_code == 200
            payload = response.json()
            assert payload["total"] == 1
            assert payload["items"][0]["first_name"] == "John"

        no_match = client.get(
            "/api/v1/clients/paginated",
            params={"clinic_id": ids["clinic_id"], "search": "John MissingTerm"},
        )
        assert no_match.status_code == 200
        assert no_match.json()["total"] == 0


def test_clients_paginated_keeps_date_search():
    SessionLocal = _session_factory()
    with SessionLocal() as db:
        ids = _seed(db)

    with _client(SessionLocal, ids["current_user_id"]) as client:
        response = client.get(
            "/api/v1/clients/paginated",
            params={"clinic_id": ids["clinic_id"], "search": "04/05/2026"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["last_name"] == "Smith"


def test_joined_client_names_match_paginated_tables():
    SessionLocal = _session_factory()
    with SessionLocal() as db:
        ids = _seed(db)

    endpoints = [
        "/api/v1/orders/paginated",
        "/api/v1/exams/enriched",
        "/api/v1/appointments/paginated",
        "/api/v1/files/paginated",
        "/api/v1/referrals/paginated",
    ]
    with _client(SessionLocal, ids["current_user_id"]) as client:
        for path in endpoints:
            response = client.get(
                path,
                params={"clinic_id": ids["clinic_id"], "search": "Smith John"},
            )
            assert response.status_code == 200, path
            assert response.json()["total"] == 1, path


def test_users_paginated_matches_all_terms():
    SessionLocal = _session_factory()
    with SessionLocal() as db:
        ids = _seed(db)

    with _client(SessionLocal, ids["current_user_id"]) as client:
        response = client.get("/api/v1/users/paginated", params={"search": "Alice Optic"})
        assert response.status_code == 200
        assert response.json()["total"] == 1

        no_match = client.get("/api/v1/users/paginated", params={"search": "Alice Missing"})
        assert no_match.status_code == 200
        assert no_match.json()["total"] == 0
