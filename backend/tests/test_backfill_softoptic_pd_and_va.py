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
from migration.pipeline.common import get_migrated_card_id
from models import Client, Clinic, Company, ExamLayoutInstance, MigrationSourceLink, OpticalExam, Order, SoftOpticMigrationJob
from scripts.backfill_softoptic_pd_and_va import apply, plan_batches


def link(db, clinic, company, table, model, target_id, raw=None):
    db.add(MigrationSourceLink(
        source_system="softoptic", source_primary_key_parts=[], clinic_id=clinic.id, company_id=company.id,
        migration_job_id="job", source_table=table, raw_row_ref=f"{model}:{target_id}", target_model=model,
        target_id=target_id, raw_payload=raw,
    ))


def test_fixes_imported_pd_and_va_and_keeps_edits():
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
    imported = Order(client_id=client.id, company_id=company.id, clinic_id=clinic.id, order_date=datetime.date(2024, 1, 1), type="glasses",
                     order_data={"final-prescription": {"comb_pd": 58.0, "comb_pd_close": 62.0, "r_va": "6/6-", "l_va": "6/9+2"}})
    edited = Order(client_id=client.id, company_id=company.id, clinic_id=clinic.id, order_date=datetime.date(2024, 1, 2), type="glasses",
                   order_data={"final-prescription": {"comb_pd_far": 63.0, "comb_pd_close": 62.0, "comb_pd": None}})
    typed_over = Order(client_id=client.id, company_id=company.id, clinic_id=clinic.id, order_date=datetime.date(2024, 1, 3), type="glasses",
                       order_data={"final-prescription": {"comb_pd_close": 60.0, "r_va": "6/15-"}})
    not_imported = Order(client_id=client.id, company_id=company.id, clinic_id=clinic.id, order_date=datetime.date(2024, 1, 4), type="glasses",
                         order_data={"final-prescription": {"comb_pd_close": 62.0, "r_va": "6/6-"}})
    exam = OpticalExam(client_id=client.id, company_id=company.id, clinic_id=clinic.id, exam_date=datetime.date(2024, 1, 1), test_name="x")
    db.add_all([imported, edited, typed_over, not_imported, exam])
    db.flush()
    subjective_key = f"subjective-{get_migrated_card_id('subjective')}"
    db.add(ExamLayoutInstance(exam_id=exam.id, exam_data={
        subjective_key: {"r_va": "6/6-", "l_fa": "6/12+", "comb_va": "6/6--", "l_va": "6/15-"},
        "notes": {"note": "6/6-"},
    }))
    link(db, clinic, company, "optic_glasses_presc.csv", "Order", imported.id,
         {"pd_near": "62", "pd_far": "58", "right_va": "6-", "left_va": "9+2"})
    link(db, clinic, company, "optic_glasses_presc.csv", "Order", edited.id, {"pd_near": "62", "pd_far": ""})
    link(db, clinic, company, "optic_glasses_presc.csv", "Order", typed_over.id,
         {"pd_near": "62", "pd_far": "", "right_va": "6-"})
    link(db, clinic, company, "optic_exp_eyetests.csv", "OpticalExam", exam.id,
         {"sub_r_va": "6-", "sb_left_fa": "6/12+", "sub_l_va": "12-"})
    db.commit()

    for changes, _ in plan_batches(db, job):
        apply(changes)
        db.commit()
    db.expire_all()

    prescription = db.get(Order, imported.id).order_data["final-prescription"]
    assert prescription == {"comb_pd_far": 62.0, "comb_pd_close": 58.0, "r_va": "6/6-1", "l_va": "6/9+2"}
    # A far PD typed since the import, or a near PD changed by hand, is left as it is.
    assert db.get(Order, edited.id).order_data["final-prescription"]["comb_pd_close"] == 62.0
    assert db.get(Order, typed_over.id).order_data["final-prescription"] == {"comb_pd_close": 60.0, "r_va": "6/15-"}
    # Records this import did not create are not read.
    assert db.get(Order, not_imported.id).order_data["final-prescription"]["r_va"] == "6/6-"
    data = db.query(ExamLayoutInstance).one().exam_data
    assert data[subjective_key] == {"r_va": "6/6-1", "l_fa": "6/12+1", "comb_va": "6/6--", "l_va": "6/15-"}
    assert data["notes"] == {"note": "6/6-"}
