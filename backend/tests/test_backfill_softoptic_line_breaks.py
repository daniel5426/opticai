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
from migration.pipeline.common import clean_legacy_text
from models import Client, Clinic, Company, MigrationSourceLink, Order, SoftOpticMigrationJob
from scripts.backfill_softoptic_line_breaks import apply, plan

CODES = r"לחצי שנה\x0d\x0a640 פ.ק 1"


def test_the_import_turns_opticsoft_codes_into_line_breaks():
    assert clean_legacy_text(CODES) == "לחצי שנה\n640 פ.ק 1"
    assert clean_legacy_text(r"a\x0Ab\x0dc") == "a\nb\nc"
    assert clean_legacy_text(r"\x0d\x0a") is None


def test_fixes_the_jobs_imported_records_and_nothing_else():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    db = sessionmaker(bind=engine)()
    company = Company(name="A", owner_full_name="A")
    db.add(company)
    db.flush()
    clinic = Clinic(company_id=company.id, name="A", unique_id="a")
    db.add(clinic)
    db.flush()
    imported_client = Client(company_id=company.id, clinic_id=clinic.id, first_name="A", notes=CODES)
    other_client = Client(company_id=company.id, clinic_id=clinic.id, first_name="B", notes=CODES)
    job = SoftOpticMigrationJob(id="job", clinic_id=clinic.id, company_id=company.id, user_id=1)
    db.add_all([imported_client, other_client, job])
    db.flush()
    order = Order(client_id=imported_client.id, clinic_id=clinic.id, order_data={
        "details": {"lens_order_notes": CODES, "notes": "edited\nby hand", "count": 3},
        "lens_frame_tabs": [{"notes": CODES}],
    })
    db.add(order)
    db.flush()
    link = dict(source_system="softoptic", source_primary_key_parts=[], clinic_id=clinic.id, company_id=company.id, migration_job_id="job")
    db.add_all([
        MigrationSourceLink(**link, source_table="account.csv", target_model="Client", raw_row_ref="c", target_id=imported_client.id),
        MigrationSourceLink(**link, source_table="optic_glasses_presc.csv", target_model="Order", raw_row_ref="o", target_id=order.id),
    ])
    db.commit()

    changes, counts = plan(db, job)
    apply(changes)
    db.commit()
    db.expire_all()

    fixed = "לחצי שנה\n640 פ.ק 1"
    assert db.get(Client, imported_client.id).notes == fixed
    assert db.get(Order, order.id).order_data == {
        "details": {"lens_order_notes": fixed, "notes": "edited\nby hand", "count": 3},
        "lens_frame_tabs": [{"notes": fixed}],
    }
    # A client the import did not create is left alone.
    assert db.get(Client, other_client.id).notes == CODES
    assert counts == {"Client texts": 1, "Order texts": 2}
    assert plan(db, job)[0] == []
