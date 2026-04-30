from __future__ import annotations

import json
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.migration.optitech.src import phase3, records
from backend.migration.optitech.src.exam_layouts import ensure_phase3_exam_layouts
from backend.migration.optitech.src.trace import load_trace_links
from models import Appointment, Base, Clinic, Company, ExamLayoutInstance, OpticalExam, Order, User


def _build_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    return Session()


def _create_company_and_clinic(db):
    company = Company(name="Test Co", owner_full_name="Owner")
    db.add(company)
    db.flush()
    clinic = Clinic(company_id=company.id, name="Clinic", unique_id="clinic-test", is_active=True)
    db.add(clinic)
    db.flush()
    return company, clinic


def _create_user(db, company_id: int, clinic_id: int) -> User:
    user = User(company_id=company_id, clinic_id=clinic_id, username="user-1", full_name="Exam User", role_level=2)
    db.add(user)
    db.flush()
    return user


def _minimal_lookup_catalog():
    return {
        "tblCrdBuysWorkTypes": {0: "משקפיים", 1: "ע. מגע", 2: "אחר"},
        "tblCrdBuysWorkStats": {0: "בביצוע", 3: "נמסרה", 10: "נסגרה"},
        "tblCrdBuysWorkSupply": {0: "מספק", 1: "במלאי"},
        "tblCrdBuysWorkLabs": {0: None, 1: "אורי"},
        "tblCrdBuysWorkSapaks": {0: None, 3: "אופליין"},
        "tblCrdBuysWorkLabels": {0: None, 2: "OGA"},
        "tblCrdGlassModel": {0: None, 2: "1.6"},
        "tblCrdGlassColor": {0: None, 3: "חום"},
        "tblCrdGlassCoat": {0: None, 1: "A/R"},
        "tblCrdGlassMater": {0: None, 5: "פלסטיק"},
        "tblCrdClensTypes": {0: None, 1: "DISPO"},
        "tblCrdClensBrands": {0: None, 1: "oasys"},
        "tblCrdClensManuf": {0: None, 4: "J&J"},
        "tblCrdClensChecksMater": {0: None, 2: "SKI"},
        "tblCrdClensChecksTint": {0: None, 1: "ירוק"},
        "tblCrdClensSolClean": {0: None, 1: "Renu"},
        "tblCrdClensSolDisinfect": {0: None},
        "tblCrdClensSolRinse": {0: None},
    }


def test_classify_work_type_routes_orders():
    catalog = _minimal_lookup_catalog()
    unresolved = []

    assert phase3.classify_work_type(0, catalog, unresolved_dependencies=unresolved, raw_row_ref="a", source_per_id=1, source_user_id=2) == ("Order", "glasses")
    assert phase3.classify_work_type(1, catalog, unresolved_dependencies=unresolved, raw_row_ref="b", source_per_id=1, source_user_id=2) == ("ContactLensOrder", "contact-lens")
    assert phase3.classify_work_type(2, catalog, unresolved_dependencies=unresolved, raw_row_ref="c", source_per_id=1, source_user_id=2) == ("Order", "service")


def test_build_glasses_exam_data_uses_canonical_keys():
    seed = records.normalize_glasses_exam_row(
        {
            "PerId": "123",
            "CheckDate": "11/26/00 00:00:00",
            "UserId": "224",
            "DominEye": "R",
            "ObjSphR": "-1.00",
            "SphR": "-1.25",
            "CylR": "-0.50",
            "AxR": "180",
            "PVAR": "6",
            "PSphR": "-1.50",
            "PCylR": "-0.75",
            "PAxR": "175",
            "PPDDistR": "31.5",
            "PReadR": "1.50",
            "PHighR": "18",
            "Comments": "note",
            "ObjComm": "obj note",
        }
    )

    exam_data = phase3.build_glasses_exam_data(seed, layout_instance_id=77)

    assert "objective" in exam_data
    assert "subjective" in exam_data
    assert "final-subjective" in exam_data
    assert "final-prescription" in exam_data
    assert "notes-notes-1" in exam_data
    assert "objective-objective-1" not in exam_data
    assert exam_data["objective"]["layout_instance_id"] == 77
    assert exam_data["notes-notes-1"]["card_instance_id"] == "notes-1"


