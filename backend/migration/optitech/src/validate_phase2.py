from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Mapping

from .reader import WORKSPACE_ROOT
from .reporting import write_json_report


DEFAULT_REPORT_DIR = WORKSPACE_ROOT / "artifacts" / "reports" / "phase2"
UNMAPPED_SAMPLE_LIMIT = 25


def default_report_dir() -> Path:
    return DEFAULT_REPORT_DIR


def create_unmapped_field_report() -> Dict[str, Dict[str, Dict[str, Any]]]:
    return {}


def record_unmapped_values(
    report: Dict[str, Dict[str, Dict[str, Any]]],
    *,
    domain: str,
    values: Mapping[str, Any],
) -> None:
    domain_bucket = report.setdefault(domain, {})
    for field_name, value in values.items():
        if value is None or value == "":
            continue
        bucket = domain_bucket.setdefault(
            field_name,
            {
                "non_null_count": 0,
                "samples": [],
                "_seen": set(),
            },
        )
        bucket["non_null_count"] += 1
        sample_value = _stringify_value(value)
        if sample_value not in bucket["_seen"] and len(bucket["samples"]) < UNMAPPED_SAMPLE_LIMIT:
            bucket["_seen"].add(sample_value)
            bucket["samples"].append(sample_value)


def finalize_unmapped_field_report(
    report: Dict[str, Dict[str, Dict[str, Any]]],
) -> Dict[str, Dict[str, Dict[str, Any]]]:
    finalized: Dict[str, Dict[str, Dict[str, Any]]] = {}
    for domain, fields in report.items():
        finalized[domain] = {}
        for field_name, bucket in fields.items():
            finalized[domain][field_name] = {
                "non_null_count": bucket["non_null_count"],
                "samples": list(bucket["samples"]),
            }
    return finalized


def write_phase2_reports(
    *,
    report_dir: Path,
    summary: Mapping[str, Any],
    skipped_rows: Any,
    family_summary: Mapping[str, Any],
    user_username_map: Any,
    unmapped_source_fields: Mapping[str, Any],
) -> Dict[str, Path]:
    return {
        "summary": write_json_report(report_dir / "summary.json", summary),
        "skipped_rows": write_json_report(report_dir / "skipped_rows.json", skipped_rows),
        "family_summary": write_json_report(report_dir / "family_summary.json", family_summary),
        "user_username_map": write_json_report(report_dir / "user_username_map.json", user_username_map),
        "unmapped_source_fields": write_json_report(
            report_dir / "unmapped_source_fields.json",
            unmapped_source_fields,
        ),
    }


def _stringify_value(value: Any) -> str:
    if isinstance(value, (dict, list, tuple)):
        return json.dumps(value, ensure_ascii=False, sort_keys=True)
    return str(value)
