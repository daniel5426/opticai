import csv
import json

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base
from backend.migration import migrate_csv_to_postgres as migration
from backend.models import (
    Billing,
    BillingPayment,
    Client,
    Clinic,
    Company,
    ContactLensOrder,
    ExamLayoutInstance,
    LookupColor,
    MedicalLog,
    OpticalExam,
    Order,
    OrderLineItem,
    User,
)


def test_numeric_parsing_distinguishes_general_and_optical_values():
    assert migration.parse_int("172") == 172
    assert migration.parse_float("172") == 172.0
    assert migration.parse_optical_float("'+0125'") == 1.25
    assert migration.parse_optical_float("'-0825'") == -8.25
    assert migration.parse_optical_float("'Plano'") == 0.0


def test_read_csv_no_limit_by_default(tmp_path, monkeypatch):
    csv_path = tmp_path / "sample.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["id"])
        writer.writeheader()
        for idx in range(1005):
            writer.writerow({"id": idx})

    monkeypatch.delenv("CSV_MAX_ROWS", raising=False)
    rows = migration.read_csv(str(tmp_path), "sample.csv")
    assert len(rows) == 1005


def test_read_csv_preserves_quoted_commas_when_dialect_disables_doublequote(tmp_path, monkeypatch):
    class IncorrectlySniffedDialect(csv.excel):
        doublequote = False

    csv_path = tmp_path / "optic_exp_eyetests.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["code", "anam_remarks", "anam_medicine"])
        writer.writeheader()
        writer.writerow(
            {
                "code": "1",
                "anam_remarks": 'First "quoted", second sentence',
                "anam_medicine": "medicine",
            }
        )

    monkeypatch.setattr(
        "backend.migration.pipeline.common._detect_csv_encoding_and_dialect",
        lambda _path: ("utf-8", IncorrectlySniffedDialect),
    )

    rows = migration.read_csv(str(tmp_path), "optic_exp_eyetests.csv")

    assert rows == [
        {
            "code": "1",
            "anam_remarks": 'First "quoted", second sentence',
            "anam_medicine": "medicine",
        }
    ]


def test_build_exam_data_uses_current_keys():
    row = {
        "or_right_sph": "'-0150'",
        "or_left_sph": "'-0100'",
        "or_right_cyl": "'-0050'",
        "or_left_cyl": "'-0025'",
        "or_right_ax": "174",
        "or_left_ax": "12",
        "ob_right_se": "+0525",
        "ob_left_se": "-0050",
        "bino_ct_fv_exo_p": "4",
        "bio_r_lach": "stable",
    }

    exam_data = migration.build_exam_data_from_eye_tests(row, None)

    assert "old-refraction-old-refraction-1-legacy" in exam_data
    assert exam_data["old-refraction-old-refraction-1-legacy"]["card_id"] == "old-refraction-1"
    assert not any(key.startswith("cover-test-") for key in exam_data)
    assert "sensation-vision-stability-sensation-vision-stability-1" not in exam_data
    assert exam_data["objective-objective-1"]["r_se"] == 5.25
    assert exam_data["objective-objective-1"]["l_se"] == -0.5