def test_build_glasses_exam_data_omits_final_cards_when_only_zero_prism_base_exists():
    seed = records.normalize_glasses_exam_row(
        {
            "PerId": "123",
            "CheckDate": "11/26/00 00:00:00",
            "PBaseR": "0",
            "PBaseL": "0",
        }
    )

    exam_data = phase3.build_glasses_exam_data(seed, layout_instance_id=77)

    assert "final-subjective" not in exam_data
    assert "final-prescription" not in exam_data


def test_build_notes_text_normalizes_legacy_escaped_newlines():
    text = phase3.build_notes_text(
        (
            ("Comments", "line1\\r\\nline2\\r\\n"),
            ("Recheck Date", "2026-06-27"),
        )
    )

    assert text == "Comments: line1\nline2\nRecheck Date: 2026-06-27"


def test_build_contact_lens_exam_data_uses_canonical_keys():
    seed = records.normalize_contact_lens_exam_row(
        {
            "PerId": "3",
            "CheckDate": "08/18/15 00:00:00",
            "UserId": "224",
            "PupDiam": "3.2",
            "CornDiam": "11.8",
            "BUT": "10",
            "BUTL": "9",
            "ShirR": "12",
            "ShirL": "13",
            "rHR": "43",
            "rVR": "44",
            "rHL": "42",
            "rVL": "43",
            "AxHR": "90",
            "AxHL": "95",
            "DiamR": "14",
            "BC1R": "8.6",
            "OZR": "8.0",
            "SphR": "-2.75",
            "CylR": "-0.75",
            "AxR": "20",
            "VAR": "6",
            "ClensTypeIdR": "1",
            "ClensManufIdR": "4",
            "ClensBrandIdR": "1",
            "MaterR": "2",
            "TintR": "1",
            "ClensSolCleanId": "1",
            "Comments": "דיספו ביו",
        }
    )

    exam_data = phase3.build_contact_lens_exam_data(
        seed,
        layout_instance_id=88,
        catalog=_minimal_lookup_catalog(),
        clinic_name="Clinic",
        unresolved_dependencies=[],
    )

    assert "schirmer-test" in exam_data
    assert "contact-lens-diameters" in exam_data
    assert "keratometer-contact-lens" in exam_data
    assert "contact-lens-details" in exam_data
    assert "contact-lens-exam" in exam_data
    assert "contact-lens-order" in exam_data
    assert exam_data["contact-lens-details"]["r_supplier"] == "J&J"
    assert exam_data["contact-lens-order"]["branch"] == "Clinic"


def test_ensure_phase3_exam_layouts_creates_scoped_layouts():
    db = _build_session()
    _, clinic = _create_company_and_clinic(db)

    glasses_layout, contact_layout = ensure_phase3_exam_layouts(db, clinic)

    assert glasses_layout.name == "OptiTech Imported Glasses Layout"
    assert glasses_layout.type == "glass"
    assert contact_layout.name == "OptiTech Imported Contact Lens Layout"
    assert contact_layout.type == "contact lens"


