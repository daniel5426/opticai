"""Strict validation of the OpticPlus typed export, before any target writes."""
from __future__ import annotations

import csv
import hashlib
import json
import math
from itertools import zip_longest
from pathlib import Path
from typing import Any, Iterator
import zipfile
from collections import Counter

SOURCE = "opticplus"
CORE = {"cust_list": ("numw", None), "checks": ("bdikanum", "numw"),
        "adchecks": ("bdikanum", "numw"), "orders": ("rnum", "numw")}
PARENTS = {"person_remarks": "numw", "tb_comp": "wnum", "tb_gnrl_tests": "wnum",
           "tb_quest": "wnum", "proposals": "numw", "tb_date_list": "codel"}
TABLES = set(CORE) | set(PARENTS) | {
    "tb_kabala", "items_sales", "sapakim", "tb_ad_catalog", "tb_catalog", "tb_upd_amount",
    "employees", "presence", "presence_back", "presence_type", "bank_list", "credit_list",
    "tb_hsapakim", "tb_q_checks", "tb_amlot", "tt  telefone  sapakim", "companyn",
    "doc_title", "add_num", "add_order",
}
MAX_BYTES = 4 * 1024**3
MAX_FILES = 10000
csv.field_size_limit(max(csv.field_size_limit(), 1024 * 1024))


def sha256(path: Path) -> str:
    with path.open("rb") as f:
        return hashlib.file_digest(f, "sha256").hexdigest()


def checked_file(root: Path, descriptor: dict, *, require_hash: bool = True) -> Path:
    relative = descriptor.get("file")
    if not isinstance(relative, str) or "\\" in relative or ":" in relative:
        raise ValueError("Invalid OpticPlus file path")
    path = (root / relative).resolve()
    if not path.is_relative_to(root.resolve()) or path == root.resolve() or not path.is_file():
        raise ValueError("Missing or unsafe OpticPlus file")
    expected = descriptor.get("sha256")
    if require_hash and (not isinstance(expected, str) or len(expected) != 64):
        raise ValueError("Missing OpticPlus checksum")
    if expected and sha256(path) != expected:
        raise ValueError("OpticPlus checksum mismatch")
    if descriptor.get("size") is not None and descriptor["size"] != path.stat().st_size:
        raise ValueError("OpticPlus file size mismatch")
    return path


def check_archive(path: Path) -> None:
    with zipfile.ZipFile(path) as archive:
        members = archive.infolist()
        if len(members) > MAX_FILES or sum(m.file_size for m in members) > MAX_BYTES:
            raise ValueError("OpticPlus archive exceeds extraction limits")
        seen = set()
        for m in members:
            name = m.filename.replace("\\", "/").casefold()
            if name in seen or ((m.external_attr >> 16) & 0o170000) == 0o120000:
                raise ValueError("Duplicate or symbolic OpticPlus archive entry")
            seen.add(name)
            if m.file_size > 1024**3 or m.file_size > max(1, m.compress_size) * 2000:
                raise ValueError("OpticPlus archive entry exceeds extraction limits")


def source_id(value: Any) -> str:
    if isinstance(value, bool) or value is None:
        raise ValueError("Missing OpticPlus source key")
    text = str(value).strip()
    if not text.isascii() or not text.isdecimal() or int(text) <= 0 or int(text) > 2147483647:
        raise ValueError("Invalid OpticPlus source key")
    return str(int(text))


def normalized(row: dict) -> dict:
    result = {str(k).casefold(): v for k, v in row.items()}
    if len(result) != len(row):
        raise ValueError("Duplicate case-insensitive OpticPlus column")
    return result


def iter_rows(root: Path, table: dict) -> Iterator[dict]:
    with (root / table["raw_file"]).open(encoding="utf-8-sig") as f:
        while True:
            line = f.readline(16 * 1024 * 1024 + 1)
            if not line: break
            if len(line) > 16 * 1024 * 1024:
                raise ValueError("OpticPlus row exceeds supported size")
            row = json.loads(line)
            if not isinstance(row, dict):
                raise ValueError("Invalid OpticPlus source row")
            yield normalized(row)


