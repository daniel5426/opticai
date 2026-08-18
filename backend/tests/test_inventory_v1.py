import os
import sys
from pathlib import Path
from unittest.mock import MagicMock

from fastapi.testclient import TestClient
from sqlalchemy.dialects import postgresql
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
from models import (
    CatalogOrderObservation,
    CatalogProduct,
    CatalogVariant,
    Client,
    Clinic,
    Company,
    ContactLensOrder,
    InventoryBalance,
    InventoryMovement,
    Order,
    OrderInventoryAllocation,
    User,
)
from services.inventory_service import get_or_create_balance


def _session_factory():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    return factory


def _seed(factory):
    with factory() as db:
        company = Company(name="Prysm", owner_full_name="Owner")
        db.add(company)
        db.flush()
        clinic = Clinic(company_id=company.id, name="Main", unique_id="main")
        db.add(clinic)
        db.flush()
        worker = User(company_id=company.id, clinic_id=clinic.id, username="worker", role_level=2)
        manager = User(company_id=company.id, clinic_id=clinic.id, username="manager", role_level=3)
        viewer = User(company_id=company.id, clinic_id=clinic.id, username="viewer", role_level=1)
        client = Client(company_id=company.id, clinic_id=clinic.id, first_name="Client")
        db.add_all([worker, manager, viewer, client])
        db.commit()
        return {
            "company": company.id,
            "clinic": clinic.id,
            "worker": worker.id,
            "manager": manager.id,
            "viewer": viewer.id,
            "client": client.id,
        }


def _client(factory, user_id):
    def override_db():
        db = factory()
        try:
            yield db
        finally:
            db.close()

    def override_user():
        with factory() as db:
            return db.query(User).filter(User.id == user_id).one()

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = override_user
    return TestClient(app)


