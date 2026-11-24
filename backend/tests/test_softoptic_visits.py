from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from database import Base
from migration.pipeline.common import build_softoptic_contact_check_data, record_raw_source_link
from migration.pipeline.steps import migrate_contact_lens_order_entries
from models import Client, Clinic, Company, ContactLensOrder, OpticalExam, SoftOpticMigrationJob
from services.softoptic_entries import CHECK, ORDER, contact_entry_data, order_entry_ids

BASE = "optic_eye_tests.csv"
EXPANDED = "optic_exp_eyetests.csv"
FIT = "optic_contact_fit.csv"


def test_history_keeps_each_same_day_source_exam_and_order():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        company = Company(name="Test", owner_full_name="Test")
        db.add(company)
        db.flush()
        clinic = Clinic(company_id=company.id, name="A", unique_id="a")
        other = Clinic(company_id=company.id, name="B", unique_id="b")
        db.add_all([clinic, other])
        db.flush()
        client = Client(first_name="Test", company_id=company.id, clinic_id=clinic.id)
        db.add(client)
        db.flush()
        db.add(SoftOpticMigrationJob(id="test", company_id=company.id, clinic_id=clinic.id, user_id=1))
        db.flush()
        ctx = {"company_id": company.id, "migration_job_id": "test", "source_system": "softoptic"}
        day = date(2024, 1, 1)
        tomorrow = date(2024, 1, 2)

        def add_exam(kind, source, at_clinic, name=None, reason=None):
            exam = OpticalExam(company_id=company.id, clinic_id=at_clinic.id, client_id=client.id,
                               type=kind, exam_date=day, test_name=name)
            db.add(exam)
            db.flush()
            if source:
                record_raw_source_link(
                    db, ctx, target_model="OpticalExam", clinic_id=at_clinic.id, target_id=exam.id,
                    source_table=source, source_row={"code": str(exam.id), "test_reason": reason},
                    identifier_fields=("code",),
                )
            return exam

        special = add_exam("exam", EXPANDED, clinic, "Edited title", "Reason")
        eye = add_exam("exam", BASE, clinic, "Second reason", "Second reason")
        fit = add_exam("contact_fit", FIT, clinic, "התאמת עדשות מגע")
        check = add_exam("softoptic_contact_check", CHECK, clinic, "Contact Lens Check")
        native = add_exam("exam", None, clinic)
        other_exam = add_exam("exam", EXPANDED, other)
        orders = []
        for order_date, order_type in ((day, " התאמה חוזרת "), (tomorrow, "contact_lens"), (tomorrow, None)):
            order = ContactLensOrder(company_id=company.id, clinic_id=clinic.id, client_id=client.id,
                                     order_date=order_date, type=order_type, order_data={})
            orders.append(order)
            db.add(order)
            db.flush()
            record_raw_source_link(
                db, ctx, target_model="ContactLensOrder", target_id=order.id, source_table=ORDER,
                clinic_id=clinic.id, source_row={"code": str(order.id)}, identifier_fields=("code", "account_code"),
            )
        db.commit()

        for _ in range(2):
            migrate_contact_lens_order_entries(db, ctx)
        order_entries = order_entry_ids(db, company.id, [clinic.id])
        assert len(order_entries) == 3
        assert db.query(OpticalExam).count() == 9
        assert [db.get(OpticalExam, order_entries[order.id]).test_name for order in orders] == [
            "עדשות מגע · התאמה חוזרת", "עדשות מגע", "עדשות מגע",
        ]
        assert [row.id for row in db.query(OpticalExam).filter_by(type="exam").order_by(OpticalExam.id)] == [
            special.id, eye.id, native.id, other_exam.id,
        ]
        assert contact_entry_data(db, db.get(OpticalExam, order_entries[orders[0].id]))["order_id"] == orders[0].id
        assert contact_entry_data(db, fit) is None


def test_contact_check_keeps_eye_specific_acuity_and_modifier():
    data = build_softoptic_contact_check_data({"tested_eye": "R", "chk_va": "4.5-", "or_sph": "-1"})
    assert data["over-refraction"]["r_va"] == "6/4.5-1"
    assert "comb_va" not in data["over-refraction"]
    assert build_softoptic_contact_check_data({"tested_eye": "B", "chk_va": "6"})["over-refraction"]["comb_va"] == "6/6"


