import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "development-secret-for-tests-only")
os.environ.setdefault("TOKEN_ENCRYPTION_KEY", "development-encryption-key-for-tests")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from models import Billing, Client, Clinic, Company, MigrationSourceLink, Order, OrderLineItem, SoftOpticMigrationJob
from scripts.backfill_softoptic_frame_brand import apply_changes, plan


def test_swaps_frame_supplier_and_brand_and_keeps_edits():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    db = sessionmaker(bind=engine)()
    company = Company(name="A", owner_full_name="A")
    db.add(company)
    db.flush()
    clinic = Clinic(company_id=company.id, name="A", unique_id="a")
    db.add(clinic)
    db.flush()
    client = Client(company_id=company.id, clinic_id=clinic.id, first_name="A")
    job = SoftOpticMigrationJob(id="job", clinic_id=clinic.id, company_id=company.id, user_id=1)
    db.add_all([client, job])
    db.flush()
    imported = {"supplier": "GIPSY", "manufacturer": "18 פייר מרקטינג", "model": "G1"}
    order = Order(client_id=client.id, clinic_id=clinic.id, order_data={
        "frame": dict(imported),
        "lens_frame_tabs": [{"id": "t", "frame": dict(imported)}],
    })
    edited = Order(client_id=client.id, clinic_id=clinic.id, order_data={
        "frame": {"supplier": "ספק אחר", "manufacturer": "18 פייר מרקטינג"},  # supplier edited after the import
    })
    db.add_all([order, edited])
    db.flush()
    billing = Billing(order_id=order.id)
    db.add(billing)
    db.flush()
    db.add(OrderLineItem(billings_id=billing.id, description="G1", supplied_by="GIPSY", price=100))
    raw = {"frame_supplier": "GIPSY", "frame_manuf": "18 פייר מרקטינג", "frame_model": "G1"}
    link = dict(source_system="softoptic", source_primary_key_parts=[], clinic_id=clinic.id, company_id=company.id,
                migration_job_id="job", source_table="optic_glasses_presc.csv", target_model="Order")
    db.add_all([
        MigrationSourceLink(**link, raw_row_ref="a", target_id=order.id, raw_payload=raw),
        MigrationSourceLink(**link, raw_row_ref="b", target_id=edited.id, raw_payload=raw),
    ])
    db.commit()

    changes, counts = plan(db, job)
    apply_changes(changes)
    db.commit()
    db.expire_all()

    expected = {"supplier": "18 פייר מרקטינג", "manufacturer": "GIPSY", "model": "G1"}
    data = db.get(Order, order.id).order_data
    assert data["frame"] == expected
    assert data["lens_frame_tabs"][0]["frame"] == expected
    assert db.query(OrderLineItem).one().supplied_by == "18 פייר מרקטינג"
    # The edited supplier stays; the untouched brand is still fixed.
    assert db.get(Order, edited.id).order_data["frame"] == {"supplier": "ספק אחר", "manufacturer": "GIPSY"}
    assert counts["billing lines fixed"] == 1
    # Running it again changes nothing.
    assert plan(db, job)[0] == []