def test_migrate_optical_exams_includes_expanded_only_rows(tmp_path):
    with (tmp_path / "optic_eye_tests.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["code", "account_code", "branch_code", "test_date", "test_reason"])
        writer.writeheader()
        writer.writerow({"code": "1", "account_code": "101", "branch_code": "A", "test_date": "2020-01-01", "test_reason": "Legacy"})

    with (tmp_path / "optic_exp_eyetests.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["code", "account_code", "branch_code", "test_date", "test_reason", "sub_r_sph"],
        )
        writer.writeheader()
        writer.writerow({"code": "1", "account_code": "101", "branch_code": "A", "test_date": "2020-01-01", "sub_r_sph": "+0100"})
        writer.writerow({"code": "2", "account_code": "101", "branch_code": "A", "test_date": "2021-02-03", "test_reason": "Expanded", "sub_r_sph": "+0200"})

    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        company = Company(name="A", owner_full_name="Owner A")
        db.add(company)
        db.flush()
        clinic = Clinic(company_id=company.id, name="Selected", unique_id="selected")
        db.add(clinic)
        db.flush()
        user = User(company_id=company.id, clinic_id=clinic.id, username="admin", role_level=5)
        client = Client(id=101, company_id=company.id, clinic_id=clinic.id, first_name="Test")
        db.add_all([user, client])
        db.commit()

        migration.migrate_optical_exams(
            db,
            str(tmp_path),
            {"101": client.id},
            {"A": clinic.id},
            user.id,
        )

        exams = db.query(OpticalExam).order_by(OpticalExam.exam_date).all()
        assert len(exams) == 2
        assert exams[1].test_name == "Expanded"
        assert str(exams[1].exam_date) == "2021-02-03"
        instance = db.query(ExamLayoutInstance).filter_by(exam_id=exams[1].id).one()
        assert instance.exam_data["subjective-subjective-1"]["r_sph"] == 2.0


def test_contact_fit_creates_separate_exam_with_exact_cards(tmp_path):
    for filename, fields in (
        ("optic_eye_tests.csv", ["code", "account_code"]),
        ("optic_exp_eyetests.csv", ["code", "account_code"]),
        ("optic_device_data.csv", ["code", "account_code"]),
    ):
        with (tmp_path / filename).open("w", newline="", encoding="utf-8") as handle:
            csv.DictWriter(handle, fieldnames=fields).writeheader()
    contact_fields = [
        "code", "account_code", "branch_code", "fit_date", "obs_right_feeling", "obs_left_sight",
        "old_right_type", "old_right_sph", "obj_right_sph", "or_right_sph", "fit_remark",
        "obs_remarks", "fit_remarks", "bino_mr_h_with", "bino_mr_h_addw", "bino_st_fly",
        "bino_st_cir_9", "bino_st_cir_3", "bino_ct_fv_exo_p", "bino_rg_selection",
    ]
    with (tmp_path / "optic_contact_fit.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=contact_fields)
        writer.writeheader()
        writer.writerow({
            "code": "fit-1", "account_code": "101", "branch_code": "A", "fit_date": "2022-03-04",
            "obs_right_feeling": "good", "obs_left_sight": "clear", "old_right_type": "soft",
            "old_right_sph": "-0125", "obj_right_sph": "-0100", "or_right_sph": "-0050",
            "fit_remark": "fit", "obs_remarks": "observation", "fit_remarks": "follow up",
            "bino_mr_h_with": "2", "bino_mr_h_addw": "EXO", "bino_st_fly": "1",
            "bino_st_cir_9": "4", "bino_st_cir_3": "1", "bino_ct_fv_exo_p": "9",
            "bino_rg_selection": "1",
        })

    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        company = Company(name="A", owner_full_name="Owner A")
        db.add(company); db.flush()
        clinic = Clinic(company_id=company.id, name="Selected", unique_id="selected")
        db.add(clinic); db.flush()
        user = User(company_id=company.id, clinic_id=clinic.id, username="admin", role_level=5)
        client = Client(id=101, company_id=company.id, clinic_id=clinic.id, first_name="Test")
        db.add_all([user, client]); db.commit()
        migration.migrate_optical_exams(db, str(tmp_path), {"101": 101}, {"A": clinic.id}, user.id)
        exam = db.query(OpticalExam).one()
        assert exam.type == "contact_fit"
        assert str(exam.exam_date) == "2022-03-04"
        data = db.query(ExamLayoutInstance).filter_by(exam_id=exam.id).one().exam_data
        assert data["sensation-vision-stability"]["r_sensation"] == "good"
        assert data["old-contact-lenses"]["r_sph"] == -1.25
        assert data["objective"]["r_sph"] == -1.0
        assert data["over-refraction"]["r_sph"] == -0.5
        assert data["maddox-rod"]["with_horizontal_direction"] == "EXO"
        assert data["stereo-test"]["circle_3_score"] == 1
        assert "cover-test" not in data and "rg" not in data
        assert len([key for key in data if key.startswith("notes-notes-")]) == 3


def test_addition_j_values_are_normalized():
    exam_data = migration.build_exam_data_from_eye_tests(
        {
            "add_right_j": "2",
            "add_left_j": "j10",
        },
        None,
    )

    addition = exam_data["addition-addition-1"]
    assert addition["r_j"] == "J2"
    assert addition["l_j"] == "J10"
    assert migration.normalize_j_value("22") == "J22"


def test_lossless_optical_values_fcc_va_base_and_pd_mapping():
    exam_data = migration.build_exam_data_from_eye_tests(
        {},
        {
            "sub_r_sph": "Ambli", "sub_r_va": "6/12+2", "sub_r_baseh": "BI",
            "sub_b_pd": "62", "add_right_fcc": "0111",
            "sub_f_r_far_pd": "31", "sub_f_r_near_pd": "29",
            "sub_f_b_far_pd": "62", "sub_f_b_near_pd": "58",
            "sub_r_add_at": "0125",
        },
    )
    subjective = exam_data["subjective-subjective-1"]
    assert subjective["r_sph"] == "Ambli"
    assert subjective["r_va"] == "6/12+2"
    assert subjective["r_base"] == "IN"
    assert subjective["comb_pd_far"] == 62
    assert subjective["comb_pd_close"] is None
    assert exam_data["addition-addition-1"]["r_fcc"] == 1.11
    final = exam_data["final-prescription-final-prescription-1"]
    assert final["r_pd_far"] == 31
    assert final["r_pd_close"] == 29
    assert final["comb_pd_close"] == 58
    compact = exam_data["compact-prescription-compact-prescription-1"]
    assert compact["r_ad"] == 1.25


def test_maddox_stereo_and_ambiguous_binocular_mappings():
    data = migration.build_exam_data_from_eye_tests({}, {
        "bino_mr_h_with": "2", "bino_mr_h_addw": "EXO",
        "bino_mt_v_with": "4", "bino_mr_v_addw": "R/L",
        "bino_mr_h_no": "3", "bino_mr_h_addn": "ESO",
        "bino_mr_v_no": "5", "bino_mr_v_addn": "L/R",
        "bino_st_fly": "1", "bino_st_cir_9": "4", "bino_st_cir_3": "1",
        "bino_ct_fv_exo_p": "9", "bino_rg_selection": "1",
    })
    maddox = data["maddox-rod-maddox-rod-1"]
    assert maddox["schema_version"] == 2
    assert maddox["with_horizontal_prism"] == 2
    assert maddox["with_vertical_direction"] == "R/L"
    stereo = data["stereo-test-stereo-test-1"]
    assert stereo["fly_result"] is True
    assert stereo["circle_9_score"] == 4
    assert stereo["circle_3_score"] == 1
    assert "cover-test" not in data
    assert "rg" not in data


def test_old_refraction_tabs_use_legacy_type_not_source_or_lens():
    data = migration.build_exam_data_from_eye_tests({}, {
        "old1_type": "מרחק", "old1_source": "source", "old1_lens": "lens", "old1_r_sph": "0100",
        "old2_type": "למחשב", "old2_l_sph": "0200",
    })
    first = data["old-refraction-old-refraction-1-1"]
    second = data["old-refraction-old-refraction-1-2"]
    assert first["r_glasses_type"] == "רחוק"
    assert first["legacy_glasses_type"] == "מרחק"
    assert second["l_glasses_type"] == "קרוב"


def test_keratometer_sources_detect_mm_and_diopters():
    assert migration.build_keratometer({"cr_rv_right": "45", "cr_rh_right": "7.5"}) == {
        "r_k1": 7.5, "l_k1": None, "r_k2": 7.5, "l_k2": None, "r_axis": None, "l_axis": None,
    }
    full = migration.build_exam_data_from_eye_tests({}, {
        "obj_k_r_dpt1": "7.5", "obj_k_r_dpt2": "45",
        "obj_k_l_mm1": "7.8", "obj_k_l_mm2": "43.27",
    })["keratometer-full"]
    assert full["r_mm_k1"] == 7.5 and full["r_dpt_k1"] == 45
    assert full["r_dpt_k2"] == 45 and full["r_mm_k2"] == 7.5
    assert full["l_dpt_k1"] == round(337.5 / 7.8, 2)


def test_referrer_resolves_latest_active_full_hierarchy(tmp_path):
    fixtures = {
        "optic_tv_incoming_source_a.csv": (["code", "source_name"], [["1", "Doctor"]]),
        "optic_tv_incoming_source_b.csv": (["code", "source_name", "level_a"], [["2", "Clinic", "1"]]),
        "optic_tv_incoming_source_c.csv": (["code", "source_name", "level_a", "level_b"], [["3", "Campaign", "1", "2"]]),
        "account_incoming_source.csv": (
            ["code", "account_code", "source_date", "level_a", "level_b", "level_c", "source_remark", "is_active"],
            [["1", "101", "2020-01-01", "1", "2", "3", "old", "1"], ["2", "101", "2021-01-01", "1", "2", "3", "friend", "1"]],
        ),
    }
    for filename, (fields, rows) in fixtures.items():
        with (tmp_path / filename).open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle); writer.writerow(fields); writer.writerows(rows)
    assert migration.load_incoming_source_referrers(str(tmp_path))["101"] == "Doctor / Clinic / Campaign — friend"


def test_default_layout_contains_expected_cards():
    layout = json.loads(migration.build_default_migrated_layout_data())
    assert layout["version"] == 2
    assert layout["grid"]["columns"] == 24
    card_ids = [item["id"] for item in layout["items"]]
    assert "old-refraction-1" in card_ids
    assert "sensation-vision-stability-1" in card_ids
    widths = {item["id"]: item["w"] for item in layout["items"]}
    assert widths["keratometer-1"] == 6
    assert widths["maddox-rod-1"] == 9
    assert widths["retinoscop-1"] == 11
    contact_fit_layout = json.loads(migration.build_contact_fit_layout_data())
    assert next(item["w"] for item in contact_fit_layout["items"] if item["id"] == "maddox-rod-1") == 9


def test_write_legacy_blob_file_persists_content(tmp_path, monkeypatch):
    monkeypatch.setattr("backend.migration.pipeline.common.MIGRATED_FILES_DIR", str(tmp_path))
    path, size, mime_type, saved_name = migration.write_legacy_blob_file(
        "abc123",
        "report.pdf",
        "0x255044462d312e340a",
    )

    assert path is not None
    assert size == 9
    assert mime_type == "application/pdf"
    assert saved_name == "report.pdf"
    assert (tmp_path / "abc123.pdf").read_bytes() == bytes.fromhex("255044462d312e340a")


def test_migrate_lookups_imports_into_selected_clinic(tmp_path):
    csv_path = tmp_path / "optic_tv_lens_color.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["name"])
        writer.writeheader()
        writer.writerow({"name": "Blue"})

    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        company = Company(name="A", owner_full_name="Owner A")
        db.add(company)
        db.flush()
        selected = Clinic(company_id=company.id, name="Selected", unique_id="selected")
        other = Clinic(company_id=company.id, name="Other", unique_id="other")
        db.add_all([selected, other])
        db.commit()

        migration.migrate_lookups(db, str(tmp_path), [selected.id])

        assert db.query(LookupColor).filter_by(clinic_id=selected.id, name="Blue").count() == 1
        assert db.query(LookupColor).filter_by(clinic_id=other.id, name="Blue").count() == 0


def test_migrate_medical_logs_skips_empty_memos_and_uses_note_text(tmp_path):
    csv_path = tmp_path / "account_memos.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "account_code",
                "branch_code",
                "memo_date",
                "memo_type",
                "memo_reason",
                "memo_remark",
            ],
        )
        writer.writeheader()
        writer.writerow(
            {
                "account_code": "101",
                "branch_code": "A",
                "memo_date": "2026-06-01",
                "memo_type": "'בדיקת ראיה'",
                "memo_reason": "''",
                "memo_remark": "'Patient note'",
            }
        )
        writer.writerow(
            {
                "account_code": "101",
                "branch_code": "A",
                "memo_date": "2026-06-02",
                "memo_type": "'בדיקת ראיה'",
                "memo_reason": "'Follow up'",
                "memo_remark": "''",
            }
        )
        writer.writerow(
            {
                "account_code": "101",
                "branch_code": "A",
                "memo_date": "2026-06-03",
                "memo_type": "'בדיקת ראיה'",
                "memo_reason": "''",
                "memo_remark": "''",
            }
        )

    chart_csv_path = tmp_path / "account_chart.csv"
    with chart_csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "account_code",
                "account_type",
                "chart_text",
                "is_active",
                "last_action",
            ],
        )
        writer.writeheader()
        writer.writerow(
            {
                "account_code": "101",
                "account_type": "CUST",
                "chart_text": "15/06/2026 גילין\\x0d\\x0a\\x0d\\x0a25/06/2026  גךחןם 2\\x0d\\x0a",
                "is_active": "1",
                "last_action": "2026-06-15 15:19:17.357",
            }
        )

    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        company = Company(name="A", owner_full_name="Owner A")
        db.add(company)
        db.flush()
        clinic = Clinic(company_id=company.id, name="Selected", unique_id="selected")
        db.add(clinic)
        db.flush()
        user = User(company_id=company.id, clinic_id=clinic.id, username="admin", role_level=4, is_active=True)
        client = Client(company_id=company.id, clinic_id=clinic.id, first_name="A")
        db.add_all([user, client])
        db.commit()

        migration.migrate_medical_logs(
            db,
            str(tmp_path),
            {"101": client.id},
            {None: clinic.id, "": clinic.id, "A": clinic.id},
            user.id,
        )

        logs = db.query(MedicalLog).order_by(MedicalLog.log_date).all()
        assert [(log.log_date.isoformat() if log.log_date else None, log.log) for log in logs] == [
            ("2026-06-01", "Patient note"),
            ("2026-06-02", "Follow up"),
            ("2026-06-15", "גילין"),
            ("2026-06-25", "גךחןם 2"),
        ]