def test_upsert_glasses_exams_rerun_updates_and_keeps_dual_trace():
    db = _build_session()
    company, clinic = _create_company_and_clinic(db)
    user = _create_user(db, company.id, clinic.id)
    glasses_layout, _ = ensure_phase3_exam_layouts(db, clinic)

    seed_v1 = records.normalize_glasses_exam_row(
        {"PerId": "123", "CheckDate": "11/26/00 00:00:00", "UserId": "224", "DominEye": "R", "PSphR": "-1.25"}
    )
    counters_v1, _, _, _ = phase3.upsert_glasses_exams(
        db,
        seeds=[seed_v1],
        clinic=clinic,
        client_map={123: 9001},
        user_map={224: user.id},
        layout_id=glasses_layout.id,
        layout_data=glasses_layout.layout_data,
        unmapped_report={},
    )
    db.commit()

    seed_v2 = records.normalize_glasses_exam_row(
        {"PerId": "123", "CheckDate": "11/26/00 00:00:00", "UserId": "224", "DominEye": "L", "PSphR": "-1.50", "Comments": "updated"}
    )
    counters_v2, _, _, _ = phase3.upsert_glasses_exams(
        db,
        seeds=[seed_v2],
        clinic=clinic,
        client_map={123: 9001},
        user_map={224: user.id},
        layout_id=glasses_layout.id,
        layout_data=glasses_layout.layout_data,
        unmapped_report={},
    )
    db.commit()

    exams = db.query(OpticalExam).all()
    instances = db.query(ExamLayoutInstance).all()
    exam_links = load_trace_links(db, clinic_id=clinic.id, target_model="OpticalExam")
    instance_links = load_trace_links(db, clinic_id=clinic.id, target_model="ExamLayoutInstance")

    assert counters_v1.created == 1
    assert counters_v2.updated == 1
    assert len(exams) == 1
    assert len(instances) == 1
    assert exams[0].dominant_eye == "L"
    assert instances[0].exam_data["notes-notes-1"]["note"].startswith("Comments: updated")
    layout_rows = json.loads(instances[0].layout_data)["rows"]
    assert [row["cards"][0]["type"] for row in layout_rows] == ["notes"]
    assert exam_links["tblCrdGlassChecks:PerId=123|CheckDate=11/26/00 00:00:00"].target_id == exams[0].id
    assert instance_links["tblCrdGlassChecks:PerId=123|CheckDate=11/26/00 00:00:00"].target_id == instances[0].id


def test_upsert_glasses_exams_recreates_deleted_targets_and_repoints_dual_trace():
    db = _build_session()
    company, clinic = _create_company_and_clinic(db)
    user = _create_user(db, company.id, clinic.id)
    glasses_layout, _ = ensure_phase3_exam_layouts(db, clinic)

    seed = records.normalize_glasses_exam_row(
        {"PerId": "123", "CheckDate": "11/26/00 00:00:00", "UserId": "224", "DominEye": "R", "PSphR": "-1.25"}
    )
    phase3.upsert_glasses_exams(
        db,
        seeds=[seed],
        clinic=clinic,
        client_map={123: 9001},
        user_map={224: user.id},
        layout_id=glasses_layout.id,
        layout_data=glasses_layout.layout_data,
        unmapped_report={},
    )
    db.commit()

    original_exam = db.query(OpticalExam).one()
    original_instance = db.query(ExamLayoutInstance).one()
    db.delete(original_instance)
    db.delete(original_exam)
    db.commit()

    counters, _, _, _ = phase3.upsert_glasses_exams(
        db,
        seeds=[seed],
        clinic=clinic,
        client_map={123: 9001},
        user_map={224: user.id},
        layout_id=glasses_layout.id,
        layout_data=glasses_layout.layout_data,
        unmapped_report={},
    )
    db.commit()

    recreated_exam = db.query(OpticalExam).one()
    recreated_instance = db.query(ExamLayoutInstance).one()

    assert counters.recreated == 1
    assert recreated_exam.id != original_exam.id
    assert recreated_instance.id != original_instance.id


