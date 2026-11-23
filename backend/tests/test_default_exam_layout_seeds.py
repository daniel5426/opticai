from pathlib import Path
import sys

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from database import Base, get_db
from EndPoints import clinics as clinics_endpoint
from EndPoints import exam_layouts as exam_layouts_endpoint
from models import Clinic, Company, ExamLayout, User
from services.default_exam_layouts import (
    DEFAULT_EXAM_LAYOUT_TEMPLATES,
    ensure_default_exam_layouts_for_clinic,
)


def _session_factory():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    return TestingSessionLocal


def _company_and_clinic(db):
    company = Company(name="Company", owner_full_name="Owner", contact_email="owner@example.com")
    db.add(company)
    db.flush()
    clinic = Clinic(company_id=company.id, name="Clinic", unique_id="clinic-1", is_active=True)
    db.add(clinic)
    db.flush()
    return company, clinic


def test_seed_service_creates_four_layouts_and_is_idempotent():
    SessionLocal = _session_factory()
    db = SessionLocal()
    try:
        _, clinic = _company_and_clinic(db)

        first = ensure_default_exam_layouts_for_clinic(db, clinic.id)
        db.commit()
        second = ensure_default_exam_layouts_for_clinic(db, clinic.id)

        layouts = db.query(ExamLayout).filter(ExamLayout.clinic_id == clinic.id).all()
        assert first == {"created": 4, "tagged": 0, "existing": 0}
        assert second == {"created": 0, "tagged": 0, "existing": 4}
        assert len(layouts) == 4
        assert {layout.seed_key for layout in layouts} == {template.seed_key for template in DEFAULT_EXAM_LAYOUT_TEMPLATES}
        assert all(layout.is_default and layout.is_seeded_default and layout.is_active for layout in layouts)
    finally:
        db.close()


def test_seed_service_tags_exact_existing_rows_and_ignores_duplicate_routine_layout():
    SessionLocal = _session_factory()
    db = SessionLocal()
    try:
        _, clinic = _company_and_clinic(db)
        for template in DEFAULT_EXAM_LAYOUT_TEMPLATES:
            db.add(
                ExamLayout(
                    clinic_id=clinic.id,
                    name=template.name,
                    layout_data=template.layout_data,
                    is_default=False,
                    is_active=True,
                    sort_index=template.sort_index,
                    is_group=False,
                    type=template.type,
                )
            )
            if template.seed_key == "routine-glasses":
                db.add(
                    ExamLayout(
                        clinic_id=clinic.id,
                        name=template.name,
                        layout_data=template.layout_data,
                        is_default=False,
                        is_active=True,
                        sort_index=template.sort_index + 1,
                        is_group=False,
                        type=template.type,
                    )
                )
        db.commit()

        result = ensure_default_exam_layouts_for_clinic(db, clinic.id)
        db.commit()

        layouts = db.query(ExamLayout).filter(ExamLayout.clinic_id == clinic.id).all()
        routine_seeded = [layout for layout in layouts if layout.seed_key == "routine-glasses"]
        routine_unseeded = [
            layout
            for layout in layouts
            if layout.seed_key is None and layout.layout_data == routine_seeded[0].layout_data
        ]
        assert result == {"created": 0, "tagged": 4, "existing": 0}
        assert len(layouts) == 5
        assert len(routine_seeded) == 1
        assert len(routine_unseeded) == 1
    finally:
        db.close()


def test_default_layouts_endpoint_returns_scoped_active_non_group_defaults():
    SessionLocal = _session_factory()
    db = SessionLocal()
    try:
        company, clinic = _company_and_clinic(db)
        other_company = Company(name="Other", owner_full_name="Other Owner", contact_email="other@example.com")
        db.add(other_company)
        db.flush()
        other_clinic = Clinic(company_id=other_company.id, name="Other Clinic", unique_id="clinic-2", is_active=True)
        db.add(other_clinic)
        db.flush()
        ensure_default_exam_layouts_for_clinic(db, clinic.id)
        ensure_default_exam_layouts_for_clinic(db, other_clinic.id)
        db.add(
            ExamLayout(
                clinic_id=clinic.id,
                name="Inactive",
                layout_data="{}",
                is_default=True,
                is_active=False,
                is_group=False,
            )
        )
        db.add(
            ExamLayout(
                clinic_id=clinic.id,
                name="Group",
                layout_data="{}",
                is_default=True,
                is_active=True,
                is_group=True,
            )
        )
        user = User(company_id=company.id, clinic_id=None, username="ceo", role_level=4, is_active=True)
        db.add(user)
        db.commit()
        clinic_id = clinic.id
        user_id = user.id
    finally:
        db.close()

    def override_get_db():
        session = SessionLocal()
        try:
            yield session
        finally:
            session.close()

    def override_current_user():
        session = SessionLocal()
        try:
            return session.query(User).filter(User.id == user_id).one()
        finally:
            session.close()

    app = FastAPI()
    app.include_router(exam_layouts_endpoint.router, prefix="/api/v1")
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[exam_layouts_endpoint.get_current_user] = override_current_user

    with TestClient(app) as client:
        response = client.get(f"/api/v1/exam-layouts/defaults?clinic_id={clinic_id}")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 4
    assert all(item["clinic_id"] == clinic_id for item in payload)
    assert all(item["is_active"] and not item["is_group"] for item in payload)


