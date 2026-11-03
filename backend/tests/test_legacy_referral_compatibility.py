"""Older desktop referral payloads must remain writable after a backend upgrade."""
from datetime import date

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from auth import get_current_user
from database import Base, get_db
from EndPoints import referrals
from models import Client, Clinic, Company, Referral, User


@pytest.mark.parametrize("date_payload,expected_date", [
    ({"date": "2026-05-04"}, date(2026, 5, 4)),
    ({}, date(2026, 4, 1)),
    ({"date": None}, None),
])
def test_legacy_referral_save_preserves_date_semantics(date_payload, expected_date):
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine, expire_on_commit=False)() as db:
        company = Company(name="Compatibility clinic", owner_full_name="Test owner")
        db.add(company)
        db.flush()
        clinic = Clinic(company_id=company.id, name="Test clinic", unique_id="referral-compatibility")
        db.add(clinic)
        db.flush()
        user = User(company_id=company.id, clinic_id=clinic.id, username="test-staff", role_level=2)
        client = Client(company_id=company.id, clinic_id=clinic.id, first_name="Test patient")
        db.add_all([user, client])
        db.flush()
        referral = Referral(client_id=client.id, clinic_id=clinic.id, user_id=user.id,
                            referral_notes="Original notes", date=date(2026, 4, 1))
        db.add(referral)
        db.commit()

        app = FastAPI()
        app.include_router(referrals.router, prefix="/api/v1")
        app.dependency_overrides[get_db] = lambda: db
        app.dependency_overrides[get_current_user] = lambda: user
        payload = {"client_id": client.id, "clinic_id": clinic.id, "user_id": user.id,
                   "referral_notes": "Saved from an older desktop", **date_payload}
        with TestClient(app) as http:
            response = http.put(f"/api/v1/referrals/{referral.id}", json=payload)
            assert response.status_code == 200, response.text
            db.refresh(referral)
            assert referral.date == expected_date
            assert referral.referral_notes == payload["referral_notes"]
            assert referral.company_id == company.id
    engine.dispose()
