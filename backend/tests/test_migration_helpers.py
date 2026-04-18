import csv
import json

from backend.migration import migrate_csv_to_postgres as migration


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


def test_build_exam_data_uses_current_keys():
    row = {
        "or_right_sph": "'-0150'",
        "or_left_sph": "'-0100'",
        "or_right_cyl": "'-0050'",
        "or_left_cyl": "'-0025'",
        "or_right_ax": "174",
        "or_left_ax": "12",
        "bino_ct_fv_exo_p": "4",
        "bio_r_lach": "stable",
    }

    exam_data = migration.build_exam_data_from_eye_tests(row, None)

    assert "old-refraction-old-refraction-1-legacy" in exam_data
    assert exam_data["old-refraction-old-refraction-1-legacy"]["card_id"] == "old-refraction-1"
    assert "cover-test-cover-test-1-legacy" in exam_data
    assert exam_data["cover-test-cover-test-1-legacy"]["card_id"] == "cover-test-1"
    assert "sensation-vision-stability-sensation-vision-stability-1" in exam_data


def test_default_layout_contains_expected_cards():
    layout = json.loads(migration.build_default_migrated_layout_data())
    card_ids = [card["id"] for row in layout["rows"] for card in row["cards"]]
    assert "old-refraction-1" in card_ids
    assert "sensation-vision-stability-1" in card_ids


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
