import os
import sys
from pathlib import Path

import pytest
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

from auth import get_password_hash
from database import Base, get_db
from EndPoints import auth as auth_endpoint
from models import Clinic, ExamLayout, User


@pytest.fixture()
def client_and_db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app = FastAPI()
    app.include_router(auth_endpoint.router, prefix="/api/v1")
    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as client:
        yield client, TestingSessionLocal


def complete_setup(client):
    start = client.post(
        "/api/v1/auth/register/start",
        json={"email": "owner@example.com", "password": "owner-pass", "full_name": "Owner User"},
    )
    assert start.status_code == 200

    complete = client.post(
        "/api/v1/auth/register/complete",
        json={
            "setup_token": start.json()["setup_token"],
            "company": {"name": "Optic Clinic", "owner_full_name": "Owner User", "contact_email": "owner@example.com"},
            "clinic": {"name": "Main Clinic", "location": "Main Street", "email": "clinic@example.com"},
        },
    )
    assert complete.status_code == 200
    return complete.json()


def create_clinic_trust(client, session_factory, clinic_id: int):
    db = session_factory()
    try:
        clinic = db.query(Clinic).filter(Clinic.id == clinic_id).one()
        clinic.unique_id = "clinic-1"
        clinic.entry_pin_hash = get_password_hash("1234")
        db.commit()
    finally:
        db.close()

    trust = client.post(
        "/api/v1/auth/clinic/trust",
        json={"clinic_unique_id": "clinic-1", "pin": "1234", "device_id": "device-1"},
    )
    assert trust.status_code == 200
    return trust.json()["clinic_trust_token"]


def test_signup_complete_creates_backend_session(client_and_db):
    client, session_factory = client_and_db

    payload = complete_setup(client)

    assert payload["status"] == "authenticated"
    assert payload["access_token"]
    assert payload["refresh_token"]
    assert payload["user"]["email"] == "owner@example.com"
    assert payload["company"]["name"] == "Optic Clinic"
    assert payload["clinic"]["name"] == "Main Clinic"

    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {payload['access_token']}"})
    assert me.status_code == 200
    assert me.json()["user"]["email"] == "owner@example.com"

    db = session_factory()
    try:
        seeded_count = (
            db.query(ExamLayout)
            .filter(ExamLayout.clinic_id == payload["clinic"]["id"])
            .filter(ExamLayout.is_seeded_default == True)
            .count()
        )
        assert seeded_count == 4
    finally:
        db.close()


def test_clinic_trust_quick_login_and_pin_version_revoke(client_and_db):
    client, session_factory = client_and_db
    setup = complete_setup(client)
    clinic_id = setup["clinic"]["id"]
    company_id = setup["company"]["id"]

    db = session_factory()
    try:
        worker = User(
            company_id=company_id,
            clinic_id=clinic_id,
            username="worker",
            full_name="Worker",
            role_level=1,
            is_active=True,
        )
        db.add(worker)
        db.commit()
    finally:
        db.close()

    trust_token = create_clinic_trust(client, session_factory, clinic_id)
    quick = client.post(
        "/api/v1/auth/login/quick",
        json={"username": "worker", "device_id": "device-1"},
        headers={"Authorization": f"Bearer {trust_token}"},
    )
    assert quick.status_code == 200
    assert quick.json()["user"]["username"] == "worker"

    db = session_factory()
    try:
        clinic = db.query(Clinic).filter(Clinic.id == clinic_id).one()
        clinic.entry_pin_version += 1
        db.commit()
    finally:
        db.close()

    revoked = client.post(
        "/api/v1/auth/login/quick",
        json={"username": "worker", "device_id": "device-1"},
        headers={"Authorization": f"Bearer {trust_token}"},
    )
    assert revoked.status_code == 401


def test_password_login_scope_refresh_and_logout(client_and_db):
    client, session_factory = client_and_db
    setup = complete_setup(client)
    clinic_id = setup["clinic"]["id"]
    company_id = setup["company"]["id"]

    db = session_factory()
    try:
        user = User(
            company_id=company_id,
            clinic_id=clinic_id,
            username="protected",
            email="protected@example.com",
            password_hash=get_password_hash("secret"),
            role_level=1,
            is_active=True,
        )
        db.add(user)
        db.commit()
    finally:
        db.close()

    trust_token = create_clinic_trust(client, session_factory, clinic_id)
    login = client.post(
        "/api/v1/auth/login/password",
        json={"identifier": "protected", "password": "secret", "clinic_id": clinic_id, "device_id": "device-1"},
        headers={"Authorization": f"Bearer {trust_token}"},
    )
    assert login.status_code == 200
    first_access_token = login.json()["access_token"]

    refresh = client.post("/api/v1/auth/refresh", json={"refresh_token": login.json()["refresh_token"]})
    assert refresh.status_code == 200

    old_me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {first_access_token}"})
    assert old_me.status_code == 401

    logout = client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {refresh.json()['access_token']}"},
    )
    assert logout.status_code == 200

    logged_out = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {refresh.json()['access_token']}"})
    assert logged_out.status_code == 401


def test_ceo_password_login_does_not_require_clinic_trust(client_and_db):
    client, _ = client_and_db
    complete_setup(client)

    login = client.post(
        "/api/v1/auth/login/password",
        json={"identifier": "owner@example.com", "password": "owner-pass"},
    )

    assert login.status_code == 200
    assert login.json()["user"]["role_level"] >= 4


def test_google_selected_user_rejects_wrong_email(monkeypatch, client_and_db):
    client, session_factory = client_and_db
    setup = complete_setup(client)
    clinic_id = setup["clinic"]["id"]
    company_id = setup["company"]["id"]

    db = session_factory()
    try:
        user = User(
            company_id=company_id,
            clinic_id=clinic_id,
            username="google-user",
            email="selected@example.com",
            role_level=1,
            is_active=True,
        )
        db.add(user)
        db.commit()
        user_id = user.id
    finally:
        db.close()

    trust_token = create_clinic_trust(client, session_factory, clinic_id)
    monkeypatch.setattr(
        auth_endpoint,
        "_verify_google_user",
        lambda access_token, id_token=None: {"email": "wrong@example.com", "name": "Wrong User"},
    )

    response = client.post(
        "/api/v1/auth/login/google",
        json={"access_token": "google-access", "user_id": user_id, "device_id": "device-1"},
        headers={"Authorization": f"Bearer {trust_token}"},
    )

    assert response.status_code == 403
