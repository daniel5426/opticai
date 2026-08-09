from __future__ import annotations

from dataclasses import asdict, is_dataclass
from pathlib import Path
import re
from typing import Any, Dict, Iterable, List, Mapping, Sequence

from .reader import (
    EXTRACTS_DIR,
    SCANS_DIR,
    SOURCE_DB_PATH,
    WORKSPACE_ROOT,
    count_scan_files,
    count_table,
    describe_table,
    export_tables,
)
from .reporting import write_json_report
from .subset import build_pilot_subset_report


CORE_TABLES: Sequence[str] = (
    "tblPerData",
    "tblUsers",
    "tblCrdGlassChecks",
    "tblCrdClensChecks",
    "tblCrdBuysWorks",
    "tblPerPicture",
    "tblCrdDiags",
    "tblClndrApt",
    "tblCrdGlassChecksPrevs",
    "tblClndrWrk",
)

LOOKUP_TABLES: Sequence[str] = (
    "tblCitys",
    "tblRefs",
    "tblRefsSub1",
    "tblRefsSub2",
    "tblCrdGlassBrand",
    "tblCrdGlassCoat",
    "tblCrdGlassColor",
    "tblCrdGlassMater",
    "tblCrdGlassModel",
    "tblCrdGlassRole",
    "tblCrdClensBrands",
    "tblCrdClensManuf",
    "tblCrdClensTypes",
    "tblCrdClensSolClean",
    "tblCrdClensSolDisinfect",
    "tblCrdClensSolRinse",
    "tblCrdBuysWorkTypes",
    "tblCrdBuysWorkStats",
    "tblCrdBuysWorkSupply",
    "tblCrdBuysWorkLabs",
    "tblCrdBuysWorkSapaks",
    "tblCrdBuysWorkLabels",
    "tblCrdClensChecksMater",
    "tblCrdClensChecksTint",
    "tblCrdClensChecksPr",
)

FOUNDATION_MAPPING: Mapping[str, Mapping[str, Any]] = {
    "tblPerData": {
        "normalized_record": "NormalizedClientSeed",
        "primary_key": ["PerId"],
        "subset_identity_field": "PerId",
        "lookup_dependencies": ["tblDiscounts", "tblGroups", "tblRefs", "tblRefsSub1", "tblRefsSub2"],
    },
    "tblUsers": {
        "normalized_record": "NormalizedUserSeed",
        "primary_key": ["UserId"],
        "subset_identity_field": None,
        "lookup_dependencies": [],
    },
    "tblCrdGlassChecks": {
        "normalized_record": "NormalizedGlassesExamSeed",
        "primary_key": ["PerId", "CheckDate"],
        "subset_identity_field": "PerId",
        "lookup_dependencies": [
            "tblCrdGlassBrand",
            "tblCrdGlassCoat",
            "tblCrdGlassColor",
            "tblCrdGlassMater",
            "tblCrdGlassModel",
            "tblCrdGlassRole",
        ],
    },
    "tblCrdClensChecks": {
        "normalized_record": "NormalizedContactLensExamSeed",
        "primary_key": ["PerId", "CheckDate"],
        "subset_identity_field": "PerId",
        "lookup_dependencies": [
            "tblCrdClensBrands",
            "tblCrdClensManuf",
            "tblCrdClensTypes",
            "tblCrdClensSolClean",
            "tblCrdClensSolDisinfect",
            "tblCrdClensSolRinse",
            "tblCrdClensChecksMater",
            "tblCrdClensChecksTint",
            "tblCrdClensChecksPr",
        ],
    },
    "tblCrdBuysWorks": {
        "normalized_record": "NormalizedOrderSeed",
        "primary_key": ["WorkId"],
        "subset_identity_field": "PerId",
        "lookup_dependencies": [
            "tblCrdBuysWorkTypes",
            "tblCrdBuysWorkStats",
            "tblCrdBuysWorkSupply",
            "tblCrdBuysWorkLabs",
            "tblCrdBuysWorkSapaks",
            "tblCrdBuysWorkLabels",
            "tblCrdGlassBrand",
            "tblCrdGlassCoat",
            "tblCrdGlassColor",
            "tblCrdGlassMater",
            "tblCrdGlassModel",
            "tblCrdGlassRole",
        ],
    },
    "tblPerPicture": {
        "normalized_record": "NormalizedFileSeed",
        "primary_key": ["PerPicId"],
        "subset_identity_field": "PerId",
        "lookup_dependencies": [],
    },
    "tblCrdDiags": {
        "normalized_record": "NormalizedMedicalNoteSeed",
        "primary_key": ["PerId", "CheckDate"],
        "subset_identity_field": "PerId",
        "lookup_dependencies": [],
    },
    "tblClndrApt": {
        "normalized_record": "NormalizedAppointmentSeed",
        "primary_key": ["AptNum"],
        "subset_identity_field": "PerID",
        "lookup_dependencies": [],
    },
    "tblCrdGlassChecksPrevs": {
        "normalized_record": "PreviousRefractionTabs",
        "primary_key": ["PerId", "CheckDate", "PrevId"],
        "subset_identity_field": "PerId",
        "lookup_dependencies": [],
    },
    "tblClndrWrk": {
        "normalized_record": "NormalizedWorkShiftSeed",
        "primary_key": ["WrkId"],
        "subset_identity_field": None,
        "lookup_dependencies": ["tblUsers"],
    },
}


