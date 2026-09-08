"""Read the shared native/PowerShell/backend OptiTech export specification."""
from __future__ import annotations

from pathlib import Path
import re


EXPORT_PLAN_PATH = Path(__file__).resolve().parents[1] / "export-plan.h"
_SOURCE = EXPORT_PLAN_PATH.read_text(encoding="utf-8")


def _string_array(name: str) -> tuple[str, ...]:
    match = re.search(rf"static const char \*{name}\[\] = \{{(.*?)\}};", _SOURCE, re.S)
    if not match:
        raise RuntimeError(f"Shared OptiTech export specification is missing {name}")
    return tuple(re.findall(r'"([^"]+)"', match.group(1)))


TABLE_PLANS = {
    table: {
        "columns": tuple(columns.split()),
        "client_column": client if client != "NULL" else None,
    }
    for table, columns, client, quoted_client in re.findall(
        r'\{"([^"]+)",\s*"([^"]*)",\s*(NULL|"([^"]*)")\}', _SOURCE
    )
    if table
    for client in (quoted_client or client,)
}
CLINICAL_TABLES = _string_array("CLINICAL_TABLES")
LOOKUP_TABLES = _string_array("LOOKUP_TABLES")
CLIENT_DEPENDENT_TABLES = {
    table: plan["client_column"]
    for table, plan in TABLE_PLANS.items()
    if plan["client_column"] and not str(plan["client_column"]).startswith("@")
}