def test_create_custom_layout_cannot_set_seed_metadata():
    SessionLocal = _session_factory()
    db = SessionLocal()
    try:
        company, clinic = _company_and_clinic(db)
        user = User(company_id=company.id, clinic_id=clinic.id, username="manager", role_level=2, is_active=True)
        db.add(user)
        db.commit()
        clinic_id = clinic.id
        user_id = user.id
    finally:
        db.close()

    def override_get_db():
        session = SessionLocal()
        try:
            yield session
        finally:
            session.close()

    def override_current_user():
        session = SessionLocal()
        try:
            return session.query(User).filter(User.id == user_id).one()
        finally:
            session.close()

    app = FastAPI()
    app.include_router(exam_layouts_endpoint.router, prefix="/api/v1")
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[exam_layouts_endpoint.get_current_user] = override_current_user

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/exam-layouts/",
            json={
                "clinic_id": clinic_id,
                "name": "Custom",
                "layout_data": "{}",
                "is_seeded_default": True,
                "seed_key": "should-not-stick",
                "seed_version": 99,
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["seed_key"] is None
    assert payload["seed_version"] is None
    assert payload["is_seeded_default"] is False


def test_create_clinic_endpoint_seeds_defaults():
    SessionLocal = _session_factory()
    db = SessionLocal()
    try:
        company = Company(name="Company", owner_full_name="Owner", contact_email="owner@example.com")
        db.add(company)
        db.flush()
        user = User(company_id=company.id, clinic_id=None, username="ceo", role_level=4, is_active=True)
        db.add(user)
        db.commit()
        company_id = company.id
        user_id = user.id
    finally:
        db.close()

    def override_get_db():
        session = SessionLocal()
        try:
            yield session
        finally:
            session.close()

    def override_current_user():
        session = SessionLocal()
        try:
            return session.query(User).filter(User.id == user_id).one()
        finally:
            session.close()

    app = FastAPI()
    app.include_router(clinics_endpoint.router, prefix="/api/v1")
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[clinics_endpoint.get_current_user] = override_current_user

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/clinics/",
            json={"company_id": company_id, "name": "New Clinic"},
        )

    assert response.status_code == 200
    assert response.json()["has_entry_pin"] is False
    clinic_id = response.json()["id"]
    db = SessionLocal()
    try:
        seeded_count = (
            db.query(ExamLayout)
            .filter(ExamLayout.clinic_id == clinic_id)
            .filter(ExamLayout.is_seeded_default == True)
            .count()
        )
        assert seeded_count == 4
    finally:
        db.close()


def test_company_catalog_shares_changes_and_keeps_activation_local():
    SessionLocal = _session_factory()
    with SessionLocal() as db:
        company, first = _company_and_clinic(db)
        second = Clinic(company_id=company.id, name="Second", unique_id="clinic-2")
        foreign, foreign_clinic = _company_and_clinic_with_other_id(db)
        owner = User(company_id=company.id, username="owner", role_level=4)
        staff = User(company_id=company.id, clinic_id=first.id, username="staff", role_level=2)
        db.add_all([second, owner, staff])
        db.flush()
        ensure_default_exam_layouts_for_clinic(db, first.id)
        ensure_default_exam_layouts_for_clinic(db, second.id)
        ensure_default_exam_layouts_for_clinic(db, foreign_clinic.id)
        db.commit()
        first_id, second_id, foreign_id = first.id, second.id, foreign_clinic.id
        owner_id, staff_id = owner.id, staff.id
        foreign_layout_id = db.query(ExamLayout.id).filter_by(company_id=foreign.id).first()[0]

    def get_db_override():
        with SessionLocal() as db:
            yield db

    active_user_id = owner_id

    def get_user_override():
        with SessionLocal() as db:
            return db.get(User, active_user_id)

    app = FastAPI()
    app.include_router(exam_layouts_endpoint.router)
    app.dependency_overrides[get_db] = get_db_override
    app.dependency_overrides[exam_layouts_endpoint.get_current_user] = get_user_override
    with TestClient(app) as client:
        def catalog(clinic_id, active_only=False):
            response = client.get("/exam-layouts/", params={"clinic_id": clinic_id, "active_only": active_only})
            assert response.status_code == 200, response.text
            return {layout["id"]: layout for layout in response.json()}

        assert len(catalog(first_id, True)) == 4
        assert catalog(first_id, True).keys() == catalog(second_id, True).keys()

        response = client.post("/exam-layouts/", json={"clinic_id": first_id, "name": "Shared", "layout_data": "{}"})
        assert response.status_code == 200, response.text
        layout_id = response.json()["id"]
        assert catalog(first_id)[layout_id]["is_active"]
        assert not catalog(second_id)[layout_id]["is_active"]

        activation_url = f"/exam-layouts/{layout_id}/activation"
        assert client.put(activation_url, json={"clinic_id": second_id, "is_active": True}).status_code == 200
        assert client.put(activation_url, json={"clinic_id": first_id, "is_active": False}).status_code == 200
        assert layout_id not in catalog(first_id, True)
        assert layout_id in catalog(second_id, True)
        activations = client.get("/exam-layouts/activations")
        assert activations.status_code == 200, activations.text
        assert activations.json()[str(layout_id)] == {str(first_id): False, str(second_id): True}
        assert str(foreign_layout_id) not in activations.json()

        active_user_id = staff_id
        assert client.put(activation_url, json={"clinic_id": second_id, "is_active": False}).status_code == 403
        assert client.put(f"/exam-layouts/{layout_id}", json={"name": "Renamed"}).status_code == 200
        assert catalog(second_id)[layout_id]["name"] == "Renamed"
        assert client.get("/exam-layouts/", params={"clinic_id": foreign_id}).status_code == 403
        assert client.get(f"/exam-layouts/{foreign_layout_id}").status_code == 404
        assert client.delete(f"/exam-layouts/{foreign_layout_id}").status_code == 404


def _company_and_clinic_with_other_id(db):
    company = Company(name="Other", owner_full_name="Owner")
    db.add(company)
    db.flush()
    clinic = Clinic(company_id=company.id, name="Other", unique_id="clinic-3")
    db.add(clinic)
    return company, clinic