def test_fit_repair_moves_source_verified_reflex_and_leaves_changed_data():
    from services.softoptic_visit_repairs import plan_fit_visit_repair

    data = {
        "softoptic-details-fitting": {"r_reflex": "legacy R", "l_reflex": "edited L", "card_instance_id": "fitting"},
        "softoptic-details-eye-test": {"eye_test_date": "2024-01-01"},
        "schirmer-test": {"r_mm": 0, "l_mm": 0},
    }
    raw = {"obj_right_remarks": "legacy R", "obj_left_remarks": "legacy L"}
    archived = {"schirmer-test": {"r_mm": 0, "l_mm": 0}}
    plan = plan_fit_visit_repair(data, raw, archived, updated=True)
    assert plan.data["retinoscop"]["r_reflex"] == "legacy R"
    assert plan.data["softoptic-details-fitting"]["l_reflex"] == "edited L"
    assert plan.data["schirmer-test"] == data["schirmer-test"]
    assert plan.copied_data_needs_review

    untouched = plan_fit_visit_repair(data, raw, archived)
    assert "schirmer-test" not in untouched.data
    assert not untouched.copied_data_needs_review


@pytest.mark.parametrize("paired", (False, True))
def test_restore_archived_check_keeps_original_attachment_and_is_idempotent(paired):
    from models import MigrationSourceLink, ExamLayoutInstance
    from scripts.restore_softoptic_visit_records import _find_checks, _insert_check

    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        company = Company(name="Test", owner_full_name="Test")
        db.add(company)
        db.flush()
        clinic = Clinic(company_id=company.id, name="A", unique_id="a")
        db.add(clinic)
        db.flush()
        client = Client(company_id=company.id, clinic_id=clinic.id, first_name="Test")
        db.add(client)
        db.flush()
        exam = OpticalExam(company_id=company.id, clinic_id=clinic.id, client_id=client.id,
                           type="exam", exam_date=date(2024, 1, 2))
        order = ContactLensOrder(company_id=company.id, clinic_id=clinic.id, client_id=client.id,
                                 order_date=date(2024, 1, 1), order_data={})
        db.add_all([exam, order])
        db.flush()
        check_raw = {"account_code": "1", "contact_presc_code": "7", "last_action": "2024-01-01",
                     "tested_eye": "L", "chk_va": "4.5-", "lens_bc_1": "84"}
        db.add_all([
            MigrationSourceLink(company_id=company.id, clinic_id=clinic.id, target_model=model, target_id=target_id,
                                source_system="softoptic", source_table=table, raw_row_ref=ref,
                                source_primary_key_parts=[], raw_payload=raw)
            for model, target_id, table, ref, raw in [
                ("OpticalExam", exam.id, CHECK, "historical-check", check_raw),
                ("ContactLensOrder", order.id, ORDER, "source-order", {"code": "7", "account_code": "1"}),
            ]
        ])
        db.commit()

        plans, needs_review = _find_checks(db, clinic)
        assert len(plans) == 1 and not needs_review
        assert plans[0].order_id == order.id
        entry = None
        if paired:
            entry = OpticalExam(company_id=company.id, clinic_id=clinic.id, client_id=client.id,
                                type="softoptic_contact_order", exam_date=order.order_date)
            db.add(entry)
            db.flush()
            db.add(MigrationSourceLink(company_id=company.id, clinic_id=clinic.id, target_model="OpticalExam",
                                       target_id=entry.id, source_system="softoptic", source_table=ORDER,
                                       raw_row_ref="source-order", source_primary_key_parts=[], payload={"order_id": order.id}))
        _insert_check(db, plans[0], entry.id if entry else None)
        db.commit()
        assert _find_checks(db, clinic) == ([], 0)
        standalone = db.query(OpticalExam).filter_by(type="softoptic_contact_check")
        if paired:
            assert standalone.count() == 0
            data = contact_entry_data(db, entry)["checks"][0]["data"]
        else:
            restored = standalone.one()
            assert restored.exam_date == date(2024, 1, 1)
            data = db.query(ExamLayoutInstance).filter_by(exam_id=restored.id).one().exam_data
        assert exam.exam_date == date(2024, 1, 2)
        assert data["over-refraction"]["l_va"] == "6/4.5-1"
        assert data["contact-lens-exam"]["l_bc"] == 8.4
        assert db.query(MigrationSourceLink).filter_by(target_id=exam.id, target_model="OpticalExam").one().raw_payload == check_raw


def test_legacy_check_overlay_removed_only_when_its_whole_block_matches():
    from services.softoptic_visit_repairs import remove_legacy_check_overlay

    right_check = {"tested_eye": "R", "or_sph": "-1", "chk_va": "6"}
    overlay = {"r_sph": -1, "r_cyl": None, "r_ax": None, "r_va": 6, "r_add": None, "comb_va": 6}
    exact = {"subjective": {"r_sph": -2}, "over-refraction": overlay}
    assert remove_legacy_check_overlay(exact, [right_check]) == {"subjective": {"r_sph": -2}}
    edited = {**exact, "over-refraction": {**overlay, "r_sph": 0}}
    assert remove_legacy_check_overlay(edited, [right_check]) == edited