def _create_frame(client: TestClient, clinic_id: int, *, include_cost: bool = False):
    variant = {
        "attributes": {"color": "Tortoise", "eye_size": 46, "bridge": 24},
        "sku": "MOS-LEM-46-TOR",
        "barcode": "12345678",
        "default_retail": 990,
    }
    if include_cost:
        variant["default_cost"] = 400
    response = client.post(
        "/api/v1/inventory/catalog",
        json={
            "clinic_id": clinic_id,
            "category": "frame",
            "product": {
                "brand": "Moscot",
                "model": "Lemtosh",
                "product_type": "Optical",
                "material": "Acetate",
                "preferred_supplier": "Supplier A",
            },
            "variant": variant,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def _frame_order_payload(ids, variant_id, *, status="ממתין לאיסוף לקוח", selections=True):
    payload = {
        "order": {
            "client_id": ids["client"],
            "clinic_id": ids["clinic"],
            "type": "glasses",
            "order_data": {
                "lens_frame_tabs": [{
                    "id": "frame-1",
                    "type": "רחוק",
                    "lens": {"order_id": 0},
                    "frame": {
                        "order_id": 0,
                        "manufacturer": "Moscot",
                        "model": "Lemtosh",
                        "color": "Tortoise",
                        "width": 46,
                        "bridge": 24,
                        "supplier": "Supplier A",
                        "supplied_by": "חנות",
                    },
                }],
                "details": {"order_status": status},
            },
        },
        "billing": None,
        "line_items": [],
    }
    if selections:
        payload["inventory_selections"] = [{
            "component": "frame",
            "variant_id": variant_id,
            "quantity": 1,
            "fulfillment_source": "inventory",
        }]
    return payload


def _contact_order_payload(ids, variant_id, *, fulfillment_source="supplier_ordered"):
    return {
        "order": {
            "client_id": ids["client"],
            "clinic_id": ids["clinic"],
            "type": "contact",
            "order_data": {
                "contact-lens-details": {
                    "r_type": "Monthly",
                    "r_model": "Biofinity",
                    "r_quantity": 1,
                },
                "contact-lens-exam": {
                    "r_sph": -2.0,
                    "r_bc": 8.6,
                    "r_diam": 14.0,
                },
            },
        },
        "billing": None,
        "line_items": [],
        "inventory_selections": [
            {
                "component": "contact_right",
                "variant_id": variant_id,
                "quantity": 1,
                "fulfillment_source": fulfillment_source,
            }
        ],
    }


def test_first_stock_adjustment_accepts_the_listed_synthetic_balance_version():
    factory = _session_factory()
    ids = _seed(factory)
    with _client(factory, ids["worker"]) as client:
        variant = _create_frame(client, ids["clinic"])
        # Discovery/import can create catalog variants before a clinic balance exists.
        with factory() as db:
            db.query(InventoryBalance).delete()
            db.commit()
        listed = client.get(
            f"/api/v1/inventory/variants?clinic_id={ids['clinic']}"
        )
        assert listed.status_code == 200, listed.text
        balance = listed.json()["items"][0]["balance"]
        assert balance["id"] is None
        assert balance["version"] == 1

        adjusted = client.post(
            f"/api/v1/inventory/balances/{variant['id']}/adjust",
            json={
                "clinic_id": ids["clinic"],
                "on_hand_delta": 1,
                "reason": "Opening stock",
                "expected_version": balance["version"],
            },
        )
        assert adjusted.status_code == 200, adjusted.text
        assert adjusted.json()["on_hand"] == 1
        assert adjusted.json()["version"] == 2


def test_postgres_balance_creation_uses_conflict_safe_insert_then_locks_winner():
    initial_query = MagicMock()
    initial_query.filter.return_value = initial_query
    initial_query.with_for_update.return_value = initial_query
    initial_query.first.return_value = None
    winner = InventoryBalance(id=42, company_id=1, clinic_id=2, variant_id=3, version=1)
    winning_query = MagicMock()
    winning_query.filter.return_value = winning_query
    winning_query.with_for_update.return_value = winning_query
    winning_query.one.return_value = winner
    db = MagicMock()
    db.query.side_effect = [initial_query, winning_query]
    db.get_bind.return_value.dialect.name = "postgresql"

    balance = get_or_create_balance(
        db,
        company_id=1,
        clinic_id=2,
        variant_id=3,
        lock=True,
    )

    assert balance is winner
    winning_query.with_for_update.assert_called_once()
    statement = db.execute.call_args.args[0]
    sql = str(statement.compile(dialect=postgresql.dialect()))
    assert "ON CONFLICT (clinic_id, variant_id) DO NOTHING" in sql


def test_inventory_reservation_and_legacy_delivery_are_atomic():
    factory = _session_factory()
    ids = _seed(factory)
    with _client(factory, ids["worker"]) as client:
        variant = _create_frame(client, ids["clinic"])
        adjusted = client.post(
            f"/api/v1/inventory/balances/{variant['id']}/adjust",
            json={"clinic_id": ids["clinic"], "on_hand_delta": 1, "reason": "Opening count"},
        )
        assert adjusted.status_code == 200, adjusted.text

        created = client.post(
            "/api/v1/orders/upsert-full",
            json=_frame_order_payload(ids, variant["id"]),
        )
        assert created.status_code == 200, created.text
        order_id = created.json()["order"]["id"]
        assert created.json()["inventory_allocations"][0]["lifecycle_state"] == "reserved"

        # This intentionally omits inventory_selections to simulate an old desktop.
        delivered_payload = _frame_order_payload(
            ids, variant["id"], status="נמסר ללקוח", selections=False
        )
        delivered_payload["order"]["id"] = order_id
        delivered = client.post("/api/v1/orders/upsert-full", json=delivered_payload)
        assert delivered.status_code == 200, delivered.text

    with factory() as db:
        balance = db.query(InventoryBalance).one()
        allocation = db.query(OrderInventoryAllocation).one()
        assert (balance.on_hand, balance.reserved) == (0, 0)
        assert allocation.lifecycle_state == "consumed"
        assert [movement.movement_type for movement in db.query(InventoryMovement).order_by(InventoryMovement.id)] == [
            "adjustment",
            "reserve",
            "consume",
        ]


def test_contact_catalog_product_uses_supplier_ordering_without_prescription_stock():
    factory = _session_factory()
    ids = _seed(factory)
    with _client(factory, ids["worker"]) as client:
        created = client.post(
            "/api/v1/inventory/catalog",
            json={
                "clinic_id": ids["clinic"],
                "category": "contact_lens",
                "product": {
                    "model": "Biofinity",
                    "product_type": "Monthly",
                    "preferred_supplier": "Lens Supply",
                },
                "variant": {
                    "attributes": {"color": "Clear"},
                    "is_stockable": False,
                },
            },
        )
        assert created.status_code == 200, created.text
        variant = created.json()
        assert variant["product"]["brand"] is None
        assert variant["attributes"] == {"color": "Clear"}
        assert variant["is_stockable"] is False

        supplier_order = client.post(
            "/api/v1/contact-lens-orders/upsert-full",
            json=_contact_order_payload(ids, variant["id"]),
        )
        assert supplier_order.status_code == 200, supplier_order.text
        assert supplier_order.json()["inventory_allocations"][0]["lifecycle_state"] == "supplier_ordered"

        inventory_order = client.post(
            "/api/v1/contact-lens-orders/upsert-full",
            json=_contact_order_payload(
                ids,
                variant["id"],
                fulfillment_source="inventory",
            ),
        )
        assert inventory_order.status_code == 409

    with factory() as db:
        allocation = db.query(OrderInventoryAllocation).one()
        assert allocation.lifecycle_state == "supplier_ordered"
        assert db.query(InventoryMovement).count() == 0


def test_legacy_product_change_releases_reservation_instead_of_consuming_it():
    factory = _session_factory()
    ids = _seed(factory)
    with _client(factory, ids["worker"]) as client:
        variant = _create_frame(client, ids["clinic"])
        client.post(
            f"/api/v1/inventory/balances/{variant['id']}/adjust",
            json={"clinic_id": ids["clinic"], "on_hand_delta": 1, "reason": "Opening count"},
        )
        created = client.post("/api/v1/orders/upsert-full", json=_frame_order_payload(ids, variant["id"]))
        payload = _frame_order_payload(ids, variant["id"], selections=False)
        payload["order"]["id"] = created.json()["order"]["id"]
        payload["order"]["order_data"]["lens_frame_tabs"][0]["frame"]["color"] = "Black"
        updated = client.post("/api/v1/orders/upsert-full", json=payload)
        assert updated.status_code == 200, updated.text

    with factory() as db:
        balance = db.query(InventoryBalance).one()
        allocation = db.query(OrderInventoryAllocation).one()
        assert (balance.on_hand, balance.reserved) == (1, 0)
        assert allocation.lifecycle_state == "detached"


def test_viewer_is_read_only_and_cost_is_hidden_from_workers():
    factory = _session_factory()
    ids = _seed(factory)
    with _client(factory, ids["manager"]) as client:
        variant = _create_frame(client, ids["clinic"], include_cost=True)

    with _client(factory, ids["worker"]) as client:
        listed = client.get(f"/api/v1/inventory/variants?clinic_id={ids['clinic']}")
        assert listed.status_code == 200, listed.text
        assert "default_cost" not in listed.json()["items"][0]

    with _client(factory, ids["viewer"]) as client:
        forbidden = client.post(
            f"/api/v1/inventory/balances/{variant['id']}/adjust",
            json={"clinic_id": ids["clinic"], "on_hand_delta": 1, "reason": "Not allowed"},
        )
        assert forbidden.status_code == 403


def test_discovery_preview_is_read_only_and_confirmation_does_not_rewrite_orders():
    factory = _session_factory()
    ids = _seed(factory)
    original_order_data = {
        "frame": {
            "manufacturer": "Ray-Ban",
            "model": "RX 5228",
            "color": "Black",
            "width": 50,
            "bridge": 17,
        }
    }
    with factory() as db:
        db.add(Order(
            client_id=ids["client"],
            clinic_id=ids["clinic"],
            type="glasses",
            order_data=original_order_data,
        ))
        db.commit()

    with _client(factory, ids["worker"]) as client:
        preview = client.post("/api/v1/inventory/discovery/preview")
        assert preview.status_code == 200, preview.text
        assert preview.json()["summary"]["candidates"] == 1
        with factory() as db:
            assert db.query(CatalogProduct).count() == 0

        candidates = preview.json()["candidates"]
        candidates[0]["selected"] = True
        confirmed = client.post(
            "/api/v1/inventory/discovery/confirm",
            json={"candidates": candidates},
        )
        assert confirmed.status_code == 200, confirmed.text

    with factory() as db:
        assert db.query(CatalogVariant).count() == 1
        assert db.query(CatalogOrderObservation).count() == 1
        assert db.query(InventoryBalance).count() == 0
        assert db.query(Order).one().order_data == original_order_data


def test_contact_discovery_groups_prescriptions_under_one_catalog_product():
    factory = _session_factory()
    ids = _seed(factory)
    original_order_data = {
        "contact-lens-details": {
            "r_type": "Monthly",
            "r_model": "Biofinity",
            "r_supplier": "Lens Supply",
            "r_material": "Silicone hydrogel",
            "r_color": "Clear",
            "r_quantity": 1,
        },
        "contact-lens-exam": {
            "r_sph": -2.0,
            "r_bc": 8.6,
            "r_diam": 14.0,
            "r_cyl": -0.75,
            "r_ax": 90,
        },
    }
    with factory() as db:
        db.add(
            ContactLensOrder(
                client_id=ids["client"],
                clinic_id=ids["clinic"],
                type="contact",
                order_data=original_order_data,
            )
        )
        db.commit()

    with _client(factory, ids["worker"]) as client:
        preview = client.post("/api/v1/inventory/discovery/preview")
        assert preview.status_code == 200, preview.text
        candidate = preview.json()["candidates"][0]
        assert candidate["category"] == "contact_lens"
        assert candidate["attributes"] == {"color": "Clear"}
        assert candidate["missing_fields"] == []

        candidate["selected"] = True
        confirmed = client.post(
            "/api/v1/inventory/discovery/confirm",
            json={"candidates": [candidate]},
        )
        assert confirmed.status_code == 200, confirmed.text

    with factory() as db:
        variant = db.query(CatalogVariant).one()
        assert variant.attributes == {"color": "Clear"}
        assert variant.is_stockable is False
        assert db.query(ContactLensOrder).one().order_data == original_order_data


def test_reservation_conflict_retry_and_supplier_ordered_behavior():
    factory = _session_factory()
    ids = _seed(factory)
    with _client(factory, ids["worker"]) as client:
        variant = _create_frame(client, ids["clinic"])
        client.post(
            f"/api/v1/inventory/balances/{variant['id']}/adjust",
            json={"clinic_id": ids["clinic"], "on_hand_delta": 1, "reason": "Opening count"},
        )
        first_payload = _frame_order_payload(ids, variant["id"])
        first = client.post("/api/v1/orders/upsert-full", json=first_payload)
        assert first.status_code == 200, first.text

        # Retrying the same saved order is idempotent and adds no reserve movement.
        first_payload["order"]["id"] = first.json()["order"]["id"]
        retry = client.post("/api/v1/orders/upsert-full", json=first_payload)
        assert retry.status_code == 200, retry.text

        conflict = client.post(
            "/api/v1/orders/upsert-full",
            json=_frame_order_payload(ids, variant["id"]),
        )
        assert conflict.status_code == 409

        supplier_payload = _frame_order_payload(ids, variant["id"])
        supplier_payload["inventory_selections"][0]["fulfillment_source"] = "supplier_ordered"
        supplier = client.post("/api/v1/orders/upsert-full", json=supplier_payload)
        assert supplier.status_code == 200, supplier.text
        assert supplier.json()["inventory_allocations"][0]["lifecycle_state"] == "supplier_ordered"

    with factory() as db:
        balance = db.query(InventoryBalance).one()
        assert (balance.on_hand, balance.reserved) == (1, 1)
        assert db.query(InventoryMovement).filter(InventoryMovement.movement_type == "reserve").count() == 1


def test_deletion_releases_stock_and_guided_count_is_audited():
    factory = _session_factory()
    ids = _seed(factory)
    with _client(factory, ids["worker"]) as client:
        variant = _create_frame(client, ids["clinic"])
        client.post(
            f"/api/v1/inventory/balances/{variant['id']}/adjust",
            json={"clinic_id": ids["clinic"], "on_hand_delta": 2, "reason": "Opening count"},
        )
        created = client.post(
            "/api/v1/orders/upsert-full",
            json=_frame_order_payload(ids, variant["id"]),
        )
        deleted = client.delete(f"/api/v1/orders/{created.json()['order']['id']}")
        assert deleted.status_code == 200, deleted.text

        counted = client.post(
            "/api/v1/inventory/counts",
            json={
                "clinic_id": ids["clinic"],
                "reason": "Physical count",
                "idempotency_key": "count-test-1",
                "items": [{"variant_id": variant["id"], "counted_quantity": 3}],
            },
        )
        assert counted.status_code == 200, counted.text

    with factory() as db:
        balance = db.query(InventoryBalance).one()
        assert (balance.on_hand, balance.reserved) == (3, 0)
        movement_types = [
            row.movement_type
            for row in db.query(InventoryMovement).order_by(InventoryMovement.id)
        ]
        assert movement_types == ["adjustment", "reserve", "release", "physical_count"]


def test_tenant_scope_duplicate_barcode_and_cost_write_permissions():
    factory = _session_factory()
    ids = _seed(factory)
    with factory() as db:
        other_company = Company(name="Other", owner_full_name="Other Owner")
        db.add(other_company)
        db.flush()
        other_clinic = Clinic(company_id=other_company.id, name="Other", unique_id="other")
        db.add(other_clinic)
        db.commit()
        other_clinic_id = other_clinic.id

    with _client(factory, ids["manager"]) as client:
        _create_frame(client, ids["clinic"])
        duplicate = client.post(
            "/api/v1/inventory/catalog",
            json={
                "clinic_id": ids["clinic"],
                "category": "frame",
                "product": {"brand": "Moscot", "model": "Lemtosh", "material": "Acetate"},
                "variant": {
                    "attributes": {"color": "Black", "eye_size": 48},
                    "barcode": "12345678",
                },
            },
        )
        assert duplicate.status_code == 409
        cross_tenant = client.get(
            f"/api/v1/inventory/variants?clinic_id={other_clinic_id}"
        )
        assert cross_tenant.status_code == 403

    with _client(factory, ids["worker"]) as client:
        cost_write = client.post(
            "/api/v1/inventory/catalog",
            json={
                "clinic_id": ids["clinic"],
                "category": "frame",
                "product": {"brand": "Worker", "model": "Cost"},
                "variant": {
                    "attributes": {"color": "Blue", "eye_size": 50},
                    "default_cost": 10,
                },
            },
        )
        assert cost_write.status_code == 403


def test_import_preview_reports_invalid_rows_without_writing():
    factory = _session_factory()
    ids = _seed(factory)
    csv_text = "category,brand,model,color,eye_size,default_retail\nframe,Ray-Ban,RX,Black,50,700\ncontact_lens,Acme,Daily,,,-1\n"
    with _client(factory, ids["worker"]) as client:
        preview = client.post(
            "/api/v1/inventory/import/preview",
            json={"csv_text": csv_text},
        )
        assert preview.status_code == 200, preview.text
        assert preview.json()["valid"] == 1
        assert preview.json()["invalid"] == 1
    with factory() as db:
        assert db.query(CatalogProduct).count() == 0
        assert db.query(InventoryMovement).count() == 0


def test_import_preview_requires_inventory_write_access():
    factory = _session_factory()
    ids = _seed(factory)
    with _client(factory, ids["viewer"]) as client:
        preview = client.post(
            "/api/v1/inventory/import/preview",
            json={"csv_text": "category,brand,model,color,eye_size\nframe,Ray-Ban,RX,Black,50\n"},
        )
        assert preview.status_code == 403


def test_import_commit_revalidates_rows_instead_of_trusting_preview_metadata():
    factory = _session_factory()
    ids = _seed(factory)
    csv_text = (
        "category,brand,model,color,eye_size,on_hand,reorder_point,target_quantity\n"
        "frame,Ray-Ban,RX,Black,50,3,1,5\n"
    )
    with _client(factory, ids["worker"]) as client:
        preview = client.post("/api/v1/inventory/import/preview", json={"csv_text": csv_text})
        assert preview.status_code == 200, preview.text
        row = preview.json()["rows"][0]

        # Metadata from a browser is informational only; valid data is recomputed.
        row["status"] = "invalid"
        row["fingerprint"] = "forged"
        committed = client.post(
            "/api/v1/inventory/import/commit",
            json={"clinic_id": ids["clinic"], "rows": [row], "import_id": "tampered-metadata"},
        )
        assert committed.status_code == 200, committed.text
        assert committed.json()["created"] == 1

    with factory() as db:
        balance = db.query(InventoryBalance).one()
        assert (balance.on_hand, balance.reorder_point, balance.target_quantity) == (3, 1, 5)


def test_import_commit_rejects_tampered_quantities_policy_and_duplicates():
    factory = _session_factory()
    ids = _seed(factory)
    csv_text = (
        "category,brand,model,color,eye_size,on_hand,reorder_point,target_quantity\n"
        "frame,Ray-Ban,RX,Black,50,3,1,5\n"
    )
    with _client(factory, ids["worker"]) as client:
        preview = client.post("/api/v1/inventory/import/preview", json={"csv_text": csv_text})
        assert preview.status_code == 200, preview.text
        row = preview.json()["rows"][0]

        invalid_quantity = {
            **row,
            "data": {
                **row["data"],
                "product": {**row["data"]["product"], "model": "Bad quantity"},
                "on_hand": -1,
            },
            "status": "valid",
        }
        invalid_policy = {
            **row,
            "data": {
                **row["data"],
                "product": {**row["data"]["product"], "model": "Bad policy"},
                "reorder_point": 5,
                "target_quantity": 2,
            },
            "status": "valid",
        }
        duplicate = {**row, "status": "valid", "fingerprint": "not-used"}
        committed = client.post(
            "/api/v1/inventory/import/commit",
            json={
                "clinic_id": ids["clinic"],
                "rows": [invalid_quantity, invalid_policy, duplicate, {**duplicate}],
                "import_id": "tampered-invalid",
            },
        )
        assert committed.status_code == 200, committed.text
        body = committed.json()
        assert body["created"] == 1
        assert body["skipped"] == 3
        assert any("on_hand cannot be negative" in error["errors"] for error in body["validation_errors"])
        assert any("target_quantity cannot be below reorder_point" in error["errors"] for error in body["validation_errors"])
        assert any("Duplicate row in file" in error["errors"] for error in body["validation_errors"])

    with factory() as db:
        assert db.query(CatalogVariant).count() == 1
        balance = db.query(InventoryBalance).one()
        assert (balance.on_hand, balance.reorder_point, balance.target_quantity) == (3, 1, 5)
