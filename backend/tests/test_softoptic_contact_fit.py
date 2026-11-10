import csv

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.migration.pipeline import common as migration
from backend.migration.pipeline.steps import migrate_optical_exams
from database import Base
from models import Client, Clinic, Company, ExamLayoutInstance, OpticalExam, User


def _write(path, fields, rows):
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def test_fit_row_maps_to_its_tabs():
    data = migration.build_contact_fit_exam_data({
        "wearing_duration": "4", "wearing_period": "7", "hours_per_day": "10", "time_today": "01:30:00.000",
        "obj_right_remarks": "6-  J7", "old_left_add": "1.25", "right_stability_ax": "-10", "left_stability_ax": "0",
        "bino_rg_selection": "S", "bino_mw_exo": "4",
        "old1_r_sph": "-0200", "old1_type": "R", "old1_source": "eye doctor", "old1_ct_fv_exo_p": "6",
        "old2_l_cyl": "-0075",
    })

    assert data["softoptic-details-fitting"] == {
        "wearing_duration": "4", "wearing_unit": "weeks", "hours_per_day": "10", "hours_today": "01:30",
        "r_reflex": "6-  J7", "l_old_add": "1.25", "card_instance_id": "fitting",
    }
    # A zero stability axis is OpticSoft's empty value.
    assert data["softoptic-details-observation"] == {"r_stability_ax": "-10", "card_instance_id": "observation"}
    # "S" is preselected on every fit; it is not a suppression result.
    assert "softoptic-rg" not in data
    assert data["maddox-wing"]["exo_phoria"] == 4
    assert data["old-refraction-old-refraction-1-1"]["r_sph"] == -2.0
    assert data["old-refraction-old-refraction-1-2"]["l_cyl"] == -0.75
    assert data["softoptic-details-old-ref-1"]["source"] == "eye doctor"
    assert data["softoptic-cover-test-softoptic-cover-test-1"]["fv_exo_phoria"] == 6
    assert "softoptic-details-eye-test" not in data


def test_fit_rg_keeps_a_real_result():
    data = migration.build_contact_fit_exam_data({"bino_rg_selection": "F"})
    assert data["softoptic-rg"]["rg_status"] == "fusion"


def test_fit_takes_subjective_and_bio_from_latest_eye_test_before_it(tmp_path):
    _write(tmp_path / "optic_eye_tests.csv", ["code", "account_code"], [])
    _write(tmp_path / "optic_device_data.csv", ["code", "account_code"], [])
    _write(
        tmp_path / "optic_exp_eyetests.csv",
        ["code", "account_code", "branch_code", "test_date", "sub_f_r_sph", "bio_shirmer_r_mm", "bio_r_iop", "subjective_remarks"],
        [
            {"code": "1", "account_code": "101", "branch_code": "A", "test_date": "2022-01-01", "sub_f_r_sph": "-0100", "bio_shirmer_r_mm": "10"},
            {"code": "2", "account_code": "101", "branch_code": "A", "test_date": "2022-03-01", "sub_f_r_sph": "-0300", "bio_shirmer_r_mm": "22", "bio_r_iop": "14", "subjective_remarks": "sees well"},
            # After the fit, so not what the fit showed.
            {"code": "3", "account_code": "101", "branch_code": "A", "test_date": "2022-05-01", "sub_f_r_sph": "-0500"},
        ],
    )
    _write(tmp_path / "optic_contact_fit.csv", ["code", "account_code", "branch_code", "fit_date"], [
        {"code": "9", "account_code": "101", "branch_code": "A", "fit_date": "2022-03-04"},
    ])

    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    with sessionmaker(bind=engine)() as db:
        company = Company(name="A", owner_full_name="Owner A")
        db.add(company); db.flush()
        clinic = Clinic(company_id=company.id, name="Selected", unique_id="selected")
        db.add(clinic); db.flush()
        user = User(company_id=company.id, clinic_id=clinic.id, username="admin", role_level=5)
        client = Client(id=101, company_id=company.id, clinic_id=clinic.id, first_name="Test")
        db.add_all([user, client]); db.commit()

        migrate_optical_exams(db, str(tmp_path), {"101": 101}, {"A": clinic.id}, user.id)

        fit = db.query(OpticalExam).filter_by(type="contact_fit").one()
        assert fit.test_name == "התאמת עדשות מגע"
        data = db.query(ExamLayoutInstance).filter_by(exam_id=fit.id).one().exam_data
        assert data["final-subjective"]["r_sph"] == -3.0
        assert data["schirmer-test"]["r_mm"] == 22
        assert data["softoptic-details-bio"]["r_iop"] == "14"
        assert data["softoptic-details-subjective"]["remark"] == "sees well"
        assert data["softoptic-details-eye-test"]["eye_test_date"] == "2022-03-01"


def test_bc_keeps_softoptic_implied_point_and_codes():
    assert [migration.parse_softoptic_bc(v) for v in ("86 ", "860", "765", "9  ", "000", "   ", "Stp", "Flt")] == [
        8.6, 8.6, 7.65, 9.0, None, None, "Stp", "Flt",
    ]
    data = migration.build_contact_fit_exam_data({"old_right_bc": "86 ", "old_left_bc": "Stp"})
    assert data["old-contact-lenses"]["r_bc"] == 8.6
    assert data["old-contact-lenses"]["l_bc"] is None
    assert data["softoptic-details-fitting"]["l_old_bc"] == "Stp"