def parse_schema_columns(schema_sql: str) -> List[Dict[str, Any]]:
    columns: List[Dict[str, Any]] = []
    column_pattern = re.compile(r"^\s*`(?P<name>[^`]+)`\s+(?P<type>[A-Za-z0-9()]+)(?P<constraints>.*)$")
    for line in schema_sql.splitlines():
        match = column_pattern.match(line)
        if not match:
            continue
        columns.append(
            {
                "name": match.group("name"),
                "type": match.group("type"),
                "constraints": match.group("constraints").rstrip(" ,"),
            }
        )
    return columns


def collect_source_counts(
    source_db: Path = SOURCE_DB_PATH,
    core_tables: Sequence[str] = CORE_TABLES,
    lookup_tables: Sequence[str] = LOOKUP_TABLES,
) -> Dict[str, Any]:
    tables = list(core_tables) + list(lookup_tables)
    return {
        "source_db": str(source_db),
        "core_tables": {table_name: count_table(table_name, source_db=source_db) for table_name in core_tables},
        "lookup_tables": {table_name: count_table(table_name, source_db=source_db) for table_name in lookup_tables},
        "scans_count": count_scan_files(SCANS_DIR),
    }


def build_source_inventory(
    exported_paths: Mapping[str, Path],
    source_db: Path = SOURCE_DB_PATH,
    core_tables: Sequence[str] = CORE_TABLES,
) -> Dict[str, Any]:
    inventory_tables = {}
    for table_name in core_tables:
        schema_sql = describe_table(table_name, source_db=source_db)
        inventory_tables[table_name] = {
            "table_name": table_name,
            "count": count_table(table_name, source_db=source_db),
            "extract_path": str(exported_paths[table_name]),
            "schema_sql": schema_sql,
            "columns": parse_schema_columns(schema_sql),
            **FOUNDATION_MAPPING[table_name],
        }
    return {
        "source_db": str(source_db),
        "source_type": "access-jet4",
        "single_clinic_source": True,
        "core_tables": inventory_tables,
        "scans_dir": str(SCANS_DIR),
        "scans_count": count_scan_files(SCANS_DIR),
    }


def build_lookup_inventory(
    exported_paths: Mapping[str, Path],
    source_db: Path = SOURCE_DB_PATH,
    lookup_tables: Sequence[str] = LOOKUP_TABLES,
) -> Dict[str, Any]:
    lookup_info = {}
    for table_name in lookup_tables:
        schema_sql = describe_table(table_name, source_db=source_db)
        lookup_info[table_name] = {
            "table_name": table_name,
            "count": count_table(table_name, source_db=source_db),
            "extract_path": str(exported_paths[table_name]),
            "schema_sql": schema_sql,
            "columns": parse_schema_columns(schema_sql),
        }
    return {
        "source_db": str(source_db),
        "lookup_tables": lookup_info,
    }


def build_phase1_foundation(
    source_db: Path = SOURCE_DB_PATH,
    workspace_root: Path = WORKSPACE_ROOT,
) -> Dict[str, Path]:
    extracts_dir = workspace_root / "artifacts" / "extracts"
    reports_dir = workspace_root / "artifacts" / "reports"
    tables_to_export = list(CORE_TABLES) + list(LOOKUP_TABLES)
    exported_paths = export_tables(tables_to_export, extracts_dir=extracts_dir, source_db=source_db)

    source_counts = collect_source_counts(source_db=source_db)
    source_inventory = build_source_inventory(exported_paths=exported_paths, source_db=source_db)
    lookup_inventory = build_lookup_inventory(exported_paths=exported_paths, source_db=source_db)
    pilot_subset_report = build_pilot_subset_report(extracts_dir=extracts_dir)

    paths = {
        "source_counts": write_json_report(reports_dir / "source_counts.json", source_counts),
        "source_inventory": write_json_report(reports_dir / "source_inventory.json", source_inventory),
        "lookup_inventory": write_json_report(reports_dir / "lookup_inventory.json", lookup_inventory),
        "pilot_subset_report": write_json_report(
            reports_dir / "pilot_subset_report.json",
            pilot_subset_report,
        ),
    }
    return paths


if __name__ == "__main__":
    generated = build_phase1_foundation()
    for name, path in generated.items():
        print(f"{name}: {path}")
