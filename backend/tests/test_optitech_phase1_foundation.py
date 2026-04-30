from pathlib import Path

from backend.migration.optitech.src import inventory, subset
from backend.migration.optitech.src import reader, records


def test_primary_key_extraction_for_known_tables():
    source_ref = records.build_source_ref(
        "tblCrdGlassChecks",
        {"PerId": "102", "CheckDate": "2000-11-26 00:00:00"},
    )

    assert source_ref.table_name == "tblCrdGlassChecks"
    assert source_ref.primary_key_parts == (
        ("PerId", "102"),
        ("CheckDate", "2000-11-26 00:00:00"),
    )


def test_typed_parsers_handle_access_values():
    assert records.parse_intish("65.0") == 65
    assert records.parse_floatish("7.50") == 7.5
    assert records.parse_boolish("-1") is True
    assert records.parse_boolish("0") is False
    assert records.parse_optical_float("Plano ") == 0.0
    assert records.parse_optical_float("-1.25") == -1.25
    assert records.parse_access_date("11/26/00 00:00:00").isoformat() == "2000-11-26"
    assert records.parse_access_time("12/30/99 22:15:00") == "22:15:00"


def test_export_table_to_tsv_writes_utf8(monkeypatch, tmp_path):
    monkeypatch.setattr(reader, "export_table_text", lambda table_name, source_db=reader.SOURCE_DB_PATH: "a\tb\n1\t2\n")

    output_path = tmp_path / "tblPerData.tsv"
    written = reader.export_table_to_tsv("tblPerData", output_path)

    assert written == output_path
    assert output_path.read_text(encoding="utf-8") == "a\tb\n1\t2\n"


def test_iter_tsv_rows_parses_tab_delimited_file(tmp_path):
    path = tmp_path / "rows.tsv"
    path.write_text("PerId\tFirstName\n1\tYossi\n", encoding="utf-8")

    rows = list(reader.iter_tsv_rows(path))

    assert rows == [{"PerId": "1", "FirstName": "Yossi"}]


def test_parse_schema_columns_extracts_names_and_types():
    schema = """
CREATE TABLE `tblPerData`
 (
\t`PerId`\t\t\tINTEGER NOT NULL,
\t`LastName`\t\t\tvarchar,
\t`Comment`\t\t\tTEXT
);
"""
    columns = inventory.parse_schema_columns(schema)

    assert columns == [
        {"name": "PerId", "type": "INTEGER", "constraints": " NOT NULL,".rstrip(" ,")},
        {"name": "LastName", "type": "varchar", "constraints": ""},
        {"name": "Comment", "type": "TEXT", "constraints": ""},
    ]


def test_subset_filters_rows_by_per_id():
    rows = [
        {"PerId": "1", "FirstName": "A"},
        {"PerId": "2", "FirstName": "B"},
    ]

    filtered = list(subset.filter_rows_by_per_ids("tblPerData", rows, {2}))

    assert filtered == [{"PerId": "2", "FirstName": "B"}]


def test_build_pilot_subset_report_is_deterministic(tmp_path):
    extracts_dir = tmp_path / "extracts"
    extracts_dir.mkdir()
    (extracts_dir / "tblPerData.tsv").write_text(
        "PerId\tFirstName\n1\tA\n2\tB\n3\tC\n",
        encoding="utf-8",
    )
    (extracts_dir / "tblCrdGlassChecks.tsv").write_text(
        "PerId\tCheckDate\n1\t2000-01-01\n1\t2001-01-01\n2\t2002-01-01\n",
        encoding="utf-8",
    )
    (extracts_dir / "tblCrdClensChecks.tsv").write_text(
        "PerId\tCheckDate\n1\t2000-01-01\n3\t2003-01-01\n",
        encoding="utf-8",
    )
    (extracts_dir / "tblCrdBuysWorks.tsv").write_text(
        "PerId\tWorkId\n1\t10\n",
        encoding="utf-8",
    )
    (extracts_dir / "tblPerPicture.tsv").write_text(
        "PerId\tPerPicId\n2\t100\n",
        encoding="utf-8",
    )
    (extracts_dir / "tblCrdDiags.tsv").write_text(
        "PerId\tCheckDate\n3\t2004-01-01\n",
        encoding="utf-8",
    )
    (extracts_dir / "tblClndrApt.tsv").write_text(
        "PerID\tAptNum\n2\t1\n",
        encoding="utf-8",
    )

    report = subset.build_pilot_subset_report(
        extracts_dir=extracts_dir,
        hand_picked_size=2,
        random_sample_size=2,
        random_seed=7,
    )

    assert report["hand_picked_per_ids"] == [1, 2]
    assert report["random_per_ids"] == [1, 2]


def test_source_ref_is_preserved_through_normalization():
    record = records.normalize_medical_note_row(
        {
            "PerId": "3211",
            "CheckDate": "07/12/01 00:00:00",
            "UserId": "226",
            "Complaints": "Headaches",
        }
    )

    assert record.source_ref.table_name == "tblCrdDiags"
    assert record.source_per_id == 3211
    assert record.source_user_id == 226


def test_normalized_file_seed_resolves_scan_path(tmp_path):
    scans_dir = tmp_path / "Scans"
    scans_dir.mkdir()
    scan_path = scans_dir / "16069_2012729175921.jpg"
    scan_path.write_bytes(b"img")

    record = records.normalize_file_row(
        {
            "PerPicId": "1",
            "PerId": "16069",
            "PicFileName": "16069_2012729175921.jpg",
            "Description": "Scan",
            "ScanDate": "07/29/12 17:59:21",
        },
        scans_dir=scans_dir,
    )

    assert record.scan_exists is True
    assert record.scan_path == str(scan_path)


def test_sparse_domains_normalize_without_breaking():
    appointment = records.normalize_appointment_row(
        {
            "AptNum": "1",
            "AptDate": "03/25/06 00:00:00",
            "StarTime": "12/30/99 22:00:00",
            "EndTime": "12/30/99 22:15:00",
            "PerID": "0",
            "UserID": "0",
            "TookPlace": "0",
            "Reminder": "-1",
        }
    )
    medical = records.normalize_medical_note_row(
        {
            "PerId": "6493",
            "CheckDate": "10/11/01 00:00:00",
            "UserId": "206",
        }
    )

    assert appointment.legacy_appointment_id == 1
    assert appointment.reminder is True
    assert medical.source_per_id == 6493
