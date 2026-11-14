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
from models import Clinic, Company, LookupContactLensSupplier, LookupManufacturer, LookupSupplier, MigrationSourceLink, SoftOpticMigrationJob
from scripts.backfill_softoptic_contact_suppliers import apply, plan


def _setup():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    db = sessionmaker(bind=engine)()
    company = Company(name="A", owner_full_name="A")
    db.add(company)
    db.flush()
    clinic, other = Clinic(company_id=company.id, name="A", unique_id="a"), Clinic(company_id=company.id, name="B", unique_id="b")
    db.add_all([clinic, other])
    db.flush()
    job = SoftOpticMigrationJob(id="job", clinic_id=clinic.id, company_id=company.id, user_id=1)
    db.add(job)
    link = dict(source_system="softoptic", source_primary_key_parts=[], clinic_id=clinic.id, company_id=company.id,
                migration_job_id="job", source_table="optic_contact_presc.csv", target_model="ContactLensOrder")
    db.add_all([
        MigrationSourceLink(**link, raw_row_ref="a", target_id=1, raw_payload={"right_manuf": "Bausch", "left_manuf": "Bausch"}),
        MigrationSourceLink(**link, raw_row_ref="b", target_id=2, raw_payload={"right_manuf": "Alcon", "left_manuf": " "}),
        # Another clinic's import is never read.
        MigrationSourceLink(**{**link, "clinic_id": other.id}, raw_row_ref="c", target_id=3, raw_payload={"right_manuf": "Other clinic"}),
        # A supplier the clinic already works with, and its manufacturers, stay as they are.
        LookupContactLensSupplier(clinic_id=clinic.id, name="Alcon"),
        LookupContactLensSupplier(clinic_id=clinic.id, name="Hand added"),
        # The glasses lens list is a separate list and stays as it is.
        LookupSupplier(clinic_id=clinic.id, name="Shamir"),
        LookupManufacturer(clinic_id=clinic.id, name="Bausch"),
    ])
    db.commit()
    return db, job, other


def test_adds_only_the_missing_contact_suppliers_to_the_clinic(tmp_path):
    db, job, other = _setup()
    (tmp_path / "optic_tv_contact_manuf.csv").write_text("code,name\n1,CooperVision\n2,Alcon\n", encoding="utf-8")

    names = plan(db, job, str(tmp_path))
    assert names == ["Bausch", "CooperVision"]
    apply(db, job, names)
    db.commit()

    clinic_names = lambda model, clinic_id: sorted(name for (name,) in db.query(model.name).filter_by(clinic_id=clinic_id))
    assert clinic_names(LookupContactLensSupplier, job.clinic_id) == ["Alcon", "Bausch", "CooperVision", "Hand added"]
    assert clinic_names(LookupSupplier, job.clinic_id) == ["Shamir"]
    assert clinic_names(LookupManufacturer, job.clinic_id) == ["Bausch"]
    assert clinic_names(LookupContactLensSupplier, other.id) == []
    # Running it again adds nothing.
    assert plan(db, job, str(tmp_path)) == []


def test_without_the_export_it_adds_the_names_the_orders_use():
    db, job, _ = _setup()
    assert plan(db, job) == ["Bausch"]