def validate_bundle(root: Path, manifest: dict, client_limit: int | None = None) -> dict:
    if manifest.get("source_system") != SOURCE or manifest.get("format_version") != 2 or manifest.get("mapping_version") not in {1, 2}:
        raise ValueError("Unsupported OpticPlus bundle version")
    archive = manifest.get("source_archive") or {}
    if archive.get("complete") is not True or archive.get("sha256") != manifest.get("source_fingerprint"):
        raise ValueError("OpticPlus original database is required")
    checked_file(root, archive)
    schema_path = checked_file(root, manifest.get("source_schema_inventory") or {})
    schema = json.loads(schema_path.read_text(encoding="utf-8-sig"))
    schema_tables = {t["name"].casefold(): t for t in schema.get("tables", [])}
    if len(schema_tables) != len(schema.get("tables", [])):
        raise ValueError("Duplicate OpticPlus schema table")
    selected = [source_id(v) for v in manifest.get("selected_client_ids", [])]
    if len(selected) != len(set(selected)) or (client_limit is not None and len(selected) > client_limit):
        raise ValueError("Invalid OpticPlus patient selection")
    if selected != [source_id(v) for v in schema.get("selected_client_ids", [])]:
        raise ValueError("OpticPlus selection differs from extraction inventory")
    patients, orders, tables, counts, warnings, fields = set(selected), set(), {}, {}, [], {}
    descriptors = manifest.get("tables")
    if not isinstance(descriptors, list):
        raise ValueError("OpticPlus table inventory is required")
    # Validate foundation first even if an archive reorders its descriptors.
    descriptors = sorted(descriptors, key=lambda t: (t.get("name", "").casefold() != "cust_list",
                                                    t.get("name", "").casefold() != "orders"))
    for table in descriptors:
        name = str(table.get("name", "")).casefold()
        if name not in TABLES or name in tables or name not in schema_tables:
            raise ValueError("Unknown or duplicate OpticPlus table")
        tables[name] = table
        csv_path = checked_file(root, {"file": table.get("file"), "sha256": table.get("sha256")})
        raw_path = checked_file(root, {"file": table.get("raw_file"), "sha256": table.get("raw_sha256")})
        if raw_path.suffix != ".jsonl" or csv_path.suffix != ".csv":
            raise ValueError("Invalid OpticPlus table representation")
        schema_columns = {c["name"].casefold() for c in schema_tables[name]["columns"] if c.get("disposition") != "excluded_secret"}
        if name == "add_order" and schema_columns - {"maam", "order_num"}:
            raise ValueError("OpticPlus configuration includes excluded fields")
        seen, n, populated = set(), 0, Counter()
        with csv_path.open(encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            columns = [c.casefold() for c in (reader.fieldnames or [])]
            if len(columns) != len(set(columns)) or set(columns) != schema_columns:
                raise ValueError("OpticPlus columns differ from extraction inventory")
            if name in CORE:
                key, parent = CORE[name]
                required = {key, parent} - {None}
                if name == "cust_list": required |= {"fname", "pname"}
                if not required.issubset(schema_columns):
                    raise ValueError("OpticPlus required source columns are missing")
            for raw, csv_row in zip_longest(iter_rows(root, table), reader):
                if raw is None or csv_row is None:
                    raise ValueError("OpticPlus raw/CSV row count mismatch")
                if set(raw) != schema_columns | {"__date_serials"}:
                    raise ValueError("OpticPlus raw columns differ from extraction inventory")
                serials = normalized(raw["__date_serials"]) if isinstance(raw["__date_serials"], dict) else raw["__date_serials"]
                populated.update(k for k, v in raw.items() if k != "__date_serials" and v not in (None, ""))
                if not isinstance(serials, dict) or any(k not in schema_columns or isinstance(v, bool) or
                    not isinstance(v, (float, int)) or not math.isfinite(v) for k, v in serials.items()):
                    raise ValueError("Invalid OpticPlus date serial representation")
                for col, value in csv_row.items():
                    if col is None or value is None:
                        raise ValueError("Malformed OpticPlus CSV record")
                    original = raw[col.casefold()]
                    expected = "" if original is None else str(original).lower() if isinstance(original, bool) else "[archive_only]" if isinstance(original, dict) else str(original)
                    if expected != value:
                        raise ValueError("OpticPlus raw/CSV value mismatch")
                if name in CORE:
                    key, parent = CORE[name]
                    pk = source_id(raw.get(key))
                    if pk in seen:
                        raise ValueError("Duplicate OpticPlus source key")
                    seen.add(pk)
                    if name == "cust_list" and pk not in patients:
                        raise ValueError("OpticPlus customer outside selection")
                    if parent and source_id(raw.get(parent)) not in patients:
                        raise ValueError("OpticPlus clinical/order row outside selection")
                    if name == "orders":
                        orders.add(pk)
                elif name in PARENTS:
                    parent = raw.get(PARENTS[name])
                    if parent not in (None, "", "0", 0) and source_id(parent) not in patients:
                        raise ValueError("OpticPlus supplemental row outside selection")
                elif name in {"tb_kabala", "items_sales"}:
                    parent = "rnum" if name == "tb_kabala" else "numw"
                    if source_id(raw.get(parent)) not in orders:
                        raise ValueError("OpticPlus payment detail outside selection")
                n += 1
        if name == "cust_list" and seen != patients:
            raise ValueError("OpticPlus selected customers do not match exported customers")
        if n != table.get("row_count") or n != schema_tables[name].get("row_count"):
            raise ValueError("OpticPlus exported row count mismatch")
        if schema_tables[name].get("header_rows") != schema_tables[name].get("enumerated_rows"):
            warnings.append({"code": "header_count_mismatch", "table": name})
        counts[name] = n
        # Every original nonempty value is retained; only verified fields are
        # assigned canonical meanings. Detailed dispositions live in the report.
        canonical = {
            "cust_list": set("numw fname pname zehut bdate min kupa address city mikud sel tel telw fax email cdate remark".split()),
            "orders": set("rnum numw odate gf_price tpay gpay gprice greduce gremk".split()),
            "sapakim": {"shem sapak"}, "tb_ad_catalog": {"hevra", "typ"}, "tb_catalog": {"hevra", "degem"},
        }.get(name, set())
        visible = name in {"checks", "adchecks", "person_remarks", "tb_comp", "tb_gnrl_tests", "tb_quest"}
        fields[name] = {col: {"nonempty_rows": populated[col], "disposition": "canonical_and_source" if col in canonical
            else "visibly_preserved" if visible else "archive_only"} for col in sorted(schema_columns)}
    if not set(CORE).issubset(tables) or not patients:
        raise ValueError("OpticPlus bundle is missing populated core tables")
    if set(tables) != set(schema_tables):
        raise ValueError("OpticPlus bundle omits an inventoried source table")
    for document in (manifest.get("documents") or {}).get("files", []):
        checked_file(root, document)
        if not document["file"].startswith("documents/") or not isinstance(document.get("original_name"), str) or any(c in document["original_name"] for c in "/\\:"):
            raise ValueError("Invalid OpticPlus document name")
        if Path(document["original_name"]).suffix.lower() not in {".pdf", ".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp"}:
            raise ValueError("Unsupported OpticPlus document type")
        if source_id(document.get("client_id")) not in patients:
            raise ValueError("OpticPlus document outside selection")
    return {"manifest": manifest, "tables": tables, "counts": counts, "warnings": warnings,
            "schema": schema, "fields": fields}