def test_resolve_existing_clinic_accepts_unique_id():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        company = Company(name="A", owner_full_name="Owner A")
        db.add(company)
        db.flush()
        clinic = Clinic(
            company_id=company.id,
            name="Selected",
            unique_id="fec7a931df1047a7b75f0bf32b0c02c6",
        )
        db.add(clinic)
        db.commit()

        resolved = migration.resolve_existing_clinic(
            db,
            "fec7a931df1047a7b75f0bf32b0c02c6",
        )

        assert resolved.id == clinic.id


def test_resolve_migration_clinic_id_falls_back_to_target_clinic():
    branch_to_clinic = {None: 23, "": 23, "A": 23}

    assert migration.resolve_migration_clinic_id(branch_to_clinic, "A") == 23
    assert migration.resolve_migration_clinic_id(branch_to_clinic, None) == 23
    assert migration.resolve_migration_clinic_id(branch_to_clinic, "") == 23


def test_regular_order_migrates_lookup_lens_frame_billing_and_payments(tmp_path):
    with (tmp_path / "optic_tv_order_type.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["code", "name"])
        writer.writeheader()
        writer.writerow({"code": "31", "name": "רגילה"})

    with (tmp_path / "optic_glasses_presc.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "code",
                "account_code",
                "branch_code",
                "presc_date",
                "order_type",
                "lens_supplier",
                "lens_mater",
                "lens_color",
                "lens_coat",
                "frame_supply_by",
                "total_sum",
                "discount_sum",
                "advance_sum",
                "num_payments",
            ],
        )
        writer.writeheader()
        writer.writerow(
            {
                "code": "506",
                "account_code": "101",
                "branch_code": "A",
                "presc_date": "2026-06-01",
                "order_type": "31",
                "lens_supplier": "ספק",
                "lens_mater": "חומר",
                "lens_color": "צבע",
                "lens_coat": "ציפוי",
                "frame_supply_by": "0",
                "total_sum": "233.00",
                "discount_sum": "0.00",
                "advance_sum": "22.00",
                "num_payments": "0",
            }
        )

    with (tmp_path / "optic_presc_prices.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "presc_code",
                "item_code",
                "code",
                "item_name",
                "item_price",
                "item_qty",
                "line_discount",
                "line_after_discount",
                "supplyby",
                "supplied",
            ],
        )
        writer.writeheader()
        writer.writerow(
            {
                "presc_code": "506",
                "item_code": "",
                "code": "6",
                "item_name": "תיאור",
                "item_price": "233.00",
                "item_qty": "1.0",
                "line_discount": "0.0000",
                "line_after_discount": "233.00",
                "supplyby": "0",
                "supplied": "1",
            }
        )

    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        company = Company(name="A", owner_full_name="Owner A")
        db.add(company)
        db.flush()
        clinic = Clinic(company_id=company.id, name="Selected", unique_id="selected")
        db.add(clinic)
        db.flush()
        user = User(company_id=company.id, clinic_id=clinic.id, username="admin", role_level=4, is_active=True)
        client = Client(company_id=company.id, clinic_id=clinic.id, first_name="A")
        db.add_all([user, client])
        db.commit()

        migration.migrate_regular_orders(
            db,
            str(tmp_path),
            {"101": client.id},
            {None: clinic.id, "": clinic.id, "A": clinic.id},
            user.id,
        )

        order = db.query(Order).one()
        assert order.type == "רגילה"
        tab = order.order_data["lens_frame_tabs"][0]
        assert tab["lens"]["right_supplier"] == "ספק"
        assert tab["lens"]["left_supplier"] == "ספק"
        assert tab["lens"]["right_material"] == "חומר"
        assert tab["lens"]["left_color"] == "צבע"
        assert tab["lens"]["right_coating"] == "ציפוי"
        assert tab["frame"]["supplied_by"] == "חנות"

        billing = db.query(Billing).filter_by(order_id=order.id).one()
        assert billing.installment_count is None
        assert billing.prepayment_amount == 22.0
        assert db.query(BillingPayment).filter_by(billing_id=billing.id, amount=22.0).count() == 1
        line_item = db.query(OrderLineItem).filter_by(billings_id=billing.id).one()
        assert line_item.sku == "6"
        assert line_item.description == "תיאור"
        assert line_item.price == 233.0
        assert line_item.quantity == 1.0
        assert line_item.line_total == 233.0
        assert line_item.supplied is True


