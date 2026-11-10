import datetime
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
from models import Client, Clinic, Company, ExamLayoutInstance, MigrationSourceLink, OpticalExam, SoftOpticMigrationJob
from scripts.backfill_softoptic_contact_fits import apply_changes, plan


def test_adds_missing_fit_cards_and_keeps_edits():
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
    eye = OpticalExam(client_id=client.id, clinic_id=clinic.id, exam_date=datetime.date(2022, 3, 1), type="exam", test_name="x")
    fit = OpticalExam(client_id=client.id, clinic_id=clinic.id, exam_date=datetime.date(2022, 3, 4), type="contact_fit", test_name="Migrated Contact Fit")
    db.add_all([eye, fit])
    db.flush()
    db.add_all([
        ExamLayoutInstance(exam_id=eye.id, layout_id=None, exam_data={"schirmer-test": {"r_mm": 22}}),
        ExamLayoutInstance(exam_id=fit.id, layout_id=None, exam_data={
            "objective": {"r_sph": -1.5},  # edited after the import
            "old-contact-lenses": {"r_bc": 86.0, "l_bc": 8.4},  # left edited after the import
            "notes": {"title": "Fit remark", "note": "fit"},
            "notes-notes-1": {"title": "Fit remark", "note": "fit", "card_instance_id": "notes-1"},
            "notes-notes-2": {"title": "Fit remarks", "note": "rewritten by hand", "card_instance_id": "notes-2"},
        }),
        MigrationSourceLink(
            source_system="softoptic", source_primary_key_parts=[], clinic_id=clinic.id, company_id=company.id,
            migration_job_id="job", source_table="optic_contact_fit.csv", raw_row_ref="f", target_model="OpticalExam",
            target_id=fit.id,
            raw_payload={"old_right_bc": "86 ", "old_left_bc": "85 ", "obj_right_sph": "-0100", "fit_remark": "fit", "fit_remarks": "follow up", "wearing_duration": "2", "wearing_period": "30"},
        ),
    ])
    db.commit()

    changes, counts = plan(db, job)
    apply_changes(changes)
    db.commit()
    db.expire_all()

    assert counts["eye test linked"] == 1
    assert db.get(OpticalExam, fit.id).test_name == "התאמת עדשות מגע"
    data = db.query(ExamLayoutInstance).filter_by(exam_id=fit.id).one().exam_data
    assert data["objective"] == {"r_sph": -1.5}
    assert data["old-contact-lenses"] == {"r_bc": 8.6, "l_bc": 8.4}
    assert "notes" not in data and "notes-notes-1" not in data
    assert data["notes-notes-2"]["note"] == "rewritten by hand"
    assert data["softoptic-details-fitting"]["wearing_unit"] == "months"
    assert data["schirmer-test"]["r_mm"] == 22
    # Running it again changes nothing.
    assert plan(db, job)[0] == []
