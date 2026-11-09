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
from EndPoints.exams import exam_type_filter
from models import Client, Clinic, Company, OpticalExam


def test_softoptic_contact_fits_list_with_eye_exams():
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
    db.add(client)
    db.flush()
    db.add_all(
        OpticalExam(client_id=client.id, company_id=company.id, clinic_id=clinic.id, test_name=name, type=kind)
        for name, kind in (("eye", "exam"), ("fit", "contact_fit"), ("lens", "opticlens"))
    )
    db.commit()

    names = lambda kind: sorted(e.test_name for e in db.query(OpticalExam).filter(exam_type_filter(kind)))
    assert names("exam") == ["eye", "fit"]
    assert names("opticlens") == ["lens"]
