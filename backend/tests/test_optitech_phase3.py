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
from models import Appointment, Base, Clinic, Company, ExamLayoutInstance, OpticalExam, Order, User, WorkShift


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
        "tblCrdGlassBrand": {0: None, 7: "Essilor"},
        "tblCrdGlassRole": {0: None, 8: "Distance"},
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


def test_unknown_work_type_becomes_service_and_is_reported():
    unresolved = []

    assert phase3.classify_work_type(
        99,
        _minimal_lookup_catalog(),
        unresolved_dependencies=unresolved,
        raw_row_ref="order-99",
        source_per_id=1,
        source_user_id=2,
    ) == ("Order", "service")
    assert any(item["dependency"] == "unsupported_work_type" for item in unresolved)


def test_regular_order_preserves_extended_optitech_fields():
    seed = records.normalize_order_row(
        {
            "WorkId": "10",
            "WorkDate": "05/13/97 00:00:00",
            "PerId": "33",
            "UserId": "224",
            "WorkTypeId": "0",
            "CheckDate": "05/13/97 00:00:00",
            "WorkStatId": "3",
            "WorkSupplyId": "1",
            "LabId": "1",
            "SapakId": "3",
            "BagNum": "B-55",
            "FSapakId": "3",
            "FLabelId": "2",
            "FModel": "Aviator",
            "FColor": "Black",
            "FSize": "52-18-140",
            "FrameSold": "0",
            "RoleId": "8",
            "MaterId": "5",
            "BrandId": "7",
            "CoatId": "1",
            "ModelId": "2",
            "ColorId": "3",
            "Diam": "70",
            "Segment": "28",
        }
    )

    order_data, unmapped = phase3.build_regular_order_data(
        seed,
        catalog=_minimal_lookup_catalog(),
        clinic_name="Clinic",
        unresolved_dependencies=[],
        matched_exam=None,
    )

    assert order_data["lens"]["right_diameter"] == "70"
    assert order_data["frame"] == {
        "color": "Black",
        "supplier": "אופליין",
        "model": "Aviator",
        "manufacturer": "OGA",
        "supplied_by": "אופליין",
        "bridge": 18,
        "width": 52,
        "length": 140,
    }
    assert order_data["details"]["bag_number"] == "B-55"
    assert order_data["legacy_source"]["frame"]["frame_sold"] is False
    assert order_data["legacy_source"]["lens"]["segment"] == 28.0
    assert order_data["legacy_source"]["resolved_lookups"] == {
        "glass_brand": "Essilor",
        "glass_role": "Distance",
        "lens_model": "1.6",
        "lens_color": "חום",
        "lens_coating": "A/R",
        "lens_material": "פלסטיק",
        "lens_supplier": "אופליין",
        "frame_supplier": "אופליין",
        "frame_label": "OGA",
        "work_supply": "במלאי",
        "work_lab": "אורי",
        "work_status": "נמסרה",
    }
    assert unmapped == {}


def test_contact_order_preserves_optitech_work_fields():
    seed = records.normalize_order_row(
        {
            "WorkId": "11",
            "WorkDate": "05/13/97 00:00:00",
            "PerId": "33",
            "UserId": "224",
            "WorkTypeId": "1",
            "WorkStatId": "3",
            "WorkSupplyId": "1",
            "LabId": "1",
            "SapakId": "3",
            "BagNum": "CL-9",
            "FModel": "Legacy frame",
            "BrandId": "7",
        }
    )

    payload, order_data, unmapped = phase3.build_contact_lens_order_payloads(
        seed,
        clinic=type("ClinicStub", (), {"id": 5, "name": "Clinic"})(),
        catalog=_minimal_lookup_catalog(),
        unresolved_dependencies=[],
        matched_exam=None,
    )

    assert payload["order_status"] == "נמסרה"
    assert order_data["legacy_source"]["work"]["bag_number"] == "CL-9"
    assert order_data["legacy_source"]["frame"]["frame_model"] == "Legacy frame"
    assert order_data["legacy_source"]["lens"]["lens_brand_id"] == 7
    assert order_data["legacy_source"]["resolved_lookups"] == {
        "work_status": "נמסרה",
        "work_supply": "במלאי",
        "work_lab": "אורי",
        "work_supplier": "אופליין",
    }
    assert unmapped == {}


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
            "ReadR": "1.25",
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
    assert "final-prescription" in exam_data
    assert any(key.startswith("old-refraction-old-refraction-1-") for key in exam_data)
    assert "notes-notes-1" in exam_data
    assert "objective-objective-1" not in exam_data
    assert exam_data["objective"]["layout_instance_id"] == 77
    assert exam_data["objective"]["card_instance_id"] == "objective-1"
    assert exam_data["final-prescription"]["card_instance_id"] == "final-prescription-1"
    assert exam_data["addition"]["card_instance_id"] == "addition-1"
    assert exam_data["notes-notes-1"]["card_instance_id"] == "notes-1"