def test_contact_order_migrates_type_aliases_price_rows_and_installments(tmp_path):
    with (tmp_path / "optic_contact_presc.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "code",
                "account_code",
                "branch_code",
                "presc_date",
                "right_type",
                "left_type",
                "total_sum",
                "discount_sum",
                "advance_sum",
                "num_payments",
            ],
        )
        writer.writeheader()
        writer.writerow(
            {
                "code": "508",
                "account_code": "101",
                "branch_code": "A",
                "presc_date": "2026-06-02",
                "right_type": "2222",
                "left_type": "2222",
                "total_sum": "221.00",
                "discount_sum": "0.00",
                "advance_sum": "0.00",
                "num_payments": "2",
            }
        )

    with (tmp_path / "optic_presc_prices.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "presc_code",
                "code",
                "item_name",
                "item_price",
                "item_qty",
                "line_discount",
                "line_after_discount",
            ],
        )
        writer.writeheader()
        writer.writerow(
            {
                "presc_code": "508",
                "code": "8",
                "item_name": "מצמנהנצתיטוא",
                "item_price": "221.00",
                "item_qty": "1.0",
                "line_discount": "0.0000",
                "line_after_discount": "221.00",
            }
        )

    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        company = Company(name="A", owner_full_name="Owner A")
        db.add(company)
        db.flush()
        clinic = Clinic(company_id=company.id, name="Selected", unique_id="selected")
        db.add(clinic)
        db.flush()
        user = User(company_id=company.id, clinic_id=clinic.id, username="admin", role_level=4, is_active=True)
        client = Client(company_id=company.id, clinic_id=clinic.id, first_name="A")
        db.add_all([user, client])
        db.commit()

        migration.migrate_contact_lens_orders(
            db,
            str(tmp_path),
            {"101": client.id},
            {None: clinic.id, "": clinic.id, "A": clinic.id},
            user.id,
        )

        order = db.query(ContactLensOrder).one()
        details = order.order_data["contact-lens-details"]
        assert details["r_lens_type"] == "2222"
        assert details["l_lens_type"] == "2222"
        assert details["r_type"] == "2222"
        assert details["l_type"] == "2222"

        billing = db.query(Billing).filter_by(contact_lens_id=order.id).one()
        assert billing.installment_count == 2
        assert db.query(BillingPayment).filter_by(billing_id=billing.id).count() == 0
        line_item = db.query(OrderLineItem).filter_by(billings_id=billing.id).one()
        assert line_item.sku == "8"
        assert line_item.description == "מצמנהנצתיטוא"
        assert line_item.price == 221.0