def test_order_exact_matching_does_not_fallback():
    db = _build_session()
    company, clinic = _create_company_and_clinic(db)
    user = _create_user(db, company.id, clinic.id)
    seed = records.normalize_order_row(
        {
            "WorkId": "1",
            "WorkDate": "05/13/97 00:00:00",
            "PerId": "33",
            "UserId": "224",
            "WorkTypeId": "0",
            "CheckDate": "05/14/97 00:00:00",
            "WorkStatId": "3",
            "WorkSupplyId": "1",
        }
    )
    mismatched_exam = {
        (33, "1997-05-13"): phase3.GlassesOrderMatch(
            source_ref="tblCrdGlassChecks:PerId=33|CheckDate=05/13/97 00:00:00",
            dominant_eye="R",
            final_prescription={"r_sph": -1.25},
        )
    }

    counters, _, unresolved = phase3.upsert_orders(
        db,
        seeds=[seed],
        clinic=clinic,
        client_map={33: 8001},
        user_map={224: user.id},
        catalog=_minimal_lookup_catalog(),
        glasses_matches=mismatched_exam,
        contact_lens_matches={},
        unmapped_report={},
    )
    db.commit()

    order = db.query(Order).one()

    assert counters.created == 1
    assert "final-prescription" not in (order.order_data or {})
    assert any(item["dependency"] == "glasses_exam_exact_match" for item in unresolved)


def test_copy_scan_if_needed_is_deterministic(tmp_path, monkeypatch):
    scans_dir = tmp_path / "Scans"
    scans_dir.mkdir()
    source_path = scans_dir / "16069_2012729175921.jpg"
    source_path.write_bytes(b"img")
    seed = records.normalize_file_row(
        {
            "PerPicId": "1",
            "PerId": "16069",
            "PicFileName": "16069_2012729175921.jpg",
            "Description": "Scan",
            "ScanDate": "07/29/12 17:59:21",
        },
        scans_dir=scans_dir,
    )
    monkeypatch.setattr(phase3, "MIGRATED_SCANS_DIR", tmp_path / "out")

    copied_path, file_size, file_type = phase3.copy_scan_if_needed(clinic_id=7, seed=seed, dry_run=False)

    assert copied_path is not None
    assert copied_path.endswith("clinic-7/per-16069/1_16069_2012729175921.jpg")
    assert file_size == 3
    assert file_type == "image/jpeg"
    assert Path(copied_path).read_bytes() == b"img"


def test_build_medical_log_text_labels_sections():
    seed = records.normalize_medical_note_row(
        {
            "PerId": "3211",
            "CheckDate": "07/12/01 00:00:00",
            "UserId": "226",
            "Complaints": "Headaches",
            "OptDiag": "Diagnosis",
            "Summary": "Summary text",
        }
    )

    text = phase3.build_medical_log_text(seed)

    assert "Complaints: Headaches" in text
    assert "Optical Diagnosis: Diagnosis" in text
    assert "Summary: Summary text" in text


def test_calculate_appointment_duration_defaults_and_positive_delta():
    assert phase3.calculate_appointment_duration_minutes("22:00:00", "22:15:00") == 15
    assert phase3.calculate_appointment_duration_minutes("22:15:00", "22:00:00") == 30
    assert phase3.calculate_appointment_duration_minutes("22:00:00", None) == 30


def test_upsert_appointments_skips_unmapped_client():
    db = _build_session()
    _, clinic = _create_company_and_clinic(db)

    seed = records.normalize_appointment_row(
        {
            "AptNum": "1",
            "AptDate": "03/25/06 00:00:00",
            "StarTime": "12/30/99 22:00:00",
            "EndTime": "12/30/99 22:15:00",
            "PerID": "0",
            "UserID": "0",
            "AptDesc": "Birthday",
            "TookPlace": "0",
            "Reminder": "-1",
        }
    )

    counters, skipped_rows, _ = phase3.upsert_appointments(
        db,
        seeds=[seed],
        clinic=clinic,
        client_map={},
        user_map={},
        unmapped_report={},
    )

    assert counters.skipped == 1
    assert skipped_rows[0]["reason"] == "missing_phase2_client_mapping"
    assert db.query(Appointment).count() == 0
