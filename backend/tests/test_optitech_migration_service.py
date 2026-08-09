from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from backend.services.migration_service import (
    validate_optitech_client_selection,
    validate_versioned_manifest,
)


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


def test_exporter_uses_explicit_allowlists_and_excludes_sensitive_fields():
    script = (
        Path(__file__).parents[2]
        / "docs"
        / "migration_wizzard_doc"
        / "export_optitech_csv.ps1"
    ).read_text(encoding="utf-8")

    assert "$allowedTables" in script
    assert "$allowedColumns" in script
    assert "SELECT *" not in script.upper()
    assert " Salary " not in script
    assert " Password " not in script
    assert " Pass " not in script
    assert 'New-Item -ItemType Directory -Force -Path $documentsDir' in script
    assert "Get-FileHash -Algorithm SHA256" in script