def test_main_prescription_and_previous_prescription_are_kept_separate():
    seed = records.normalize_glasses_exam_row(
        {
            "PerId": "123",
            "CheckDate": "2026-01-01 00:00:00",
            "SphR": "-1.00",
            "ReadR": "1.25",
            "PBaseR": "OUT",
            "PPrisR": "2",
            "PSphR": "-2.00",
            "PMulR": "1",
            "PJR": "J2-1",
        }
    )

    exam_data = phase3.build_glasses_exam_data(seed, layout_instance_id=7)
    final = exam_data["final-prescription"]
    old_key = next(key for key in exam_data if key.startswith("old-refraction-old-refraction-1-"))
    old = exam_data[old_key]

    assert final["r_sph"] == -1.0
    assert final["r_ad"] == 1.25
    assert old["r_sph"] == -2.0
    assert old["r_pris"] == 2.0
    assert old["r_base"] == "OUT"
    assert old["r_j"] == "J2-1"
    assert old["r_glasses_type"] == "מולטיפוקל"
    assert exam_data["__ui"]["tabsByCard"]["old-refraction:old-refraction-1"][0]["type"] == "מולטיפוקל"


def test_previous_refraction_detail_keeps_rare_extended_values_trace_only():
    tabs = records.normalize_previous_refraction_row(
        {
            "PrevId": "9",
            "SphR1": "-3.00",
            "PDDistR1": "31",
            "ExtPrisR1": "2",
            "ExtBaseR1": "IN",
        }
    )

    assert tabs[0]["r_sph"] == -3.0
    assert tabs[0]["trace_pd_far"]["r"] == 31.0
    assert tabs[0]["trace_secondary_prism"] == {
        "r": 2.0,
        "l": None,
        "r_base": "IN",
        "l_base": None,
    }


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
    assert exam_data["contact-lens-details"]["card_instance_id"] == "contact-lens-details-1"
    assert exam_data["contact-lens-order"]["branch"] == "Clinic"
    assert exam_data["contact-lens-exam"]["r_va"] == "6"
    assert "r_bc_2" not in exam_data["contact-lens-exam"]


def test_contact_exam_suppresses_empty_card_and_keeps_invalid_oz_in_trace():
    empty_seed = records.normalize_contact_lens_exam_row(
        {"PerId": "3", "CheckDate": "2026-01-01 00:00:00", "OZR": "wide"}
    )
    exam_data = phase3.build_contact_lens_exam_data(
        empty_seed,
        layout_instance_id=8,
        catalog=_minimal_lookup_catalog(),
        clinic_name="Clinic",
        unresolved_dependencies=[],
    )

    assert "contact-lens-exam" not in exam_data
    assert empty_seed.source_ref.raw_payload["OZR"] == "wide"


def test_keratometry_detects_diopters_and_millimeters():
    seed = records.normalize_contact_lens_exam_row(
        {
            "PerId": "3",
            "CheckDate": "2026-01-01 00:00:00",
            "rHR": "45",
            "rVR": "7.5",
        }
    )
    payload = phase3.build_contact_lens_keratometer_payload(seed, layout_instance_id=8)

    assert payload["r_rh"] == 7.5
    assert payload["r_rv"] == 7.5


def test_ensure_phase3_exam_layouts_creates_scoped_layouts():
    db = _build_session()
    _, clinic = _create_company_and_clinic(db)

    glasses_layout, contact_layout = ensure_phase3_exam_layouts(db, clinic)

    assert glasses_layout.name == "OptiTech Imported Glasses Layout"
    assert glasses_layout.type == "glass"
    assert contact_layout.name == "OptiTech Imported Contact Lens Layout"
    assert contact_layout.type == "contact lens"


