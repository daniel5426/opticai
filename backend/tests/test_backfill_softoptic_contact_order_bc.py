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
from models import Client, Clinic, Company, ContactLensOrder, MigrationSourceLink, SoftOpticMigrationJob
from scripts.backfill_softoptic_contact_order_bc import apply, fixed_bc, plan


def test_only_opticsoft_codes_are_read_as_a_bc():
    assert fixed_bc(84.0) == 8.4
    assert fixed_bc("84") == 8.4
    assert fixed_bc(765) == 7.65
    assert fixed_bc(860) == 8.6
    # Real base curves, curve codes and empties stay.
    for value in (8.4, "8.6", 7, "Flt", None, "", 84.5):
        assert fixed_bc(value) is None


def test_fixes_the_jobs_imported_orders_and_keeps_edits():
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
    imported = ContactLensOrder(client_id=client.id, company_id=company.id, clinic_id=clinic.id, order_data={
        "contact-lens-exam": {"r_bc": 84.0, "l_bc": "84", "r_bc_2": None, "l_bc_2": 8.6, "r_sph": -4.0},
        "contact-lens-details": {"r_model": "X"},
    })
    not_imported = ContactLensOrder(client_id=client.id, company_id=company.id, clinic_id=clinic.id, order_data={
        "contact-lens-exam": {"r_bc": 84.0},
    })
    db.add_all([imported, not_imported])
    db.flush()
    db.add(MigrationSourceLink(
        source_system="softoptic", source_primary_key_parts=[], clinic_id=clinic.id, company_id=company.id,
        migration_job_id="job", source_table="optic_contact_presc.csv", target_model="ContactLensOrder",
        raw_row_ref="a", target_id=imported.id, raw_payload={},
    ))
    db.commit()

    changes, counts = plan(db, job)
    apply(changes)
    db.commit()
    db.expire_all()

    assert db.get(ContactLensOrder, imported.id).order_data == {
        "contact-lens-exam": {"r_bc": 8.4, "l_bc": 8.4, "r_bc_2": None, "l_bc_2": 8.6, "r_sph": -4.0},
        "contact-lens-details": {"r_model": "X"},
    }
    # An order the job did not import is left alone.
    assert db.get(ContactLensOrder, not_imported.id).order_data["contact-lens-exam"]["r_bc"] == 84.0
    assert counts["bc values fixed"] == 2
    # Running it again changes nothing.
    assert plan(db, job)[0] == []
