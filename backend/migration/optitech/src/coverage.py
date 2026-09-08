"""Coverage accounting for every discovered OptiTech source field."""
from __future__ import annotations

from collections import Counter
import csv
import json

from .clinical_cards import ALL_CLINICAL_TABLES, CONTACT_VISIBLE, GLASSES_VISIBLE, IDENTITY, present
from .export_spec import CLINICAL_TABLES as SPEC_CLINICAL_TABLES
from .reader import current_extracts_dir, iter_exported_rows


SUPPORTED_CLINICAL_TABLES = SPEC_CLINICAL_TABLES


def _source_inventory():
    extracts = current_extracts_dir()
    candidates = (extracts.parent / "source-schema.csv", extracts / "source-schema.csv")
    path = next((candidate for candidate in candidates if candidate.exists()), None)
    if path is None:
        return None
    result = {}
    with path.open("r", newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            result.setdefault(row["table"], {})[row["column"]] = row["disposition"]
    return result


def clinical_coverage_report():
    inventory = _source_inventory()
    result = {
        "clinical_mapping_version": 3,
        "coverage_complete": inventory is not None,
        "tables": {},
        "source_schema_inventory": inventory or {},
        "requires_fresh_export": [],
        "unresolved": [],
    }
    for table in SUPPORTED_CLINICAL_TABLES:
        available = any((current_extracts_dir() / f"{table}.{ext}").exists() for ext in ("csv", "tsv"))
        if not available:
            result["requires_fresh_export"].append(table)
            continue
        counts, rows, columns = Counter(), 0, set()
        for row in iter_exported_rows(table):
            rows += 1
            columns.update(row)
            counts.update(key for key, value in row.items() if present(value))
        standard = GLASSES_VISIBLE if table == "tblCrdGlassChecks" else CONTACT_VISIBLE if table == "tblCrdClensChecks" else set()
        dispositions = {}
        for key in sorted(columns):
            if key in IDENTITY:
                destination = "mapped"
            elif key in {"SaleAdd"}:
                destination = "intentionally_excluded"
            elif counts[key] == 0:
                destination = "empty/default-only"
            elif key in standard:
                destination = "mapped"
            else:
                destination = "preserved"
            dispositions[key] = {"nonempty": counts[key], "disposition": destination}
        result["tables"][table] = {"rows": rows, "columns": dispositions}
    if inventory is None:
        result["limitations"] = ["This older bundle has no source schema inventory; coverage is incomplete."]
    else:
        result["limitations"] = []
        known = set(SUPPORTED_CLINICAL_TABLES)
        result["intentionally_excluded_tables"] = sorted(table for table in inventory if table not in known)
    return result
