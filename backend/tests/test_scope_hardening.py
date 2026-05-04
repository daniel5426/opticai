import os
import sys
from datetime import date
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
from models import Appointment, Client, Clinic, Company, ContactLensOrder, LookupColor, LookupVADecimal, LookupVAMeter, OpticalExam, Order, User
from services.lookup_defaults import VA_DECIMAL_VALUES, VA_METER_VALUES


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
        clinic_a2 = Clinic(company_id=company_a.id, name="A2", unique_id="a2")
        clinic_b = Clinic(company_id=company_b.id, name="B1", unique_id="b1")
        db.add_all([clinic_a, clinic_a2, clinic_b])
        db.flush()

        ceo = User(company_id=company_a.id, clinic_id=None, username="ceo", role_level=4, is_active=True)
        clinic_manager = User(company_id=company_a.id, clinic_id=clinic_a.id, username="clinic-manager", role_level=3, is_active=True)
        clinic_user = User(company_id=company_a.id, clinic_id=clinic_a.id, username="clinic-user", role_level=2, is_active=True)
        clinic_peer = User(company_id=company_a.id, clinic_id=clinic_a.id, username="clinic-peer", role_level=2, is_active=True)
        other_manager = User(company_id=company_b.id, clinic_id=clinic_b.id, username="other-manager", role_level=3, is_active=True)
        other_user = User(company_id=company_b.id, clinic_id=clinic_b.id, username="other-user", role_level=2, is_active=True)
        db.add_all([ceo, clinic_manager, clinic_user, clinic_peer, other_manager, other_user])
        db.flush()

        client_a = Client(company_id=company_a.id, clinic_id=clinic_a.id, first_name="A", last_name="Client")
        client_b = Client(company_id=company_b.id, clinic_id=clinic_b.id, first_name="B", last_name="Client")
        db.add_all([client_a, client_b])
        db.commit()

        return {
            "ceo": ceo.id,
            "clinic_manager": clinic_manager.id,
            "clinic_user": clinic_user.id,
            "clinic_peer": clinic_peer.id,
            "other_manager": other_manager.id,
            "other_user": other_user.id,
            "clinic_a": clinic_a.id,
            "clinic_a2": clinic_a2.id,
            "clinic_b": clinic_b.id,
            "company_a": company_a.id,
            "company_b": company_b.id,
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


def test_clinic_user_can_create_order_assigned_to_company_ceo():
    SessionLocal = _session_factory()
    ids = _seed(SessionLocal)

    with _client(SessionLocal, ids["clinic_user"]) as client:
        response = client.post(
            "/api/v1/orders/upsert-full",
            json={
                "order": {
                    "client_id": ids["client_a"],
                    "clinic_id": ids["clinic_a"],
                    "order_date": "2026-05-03",
                    "type": "regular",
                    "user_id": ids["ceo"],
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


def test_clinic_user_can_update_order_assigned_to_company_ceo():
    SessionLocal = _session_factory()
    ids = _seed(SessionLocal)
    with SessionLocal() as db:
        db.add(
            Order(
                client_id=ids["client_a"],
                clinic_id=ids["clinic_a"],
                user_id=ids["ceo"],
                order_date=date(2026, 5, 3),
                type="regular",
                order_data={},
            )
        )
        db.commit()
        order_id = db.query(Order.id).scalar()

    with _client(SessionLocal, ids["clinic_user"]) as client:
        response = client.post(
            "/api/v1/orders/upsert-full",
            json={
                "order": {
                    "id": order_id,
                    "client_id": ids["client_a"],
                    "clinic_id": ids["clinic_a"],
                    "order_date": "2026-05-04",
                    "type": "regular",
                    "user_id": ids["ceo"],
                    "order_data": {"details": {"order_status": "updated"}},
                },
                "billing": None,
                "line_items": [],
            },
        )

    assert response.status_code == 200, response.text
    with SessionLocal() as db:
        order = db.query(Order).one()
        assert order.user_id == ids["ceo"]
        assert order.order_data["details"]["order_status"] == "updated"


def test_clinic_user_can_create_exam_assigned_to_company_ceo():
    SessionLocal = _session_factory()
    ids = _seed(SessionLocal)

    with _client(SessionLocal, ids["clinic_user"]) as client:
        response = client.post(
            "/api/v1/exams/",
            json={
                "client_id": ids["client_a"],
                "clinic_id": ids["clinic_a"],
                "user_id": ids["ceo"],
                "exam_date": "2026-05-03",
                "test_name": "regular",
            },
        )

    assert response.status_code == 200, response.text
    with SessionLocal() as db:
        exam = db.query(OpticalExam).one()
        assert exam.user_id == ids["ceo"]
        assert exam.clinic_id == ids["clinic_a"]


def test_clinic_user_can_update_contact_order_supply_to_same_company_clinic():
    SessionLocal = _session_factory()
    ids = _seed(SessionLocal)
    with SessionLocal() as db:
        db.add(
            ContactLensOrder(
                client_id=ids["client_a"],
                clinic_id=ids["clinic_a"],
                user_id=ids["ceo"],
                order_date=date(2026, 5, 3),
                type="contact",
            )
        )
        db.commit()
        order_id = db.query(ContactLensOrder.id).scalar()

    with _client(SessionLocal, ids["clinic_user"]) as client:
        response = client.post(
            "/api/v1/contact-lens-orders/upsert-full",
            json={
                "order": {
                    "id": order_id,
                    "client_id": ids["client_a"],
                    "clinic_id": ids["clinic_a"],
                    "user_id": ids["ceo"],
                    "order_date": "2026-05-03",
                    "type": "contact",
                    "supply_in_clinic_id": str(ids["clinic_a2"]),
                    "order_data": {},
                },
                "billing": None,
                "line_items": [],
            },
        )

    assert response.status_code == 200, response.text
    with SessionLocal() as db:
        order = db.query(ContactLensOrder).one()
        assert order.supply_in_clinic_id == ids["clinic_a2"]


def test_clinic_user_cannot_update_contact_order_supply_to_other_company_clinic():
    SessionLocal = _session_factory()
    ids = _seed(SessionLocal)
    with SessionLocal() as db:
        db.add(
            ContactLensOrder(
                client_id=ids["client_a"],
                clinic_id=ids["clinic_a"],
                user_id=ids["ceo"],
                order_date=date(2026, 5, 3),
                type="contact",
            )
        )
        db.commit()
        order_id = db.query(ContactLensOrder.id).scalar()

    with _client(SessionLocal, ids["clinic_user"]) as client:
        response = client.post(
            "/api/v1/contact-lens-orders/upsert-full",
            json={
                "order": {
                    "id": order_id,
                    "client_id": ids["client_a"],
                    "clinic_id": ids["clinic_a"],
                    "user_id": ids["ceo"],
                    "order_date": "2026-05-03",
                    "type": "contact",
                    "supply_in_clinic_id": ids["clinic_b"],
                    "order_data": {},
                },
                "billing": None,
                "line_items": [],
            },
        )

    assert response.status_code == 403


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


def test_clinic_user_can_list_users_for_own_clinic():
    SessionLocal = _session_factory()
    ids = _seed(SessionLocal)

    with _client(SessionLocal, ids["clinic_user"]) as client:
        response = client.get(f"/api/v1/users/clinic/{ids['clinic_a']}")

    assert response.status_code == 200, response.text
    usernames = {item["username"] for item in response.json()}
    assert "clinic-user" in usernames
    assert "ceo" in usernames
    assert "other-user" not in usernames


def test_clinic_user_cannot_list_users_for_other_clinic():
    SessionLocal = _session_factory()
    ids = _seed(SessionLocal)

    with _client(SessionLocal, ids["clinic_user"]) as client:
        response = client.get(f"/api/v1/users/clinic/{ids['clinic_b']}")

    assert response.status_code == 403


def test_clinic_user_can_list_same_company_clinics_only():
    SessionLocal = _session_factory()
    ids = _seed(SessionLocal)

    with _client(SessionLocal, ids["clinic_user"]) as client:
        same_company = client.get(f"/api/v1/clinics/company/{ids['company_a']}")
        other_company = client.get(f"/api/v1/clinics/company/{ids['company_b']}")

    assert same_company.status_code == 200, same_company.text
    assert [clinic["id"] for clinic in same_company.json()] == [ids["clinic_a"], ids["clinic_a2"]]
    assert other_company.status_code == 403


def test_authenticated_company_creation_is_disabled_and_company_list_is_scoped():
    SessionLocal = _session_factory()
    ids = _seed(SessionLocal)

    with _client(SessionLocal, ids["ceo"]) as client:
        create = client.post(
            "/api/v1/companies/",
            json={"name": "C", "owner_full_name": "Owner C"},
        )
        listed = client.get("/api/v1/companies/")

    assert create.status_code == 410
    assert listed.status_code == 200, listed.text
    assert [company["id"] for company in listed.json()] == [ids["company_a"]]


def test_ceo_cannot_access_other_company_company_routes():
    SessionLocal = _session_factory()
    ids = _seed(SessionLocal)

    with _client(SessionLocal, ids["ceo"]) as client:
        get_response = client.get(f"/api/v1/companies/{ids['company_b']}")
        put_response = client.put(
            f"/api/v1/companies/{ids['company_b']}",
            json={"name": "B updated"},
        )
        delete_response = client.delete(f"/api/v1/companies/{ids['company_b']}")

    assert get_response.status_code == 403
    assert put_response.status_code == 403
    assert delete_response.status_code == 403


def test_ceo_clinic_routes_are_limited_to_own_company():
    SessionLocal = _session_factory()
    ids = _seed(SessionLocal)

    with _client(SessionLocal, ids["ceo"]) as client:
        listed = client.get("/api/v1/clinics/")
        own = client.get(f"/api/v1/clinics/{ids['clinic_a2']}")
        other = client.get(f"/api/v1/clinics/{ids['clinic_b']}")
        delete_other = client.delete(f"/api/v1/clinics/{ids['clinic_b']}")

    assert listed.status_code == 200, listed.text
    assert [clinic["id"] for clinic in listed.json()] == [ids["clinic_a"], ids["clinic_a2"]]
    assert own.status_code == 200, own.text
    assert other.status_code == 403
    assert delete_other.status_code == 403


def test_ceo_user_routes_are_limited_to_own_company():
    SessionLocal = _session_factory()
    ids = _seed(SessionLocal)

    with _client(SessionLocal, ids["ceo"]) as client:
        get_other = client.get(f"/api/v1/users/{ids['other_user']}")
        company_other = client.get(f"/api/v1/users/company/{ids['company_b']}")
        update_other = client.put(
            f"/api/v1/users/{ids['other_user']}",
            json={"username": "other-updated", "company_id": ids["company_b"], "role_level": 2},
        )
        delete_other = client.delete(f"/api/v1/users/{ids['other_user']}")

    assert get_other.status_code == 403
    assert company_other.status_code == 403
    assert update_other.status_code == 403
    assert delete_other.status_code == 403


def test_worker_select_rejects_other_clinic_and_can_fetch_company_ceo():
    SessionLocal = _session_factory()
    ids = _seed(SessionLocal)

    with _client(SessionLocal, ids["clinic_user"]) as client:
        select_other = client.get(f"/api/v1/users/select?clinic_id={ids['clinic_a2']}")
        get_ceo = client.get(f"/api/v1/users/{ids['ceo']}")
        get_ceo_by_username = client.get("/api/v1/users/username/ceo")
        get_other_clinic_user = client.get(f"/api/v1/users/{ids['other_user']}")

    assert select_other.status_code == 403
    assert get_ceo.status_code == 200, get_ceo.text
    assert get_ceo.json()["id"] == ids["ceo"]
    assert get_ceo_by_username.status_code == 200, get_ceo_by_username.text
    assert get_ceo_by_username.json()["id"] == ids["ceo"]
    assert get_other_clinic_user.status_code == 403


def test_manager_cannot_promote_change_company_or_move_user_outside_own_clinic():
    SessionLocal = _session_factory()
    ids = _seed(SessionLocal)

    with _client(SessionLocal, ids["clinic_manager"]) as client:
        promote = client.put(
            f"/api/v1/users/{ids['clinic_peer']}",
            json={"username": "clinic-peer", "company_id": ids["company_a"], "role_level": 4},
        )
        change_company = client.put(
            f"/api/v1/users/{ids['clinic_peer']}",
            json={"username": "clinic-peer", "company_id": ids["company_b"], "role_level": 2},
        )
        move_clinic = client.put(
            f"/api/v1/users/{ids['clinic_peer']}",
            json={"username": "clinic-peer", "company_id": ids["company_a"], "clinic_id": ids["clinic_a2"], "role_level": 2},
        )

    assert promote.status_code == 403
    assert change_company.status_code == 403
    assert move_clinic.status_code == 403


def test_ceo_cannot_access_other_company_exams_dashboard_or_appointment_stats():
    SessionLocal = _session_factory()
    ids = _seed(SessionLocal)
    with SessionLocal() as db:
        own_exam = OpticalExam(
            client_id=ids["client_a"],
            clinic_id=ids["clinic_a"],
            user_id=ids["ceo"],
            exam_date=date(2026, 5, 3),
            test_name="own",
        )
        other_exam = OpticalExam(
            client_id=ids["client_b"],
            clinic_id=ids["clinic_b"],
            user_id=ids["other_user"],
            exam_date=date(2026, 5, 3),
            test_name="other",
        )
        db.add_all([own_exam, other_exam])
        db.commit()
        own_exam_id = own_exam.id
        other_exam_id = other_exam.id

    with _client(SessionLocal, ids["ceo"]) as client:
        own_exam_response = client.get(f"/api/v1/exams/{own_exam_id}")
        other_exam_response = client.get(f"/api/v1/exams/{other_exam_id}")
        other_clinic_list = client.get(f"/api/v1/exams/?clinic_id={ids['clinic_b']}")
        other_enriched = client.get(f"/api/v1/exams/enriched?clinic_id={ids['clinic_b']}")
        other_dashboard = client.get(f"/api/v1/dashboard/home?clinic_id={ids['clinic_b']}")
        other_stats = client.get(f"/api/v1/appointments/stats/company/{ids['company_b']}")

    assert own_exam_response.status_code == 200, own_exam_response.text
    assert other_exam_response.status_code == 403
    assert other_clinic_list.status_code == 403
    assert other_enriched.status_code == 403
    assert other_dashboard.status_code == 403
    assert other_stats.status_code == 403


def test_lookup_crud_is_scoped_to_requested_clinic():
    SessionLocal = _session_factory()
    ids = _seed(SessionLocal)

    with _client(SessionLocal, ids["clinic_manager"]) as client:
        created = client.post(
            "/api/v1/lookups/colors",
            json={"clinic_id": ids["clinic_a"], "name": "Red"},
        )
        duplicate = client.post(
            "/api/v1/lookups/colors",
            json={"clinic_id": ids["clinic_a"], "name": "Red"},
        )
        forbidden_list = client.get(f"/api/v1/lookups/colors?clinic_id={ids['clinic_b']}")

    assert created.status_code == 200, created.text
    assert created.json()["clinic_id"] == ids["clinic_a"]
    assert duplicate.status_code == 400
    assert forbidden_list.status_code == 403

    with _client(SessionLocal, ids["other_manager"]) as client:
        other_created = client.post(
            "/api/v1/lookups/colors",
            json={"clinic_id": ids["clinic_b"], "name": "Red"},
        )

    assert other_created.status_code == 200, other_created.text
    assert other_created.json()["clinic_id"] == ids["clinic_b"]


def test_clinic_worker_can_create_update_and_delete_lookup_for_own_clinic():
    SessionLocal = _session_factory()
    ids = _seed(SessionLocal)

    with _client(SessionLocal, ids["clinic_user"]) as client:
        created = client.post(
            "/api/v1/lookups/colors",
            json={"clinic_id": ids["clinic_a"], "name": "Green"},
        )
        assert created.status_code == 200, created.text
        lookup_id = created.json()["id"]

        updated = client.put(
            f"/api/v1/lookups/colors/{lookup_id}?clinic_id={ids['clinic_a']}",
            json={"name": "Dark Green"},
        )
        deleted = client.delete(f"/api/v1/lookups/colors/{lookup_id}?clinic_id={ids['clinic_a']}")

    assert updated.status_code == 200, updated.text
    assert updated.json()["name"] == "Dark Green"
    assert deleted.status_code == 200, deleted.text
    with SessionLocal() as db:
        assert db.get(LookupColor, lookup_id) is None


def test_ceo_lookup_access_uses_selected_clinic_id():
    SessionLocal = _session_factory()
    ids = _seed(SessionLocal)

    with SessionLocal() as db:
        db.add(LookupColor(clinic_id=ids["clinic_a2"], name="Blue"))
        db.commit()

    with _client(SessionLocal, ids["ceo"]) as client:
        selected = client.get(f"/api/v1/lookups/colors?clinic_id={ids['clinic_a2']}")
        other_company = client.get(f"/api/v1/lookups/colors?clinic_id={ids['clinic_b']}")

    assert selected.status_code == 200, selected.text
    assert [item["name"] for item in selected.json()] == ["Blue"]
    assert other_company.status_code == 403


def test_deleting_lookup_does_not_mutate_order_string_values():
    SessionLocal = _session_factory()
    ids = _seed(SessionLocal)

    with SessionLocal() as db:
        order = ContactLensOrder(
            client_id=ids["client_a"],
            clinic_id=ids["clinic_a"],
            l_color="Red",
        )
        db.add(order)
        db.commit()
        order_id = order.id

    with _client(SessionLocal, ids["clinic_manager"]) as client:
        created = client.post(
            "/api/v1/lookups/colors",
            json={"clinic_id": ids["clinic_a"], "name": "Red"},
        )
        assert created.status_code == 200, created.text
        lookup_id = created.json()["id"]
        deleted = client.delete(f"/api/v1/lookups/colors/{lookup_id}?clinic_id={ids['clinic_a']}")

    assert deleted.status_code == 200, deleted.text
    with SessionLocal() as db:
        assert db.get(ContactLensOrder, order_id).l_color == "Red"


def test_new_clinic_creation_seeds_only_va_defaults():
    SessionLocal = _session_factory()
    ids = _seed(SessionLocal)

    with _client(SessionLocal, ids["ceo"]) as client:
        response = client.post(
            "/api/v1/clinics/",
            json={
                "company_id": ids["company_a"],
                "name": "A3",
                "unique_id": "a3",
            },
        )

    assert response.status_code == 200, response.text
    clinic_id = response.json()["id"]
    with SessionLocal() as db:
        assert db.query(LookupVAMeter).filter(LookupVAMeter.clinic_id == clinic_id).count() == len(VA_METER_VALUES)
        assert db.query(LookupVADecimal).filter(LookupVADecimal.clinic_id == clinic_id).count() == len(VA_DECIMAL_VALUES)
        assert db.query(LookupColor).filter(LookupColor.clinic_id == clinic_id).count() == 0