def test_upsert_glasses_exam_keeps_full_instance_data_without_a_default_layout():
    db = _build_session()
    company, clinic = _create_company_and_clinic(db)
    fallback_user = _create_user(db, company.id, clinic.id)
    seed = records.normalize_glasses_exam_row(
        {"PerId": "123", "CheckDate": "2026-01-01", "UserId": "224", "SphR": "-1.25"}
    )

    counters, _, unresolved, _ = phase3.upsert_glasses_exams(
        db,
        seeds=[seed],
        clinic=clinic,
        client_map={123: 9001},
        user_map={-1: fallback_user.id},
        layout_id=None,
        layout_data="",
        unmapped_report={},
        migration_job_id="job-1",
    )
    db.commit()

    instance = db.query(ExamLayoutInstance).one()
    assert counters.created == 1
    assert unresolved == []
    assert instance.layout_id is None
    assert instance.layout_data
    assert instance.exam_data["final-prescription"]["r_sph"] == -1.25


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
        migration_job_id="job-1",
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
        migration_job_id="job-1",
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
    layout = json.loads(instances[0].layout_data)
    assert layout["version"] == 2
    assert layout["grid"]["columns"] == 24
    assert [item["type"] for item in layout["items"]] == [
        "old-refraction",
        "notes",
    ]
    assert exam_links["tblCrdGlassChecks:PerId=123|CheckDate=11/26/00 00:00:00"].target_id == exams[0].id
    assert instance_links["tblCrdGlassChecks:PerId=123|CheckDate=11/26/00 00:00:00"].target_id == instances[0].id
    assert exam_links["tblCrdGlassChecks:PerId=123|CheckDate=11/26/00 00:00:00"].raw_payload["Comments"] == "updated"
    assert instance_links["tblCrdGlassChecks:PerId=123|CheckDate=11/26/00 00:00:00"].migration_job_id == "job-1"


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
        migration_job_id="job-1",
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
        migration_job_id="job-1",
    )
    db.commit()

    recreated_exam = db.query(OpticalExam).one()
    recreated_instance = db.query(ExamLayoutInstance).one()
    exam_links = load_trace_links(db, clinic_id=clinic.id, target_model="OpticalExam")
    instance_links = load_trace_links(db, clinic_id=clinic.id, target_model="ExamLayoutInstance")
    raw_ref = "tblCrdGlassChecks:PerId=123|CheckDate=11/26/00 00:00:00"

    assert counters.recreated == 1
    assert exam_links[raw_ref].target_id == recreated_exam.id
    assert instance_links[raw_ref].target_id == recreated_instance.id


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
        migration_job_id="order-job",
    )
    db.commit()

    order = db.query(Order).one()
    order_links = load_trace_links(db, clinic_id=clinic.id, target_model="Order")

    assert counters.created == 1
    assert "final-prescription" not in (order.order_data or {})
    assert any(item["dependency"] == "glasses_exam_exact_match" for item in unresolved)
    order_link = order_links["tblCrdBuysWorks:WorkId=1"]
    assert order_link.raw_payload["WorkId"] == "1"
    assert order_link.migration_job_id == "order-job"


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


def test_work_shift_payload_reconstructs_missing_times():
    complete = records.normalize_work_shift_row(
        {
            "WrkId": "1",
            "UserID": "4",
            "WrkDate": "2026-01-02",
            "StartTime": "08:00:00",
            "EndTime": "16:30:00",
            "WrkTime": "8",
        }
    )
    missing_end = records.normalize_work_shift_row(
        {
            "WrkId": "2",
            "UserID": "4",
            "WrkDate": "2026-01-02",
            "StartTime": "09:00:00",
            "WrkTime": "2.5",
        }
    )
    missing_start = records.normalize_work_shift_row(
        {"WrkId": "3", "UserID": "4", "WrkDate": "2026-01-02", "WrkTime": "1.25"}
    )

    complete_payload, complete_warnings = phase3.build_work_shift_payload(complete)
    end_payload, end_warnings = phase3.build_work_shift_payload(missing_end)
    start_payload, start_warnings = phase3.build_work_shift_payload(missing_start)

    assert complete_payload["duration_minutes"] == 510
    assert complete_warnings == []
    assert end_payload["end_time"] == "11:30:00"
    assert end_warnings == ["missing_end_reconstructed_from_wrk_time"]
    assert start_payload["start_time"] == "00:00:00"
    assert start_payload["end_time"] == "01:15:00"
    assert start_warnings == ["missing_start_reconstructed_at_midnight"]


def test_work_shift_upsert_links_user_and_resumes_only_same_v2_job():
    db = _build_session()
    company, clinic = _create_company_and_clinic(db)
    user = _create_user(db, company.id, clinic.id)
    seed = records.normalize_work_shift_row(
        {"WrkId": "1", "UserID": "4", "WrkDate": "2026-01-02", "WrkTime": "1"}
    )

    first, _, warnings = phase3.upsert_work_shifts(
        db, seeds=[seed], clinic=clinic, user_map={4: user.id}, migration_job_id="job-1"
    )
    db.commit()
    same_job, _, _ = phase3.upsert_work_shifts(
        db, seeds=[seed], clinic=clinic, user_map={4: user.id}, migration_job_id="job-1"
    )
    db.commit()
    new_job, skipped, _ = phase3.upsert_work_shifts(
        db, seeds=[seed], clinic=clinic, user_map={4: user.id}, migration_job_id="job-2"
    )
    db.commit()

    shift = db.query(WorkShift).one()
    assert first.created == 1
    assert same_job.updated == 1
    assert new_job.skipped == 1
    assert skipped[0]["reason"] == "existing_non_resumable_import"
    assert shift.user_id == user.id
    assert shift.status == "completed"
    assert warnings[0]["warnings"] == ["missing_start_reconstructed_at_midnight"]
