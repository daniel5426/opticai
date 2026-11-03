from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from models import (
    Client,
    Clinic,
    Company,
    ContactLensOrder,
    ExamLayoutInstance,
    OpticalExam,
    Order,
    PrescriptionSearchIndex,
    Referral,
    ReferralEye,
)
from services.prescription_search_index import rebuild_clinic_prescription_search_index


def _session_factory():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    return SessionLocal


def test_rebuild_clinic_prescription_search_index_is_idempotent_and_clinic_scoped():
    SessionLocal = _session_factory()
    with SessionLocal() as db:
        company = Company(name="A", owner_full_name="Owner")
        db.add(company)
        db.flush()
        clinic = Clinic(company_id=company.id, name="Clinic", unique_id="clinic-a")
        other_clinic = Clinic(company_id=company.id, name="Other", unique_id="clinic-b")
        db.add_all([clinic, other_clinic])
        db.flush()
        client = Client(company_id=company.id, clinic_id=clinic.id, first_name="A")
        other_client = Client(company_id=company.id, clinic_id=other_clinic.id, first_name="B")
        db.add_all([client, other_client])
        db.flush()

        exam = OpticalExam(client_id=client.id, clinic_id=clinic.id, exam_date=date(2024, 1, 1))
        db.add(exam)
        db.flush()
        db.add(
            ExamLayoutInstance(
                exam_id=exam.id,
                is_active=True,
                exam_data={"final-prescription": {"r_sph": -1.25, "l_sph": -2.0}},
            )
        )
        db.add(
            Order(
                client_id=client.id,
                clinic_id=clinic.id,
                order_date=date(2024, 1, 2),
                order_data={"final-prescription": {"r_cyl": -0.5, "r_ax": 90}},
            )
        )
        db.add(
            ContactLensOrder(
                client_id=client.id,
                clinic_id=clinic.id,
                order_date=date(2024, 1, 3),
                order_data={"contact-lens-exam": {"l_sph": -3.0, "l_va": "6/6"}},
            )
        )
        referral = Referral(
            client_id=client.id,
            clinic_id=clinic.id,
            referral_notes="Referral",
            date=date(2024, 1, 4),
            referral_data={"final-prescription": {"r_sph": -4.0}},
        )
        db.add(referral)
        db.flush()
        db.add(ReferralEye(referral_id=referral.id, eye="L", sph=-5.0, cyl=-1.0))
        db.add(
            PrescriptionSearchIndex(
                source_type="stale",
                source_id=999,
                client_id=client.id,
                clinic_id=clinic.id,
                eye="R",
            )
        )
        db.add(
            PrescriptionSearchIndex(
                source_type="other",
                source_id=1,
                client_id=other_client.id,
                clinic_id=other_clinic.id,
                eye="R",
            )
        )
        db.commit()

        first = rebuild_clinic_prescription_search_index(db, clinic.id, batch_size=1)
        db.commit()
        first_count = db.query(PrescriptionSearchIndex).filter_by(clinic_id=clinic.id).count()

        second = rebuild_clinic_prescription_search_index(db, clinic.id, batch_size=1)
        db.commit()

        assert first["deleted"] == 1
        assert first["exam_layout_instances"] == 1
        assert first["orders"] == 1
        assert first["contact_lens_orders"] == 1
        assert first["referrals"] == 1
        assert second["deleted"] == first_count
        assert db.query(PrescriptionSearchIndex).filter_by(clinic_id=clinic.id).count() == first_count
        assert db.query(PrescriptionSearchIndex).filter_by(source_type="stale").count() == 0
        assert db.query(PrescriptionSearchIndex).filter_by(clinic_id=other_clinic.id).count() == 1


def test_prescription_kind_separates_contact_cards_and_orders_without_changing_legacy_search():
    from schemas import PrescriptionSearchRequest
    from services.prescription_matching import legacy_search
    factory = _session_factory()
    with factory() as db:
        company = Company(name="Search test", owner_full_name="Owner")
        db.add(company); db.flush()
        clinic = Clinic(company_id=company.id, name="Main", unique_id="search-main")
        other = Clinic(company_id=company.id, name="Other", unique_id="search-other")
        db.add_all([clinic, other]); db.flush()
        client = Client(company_id=company.id, clinic_id=clinic.id, first_name="Test")
        db.add(client); db.flush()
        exam = OpticalExam(client_id=client.id, clinic_id=clinic.id)
        db.add(exam); db.flush()
        db.add(ExamLayoutInstance(exam_id=exam.id, exam_data={
            "final-prescription": {"r_sph": 0, "l_sph": -2},
            "contact-lens-exam": {"r_sph": 0, "l_sph": -2},
            "old-contact-lenses": {"r_sph": 0, "l_sph": -2},
        }))
        db.add(ContactLensOrder(client_id=client.id, clinic_id=clinic.id,
            order_data={"final-prescription": {"r_sph": 0, "l_sph": -2}}))
        db.add(Order(client_id=client.id, clinic_id=clinic.id,
            order_data={"contact-lens-exam": {"r_sph": 0, "l_sph": -2}}))
        db.commit()
        rebuild_clinic_prescription_search_index(db, clinic.id); db.commit()
        base = {"right": {"sph": 0}, "left": {"sph": -2}}
        def run(kind=None, clinics=None):
            return legacy_search(db, clinics or [clinic.id], PrescriptionSearchRequest(**base, prescription_kind=kind))
        assert run()["total"] == 5
        glasses = run("glasses")
        assert glasses["total"] == 1
        assert glasses["items"][0]["card_type"] == "final-prescription"
        contacts = run("contact_lens")
        assert contacts["total"] == 4
        assert {hit["source_type"] for hit in contacts["items"]} == {"exam", "order", "contact_lens_order"}
        assert run("contact_lens", [other.id])["total"] == 0
        # Pre-backfill entries must be separated by the same kind rules.
        db.query(PrescriptionSearchIndex).update({"component_key": None}); db.commit()
        assert run("contact_lens")["total"] == 4
        assert run("glasses")["total"] == 1
