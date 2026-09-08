from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from backend.services.migration_service import (
    validate_optitech_client_selection,
    validate_versioned_manifest,
    validate_optitech_manifest_version,
)
from backend.EndPoints import migration as migration_endpoint


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_v2_manifest_validates_table_and_document_hashes(tmp_path):
    tables = tmp_path / "tables"
    documents = tmp_path / "documents"
    tables.mkdir()
    documents.mkdir()
    clients = tables / "tblPerData.csv"
    clients.write_text("PerId,FirstName\n1,A\n2,B\n", encoding="utf-8")
    scan = documents / "scan.jpg"
    scan.write_bytes(b"scan")
    manifest = {
        "source_system": "optitech",
        "format_version": 2,
        "mapping_version": 2,
        "selected_client_ids": [1, 2],
        "tables": [
            {
                "name": "tblPerData",
                "file": "tables/tblPerData.csv",
                "row_count": 2,
                "sha256": _sha256(clients),
            }
        ],
        "documents": {
            "root": "documents",
            "files": [
                {
                    "file": "documents/scan.jpg",
                    "size": 4,
                    "sha256": _sha256(scan),
                }
            ],
        },
    }
    (tmp_path / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")

    assert validate_versioned_manifest(tmp_path, "optitech")["mapping_version"] == 2
    assert validate_optitech_client_selection(tables, manifest, client_limit=2) == {1, 2}

    scan.write_bytes(b"changed")
    with pytest.raises(RuntimeError, match="document checksum mismatch"):
        validate_versioned_manifest(tmp_path, "optitech")


def test_v2_manifest_accepts_legacy_physical_line_row_counts(tmp_path):
    tables = tmp_path / "tables"
    tables.mkdir()
    clients = tables / "tblPerData.csv"
    clients.write_bytes(b'PerId,Comment\r\n1,"first line\r\nsecond line"\r\n')
    manifest = {
        "source_system": "optitech",
        "format_version": 2,
        "mapping_version": 2,
        # The old Electron counter counted the quoted line break as a row.
        "tables": [{
            "name": "tblPerData",
            "file": "tables/tblPerData.csv",
            "row_count": 2,
            "sha256": _sha256(clients),
        }],
    }
    (tmp_path / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")

    assert validate_versioned_manifest(tmp_path, "optitech")["mapping_version"] == 2


def test_v3_manifest_validates_retained_original_database(tmp_path):
    source_dir = tmp_path / "source"
    source_dir.mkdir()
    source = source_dir / "optData.xns"
    source.write_bytes(b"complete original database")
    fingerprint = _sha256(source)
    manifest = {
        "source_system": "optitech",
        "format_version": 2,
        "mapping_version": 3,
        "source_fingerprint": fingerprint,
        "source_archive": {
            "file": "source/optData.xns",
            "kind": "original_database",
            "complete": True,
            "size": source.stat().st_size,
            "sha256": fingerprint,
        },
        "tables": [],
    }
    (tmp_path / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")

    assert validate_versioned_manifest(tmp_path, "optitech")["source_archive"]["complete"] is True

    source.write_bytes(b"tampered")
    with pytest.raises(RuntimeError, match="source archive size mismatch"):
        validate_versioned_manifest(tmp_path, "optitech")


@pytest.mark.parametrize("mapping_version", [2, 3])
def test_import_service_accepts_supported_optitech_mapping_versions(mapping_version):
    validate_optitech_manifest_version({"format_version": 2, "mapping_version": mapping_version})


@pytest.mark.parametrize("mapping_version", [None, 1, 4, "3"])
def test_import_service_rejects_unsupported_optitech_mapping_versions(mapping_version):
    with pytest.raises(RuntimeError, match="mapping_version 2 or 3"):
        validate_optitech_manifest_version({"format_version": 2, "mapping_version": mapping_version})


def test_client_selection_rejects_dependent_rows_outside_limit(tmp_path):
    (tmp_path / "tblPerData.csv").write_text("PerId\n1\n", encoding="utf-8")
    (tmp_path / "tblCrdGlassChecks.csv").write_text(
        "PerId,CheckDate\n2,2026-01-01\n",
        encoding="utf-8",
    )

    with pytest.raises(RuntimeError, match="outside the selected import set"):
        validate_optitech_client_selection(
            tmp_path,
            {"selected_client_ids": [1]},
            client_limit=1,
        )


def test_client_selection_accepts_legacy_unsorted_manifest_ids(tmp_path):
    (tmp_path / "tblPerData.csv").write_text("PerId\n2\n1\n", encoding="utf-8")

    assert validate_optitech_client_selection(
        tmp_path,
        {"selected_client_ids": [2, 1]},
        client_limit=None,
    ) == {1, 2}


def test_native_exporter_uses_explicit_allowlists_and_excludes_sensitive_fields():
    reader = (
        Path(__file__).parents[2]
        / "native"
        / "optitech-mdb-exporter"
        / "main.c"
    ).read_text(encoding="utf-8")
    plan = (
        Path(__file__).parents[2]
        / "backend"
        / "migration"
        / "optitech"
        / "export-plan.h"
    ).read_text(encoding="utf-8")

    assert "#include <mdbtools.h>" in reader
    assert "mdb_open" in reader
    assert "EXPORT_PLAN" in reader
    assert "tblPerData" in plan
    assert "tblCrdGlassChecks" in plan
    assert " Salary " not in plan
    assert " Password " not in plan
    assert " Pass " not in plan
    assert "Microsoft.Jet" not in reader
    assert "Microsoft.ACE" not in reader


def test_source_archive_download_uses_scoped_retained_bundle(monkeypatch):
    class Storage:
        def __init__(self):
            self.calls = []

        def exists(self, bucket, key):
            return True

        def create_signed_url(self, bucket, key, expires_in):
            self.calls.append((bucket, key, expires_in))
            return "https://storage.example/signed"

    job = type("Job", (), {
        "id": "job-1",
        "source_system": "optitech",
        "bundle_storage_bucket": "private-migrations",
        "bundle_storage_key": "clinics/1/optitech-migrations/job-1/bundle.zip",
        "validation_summary": {"manifest": {"source_archive": {"complete": True, "sha256": "abc"}}},
    })()
    monkeypatch.setattr(migration_endpoint, "_get_job", lambda db, current_user, job_id: job)
    storage = Storage()

    result = migration_endpoint.download_source_archive(
        "job-1", db=object(), current_user=object(), storage=storage,
    )

    assert result["url"] == "https://storage.example/signed"
    assert result["sha256"] == "abc"
    assert storage.calls == [("private-migrations", "clinics/1/optitech-migrations/job-1/bundle.zip", 900)]


def test_windows_native_reader_build_requires_iconv_for_unicode_text():
    build_script = (
        Path(__file__).parents[2]
        / "scripts"
        / "build-optitech-reader.sh"
    ).read_text(encoding="utf-8")

    assert "-liconv" in build_script
    assert "-DHAVE_ICONV" in build_script
    assert "#define MDBTOOLS_H_HAVE_ICONV_H 1" in build_script
