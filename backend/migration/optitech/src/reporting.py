from __future__ import annotations

from dataclasses import asdict, is_dataclass
from datetime import date, datetime
import json
from pathlib import Path
from typing import Any, Iterable, Mapping, MutableMapping, Sequence


def _json_default(value: Any) -> Any:
    if is_dataclass(value):
        return asdict(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Path):
        return str(value)
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def write_json_report(path: Path, payload: Any) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=False, default=_json_default)
        + "\n",
        encoding="utf-8",
    )
    return path


def build_missing_dependency_report(
    domain: str,
    dependency_name: str,
    missing_values: Sequence[Any],
) -> Mapping[str, Any]:
    unique_sorted = sorted({str(value) for value in missing_values if value not in (None, "")})
    return {
        "domain": domain,
        "dependency_name": dependency_name,
        "missing_count": len(unique_sorted),
        "missing_values": unique_sorted,
    }


def build_skipped_rows_report(
    domain: str,
    skipped_rows: Sequence[Mapping[str, Any]],
) -> Mapping[str, Any]:
    return {
        "domain": domain,
        "skipped_count": len(skipped_rows),
        "skipped_rows": list(skipped_rows),
    }

