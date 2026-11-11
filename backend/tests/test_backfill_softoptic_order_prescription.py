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
from models import Client, Clinic, Company, MigrationSourceLink, Order, SoftOpticMigrationJob
from scripts.backfill_softoptic_order_prescription import apply_changes, plan


def test_reads_imported_prescriptions_like_opticsoft_and_keeps_edits():
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
    # As an older import stored them; l_cyl was edited after the import.
    order = Order(client_id=client.id, clinic_id=clinic.id, order_data={
        "final-prescription": {"r_sph": None, "r_cyl": 2.25, "r_base": "Down", "l_cyl": -1.0, "l_base": "ESO", "r_diam": 3444.0},
        "lens": {"right_model": "x"},
        "lens_frame_tabs": [{"id": "t", "lens": {"right_model": "x"}}],
    })
    db.add(order)
    db.flush()
    db.add(MigrationSourceLink(
        source_system="softoptic", source_primary_key_parts=[], clinic_id=clinic.id, company_id=company.id,
        migration_job_id="job", source_table="optic_glasses_presc.csv", raw_row_ref="o", target_model="Order", target_id=order.id,
        raw_payload={"right_sph": "Balan", "right_cyl": "+225 ", "right_base": "Down", "left_cyl": "+225 ", "left_base": "ESO", "right_diam": "3444", "pd_near": "61.00"},
    ))
    db.commit()

    changes, counts = plan(db, job)
    apply_changes(changes)
    db.commit()
    db.expire_all()

    data = db.get(Order, order.id).order_data
    assert data["final-prescription"] == {
        "r_sph": "Balance", "r_cyl": 22.5, "r_base": "DOWN", "l_cyl": -1.0, "l_base": "ESO", "r_diam": "34/44", "comb_pd_close": 61.0,
    }
    assert data["lens"]["right_diameter"] == "34/44"
    assert data["lens_frame_tabs"][0]["lens"]["right_diameter"] == "34/44"
    assert "left_diameter" not in data["lens"]
    # Running it again changes nothing.
    assert plan(db, job)[0] == []


def test_adds_a_prescription_with_only_the_near_pd():
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
    order = Order(client_id=client.id, clinic_id=clinic.id, order_data={"details": {"bag_number": "7"}})
    db.add(order)
    db.flush()
    db.add(MigrationSourceLink(
        source_system="softoptic", source_primary_key_parts=[], clinic_id=clinic.id, company_id=company.id,
        migration_job_id="job", source_table="optic_glasses_presc.csv", raw_row_ref="o", target_model="Order", target_id=order.id,
        raw_payload={"pd_near": "62.00"},
    ))
    db.commit()

    apply_changes(plan(db, job)[0])
    db.commit()
    db.expire_all()

    assert db.get(Order, order.id).order_data == {"details": {"bag_number": "7"}, "final-prescription": {"comb_pd_close": 62.0}}
