from __future__ import annotations

from pathlib import Path
from typing import Dict, Mapping, Optional

from .inventory import LOOKUP_TABLES
from .reader import (
    EXTRACTS_DIR,
    SOURCE_DB_PATH,
    bundle_paths_active,
    current_extracts_dir,
    export_tables,
    iter_exported_rows,
)
from .records import clean_text, parse_intish


LOOKUP_NAME_COLUMNS: Mapping[str, str] = {
    "tblCitys": "CityName",
    "tblRefs": "RefName",
    "tblRefsSub1": "RefsSub1Name",
    "tblRefsSub2": "RefsSub2Name",
    "tblCrdGlassBrand": "GlassBrandName",
    "tblCrdGlassCoat": "GlassCoatName",
    "tblCrdGlassColor": "GlassColorName",
    "tblCrdGlassMater": "GlassMaterName",
    "tblCrdGlassModel": "GlassModelName",
    "tblCrdGlassRole": "GlassRoleName",
    "tblCrdClensBrands": "ClensBrandName",
    "tblCrdClensManuf": "ClensManufName",
    "tblCrdClensTypes": "ClensTypeName",
    "tblCrdClensSolClean": "ClensSolCleanName",
    "tblCrdClensSolDisinfect": "ClensSolDisinfectName",
    "tblCrdClensSolRinse": "ClensSolRinseName",
    "tblCrdBuysWorkTypes": "WorkTypeName",
    "tblCrdBuysWorkStats": "WorkStatName",
    "tblCrdBuysWorkSupply": "WorkSupplyName",
    "tblCrdBuysWorkLabs": "LabName",
    "tblCrdBuysWorkSapaks": "SapakName",
    "tblCrdBuysWorkLabels": "LabelName",
    "tblCrdClensChecksMater": "MaterName",
    "tblCrdClensChecksTint": "TintName",
    "tblCrdClensChecksPr": "PrName",
}

LOOKUP_ID_COLUMNS: Mapping[str, str] = {
    "tblCitys": "CityId",
    "tblRefs": "RefId",
    "tblRefsSub1": "RefsSub1Id",
    "tblRefsSub2": "RefsSub2Id",
    "tblCrdGlassBrand": "GlassBrandId",
    "tblCrdGlassCoat": "GlassCoatId",
    "tblCrdGlassColor": "GlassColorId",
    "tblCrdGlassMater": "GlassMaterId",
    "tblCrdGlassModel": "GlassModelId",
    "tblCrdGlassRole": "GlassRoleId",
    "tblCrdClensBrands": "ClensBrandId",
    "tblCrdClensManuf": "ClensManufId",
    "tblCrdClensTypes": "ClensTypeId",
    "tblCrdClensSolClean": "ClensSolCleanId",
    "tblCrdClensSolDisinfect": "ClensSolDisinfectId",
    "tblCrdClensSolRinse": "ClensSolRinseId",
    "tblCrdBuysWorkTypes": "WorkTypeId",
    "tblCrdBuysWorkStats": "WorkStatId",
    "tblCrdBuysWorkSupply": "WorkSupplyId",
    "tblCrdBuysWorkLabs": "LabID",
    "tblCrdBuysWorkSapaks": "SapakID",
    "tblCrdBuysWorkLabels": "LabelId",
    "tblCrdClensChecksMater": "MaterId",
    "tblCrdClensChecksTint": "TintId",
    "tblCrdClensChecksPr": "PrId",
}

NULL_LOOKUP_NAMES = {"[ללא]"}


LookupCatalog = Dict[str, Dict[int, Optional[str]]]


def ensure_lookup_extracts(
    *,
    extracts_dir: Optional[Path] = None,
    source_db: Path = SOURCE_DB_PATH,
) -> Dict[str, Path]:
    extracts_dir = extracts_dir or current_extracts_dir()
    missing_tables = [
        table_name
        for table_name in LOOKUP_TABLES
        if not (extracts_dir / f"{table_name}.tsv").exists()
        and not (extracts_dir / f"{table_name}.csv").exists()
    ]
    exported: Dict[str, Path] = {}
    if missing_tables and not bundle_paths_active():
        exported.update(export_tables(missing_tables, extracts_dir=extracts_dir, source_db=source_db))
    for table_name in LOOKUP_TABLES:
        csv_path = extracts_dir / f"{table_name}.csv"
        exported.setdefault(
            table_name,
            csv_path if csv_path.exists() else extracts_dir / f"{table_name}.tsv",
        )
    return exported


def load_lookup_catalog(*, extracts_dir: Optional[Path] = None) -> LookupCatalog:
    extracts_dir = extracts_dir or current_extracts_dir()
    catalog: LookupCatalog = {}
    for table_name in LOOKUP_TABLES:
        key_column = LOOKUP_ID_COLUMNS[table_name]
        value_column = LOOKUP_NAME_COLUMNS[table_name]
        bucket: Dict[int, Optional[str]] = {}
        for row in iter_exported_rows(table_name, extracts_dir=extracts_dir):
            key = parse_intish(row.get(key_column))
            if key is None:
                continue
            bucket[key] = normalize_lookup_name(row.get(value_column))
        catalog[table_name] = bucket
    return catalog


def normalize_lookup_name(value: object) -> Optional[str]:
    text = clean_text(value)
    if text is None:
        return None
    if text in NULL_LOOKUP_NAMES:
        return None
    return text


def lookup_name(catalog: LookupCatalog, table_name: str, key: Optional[int]) -> Optional[str]:
    if key is None:
        return None
    return catalog.get(table_name, {}).get(key)
