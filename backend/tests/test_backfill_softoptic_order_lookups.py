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
from models import Client, Clinic, Company, ContactLensOrder, MigrationSourceLink, Order, SoftOpticMigrationJob
from scripts.backfill_softoptic_order_lookups import apply_changes, plan

LOOKUPS = {"status": {"19": "לא להזמין"}, "workers": {"2": "הראל שלומי", "7": "יעל"}, "sites": {"1": "אופטיקה הראל-ירושלים"}}


def test_names_codes_the_import_left_and_keeps_edits():
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
    contact = ContactLensOrder(
        client_id=client.id, clinic_id=clinic.id, order_status="19", advisor="2", supply_in_clinic_id=clinic.id,
        order_data={"contact-lens-order": {"order_status": "19", "advisor": "2"}},
    )
    regular = Order(
        client_id=client.id, clinic_id=clinic.id,
        order_data={"details": {"order_status": "19", "advisor": "שונה ביד", "delivered_by": "7", "delivery_location": "1"}},
    )
    db.add_all([contact, regular])
    db.flush()
    link = dict(source_system="softoptic", source_primary_key_parts=[], clinic_id=clinic.id, company_id=company.id, migration_job_id="job")
    db.add_all([
        MigrationSourceLink(**link, source_table="optic_contact_presc.csv", raw_row_ref="c", target_model="ContactLensOrder", target_id=contact.id,
                            raw_payload={"order_status": "19", "advisor_code": "2", "supply_branch": ""}),
        MigrationSourceLink(**link, source_table="optic_glasses_presc.csv", raw_row_ref="g", target_model="Order", target_id=regular.id,
                            raw_payload={"order_status": "19", "advisor_code": "2", "giver_code": "7", "supply_branch": "1"}),
    ])
    db.commit()

    changes, _ = plan(db, job, LOOKUPS)
    apply_changes(changes)
    db.commit()
    db.expire_all()

    contact, regular = db.get(ContactLensOrder, contact.id), db.get(Order, regular.id)
    assert (contact.order_status, contact.advisor, contact.supply_in_clinic_id) == ("לא להזמין", "הראל שלומי", None)
    assert contact.order_data["contact-lens-order"] == {"order_status": "לא להזמין", "advisor": "הראל שלומי"}
    assert regular.order_data["details"] == {
        "order_status": "לא להזמין", "advisor": "שונה ביד", "delivered_by": "יעל", "delivery_location": "אופטיקה הראל-ירושלים",
    }
    assert plan(db, job, LOOKUPS)[0] == []
