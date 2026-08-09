from __future__ import annotations

from collections import defaultdict
import random
from typing import Any, Dict, Generator, Iterable, Mapping, Optional, Sequence, Set, Tuple

from .reader import EXTRACTS_DIR, iter_exported_rows
from .records import TABLE_PRIMARY_KEYS, parse_intish


TABLES_WITH_PER_ID = {
    "tblPerData": "PerId",
    "tblCrdGlassChecks": "PerId",
    "tblCrdClensChecks": "PerId",
    "tblCrdBuysWorks": "PerId",
    "tblPerPicture": "PerId",
    "tblCrdDiags": "PerId",
    "tblClndrApt": "PerID",
    "tblCrdGlassChecksPrevs": "PerId",
}

DOMAIN_BY_TABLE = {
    "tblPerData": "clients",
    "tblCrdGlassChecks": "glasses_exams",
    "tblCrdClensChecks": "contact_lens_exams",
    "tblCrdBuysWorks": "orders",
    "tblPerPicture": "files",
    "tblCrdDiags": "medical_notes",
    "tblClndrApt": "appointments",
    "tblCrdGlassChecksPrevs": "glasses_exams",
    "tblClndrWrk": "work_shifts",
}


def extract_per_id(table_name: str, row: Mapping[str, Any]) -> Optional[int]:
    field_name = TABLES_WITH_PER_ID.get(table_name)
    if not field_name:
        return None
    return parse_intish(row.get(field_name))


def filter_rows_by_per_ids(
    table_name: str,
    rows: Iterable[Mapping[str, Any]],
    per_ids: Set[int],
) -> Generator[Mapping[str, Any], None, None]:
    for row in rows:
        per_id = extract_per_id(table_name, row)
        if per_id is not None and per_id in per_ids:
            yield row


def filter_records_by_per_ids(records: Iterable[Any], per_ids: Set[int]) -> Generator[Any, None, None]:
    for record in records:
        source_per_id = getattr(record, "source_per_id", None)
        if source_per_id is not None and source_per_id in per_ids:
            yield record


def load_client_per_ids(extracts_dir=EXTRACTS_DIR) -> Sequence[int]:
    per_ids = []
    for row in iter_exported_rows("tblPerData", extracts_dir=extracts_dir):
        per_id = extract_per_id("tblPerData", row)
        if per_id is not None:
            per_ids.append(per_id)
    return sorted(set(per_ids))


def build_pilot_subset_report(
    extracts_dir=EXTRACTS_DIR,
    hand_picked_size: int = 20,
    random_sample_size: int = 100,
    random_seed: int = 42,
) -> Dict[str, Any]:
    client_ids = load_client_per_ids(extracts_dir=extracts_dir)
    coverage: Dict[int, Dict[str, int]] = defaultdict(lambda: defaultdict(int))

    for table_name, domain in DOMAIN_BY_TABLE.items():
        for row in iter_exported_rows(table_name, extracts_dir=extracts_dir):
            per_id = extract_per_id(table_name, row)
            if per_id is not None:
                coverage[per_id][domain] += 1

    ranked = []
    for per_id in client_ids:
        domain_counts = coverage.get(per_id, {})
        domain_presence = sum(1 for count in domain_counts.values() if count > 0)
        total_rows = sum(domain_counts.values())
        ranked.append((domain_presence, total_rows, per_id))
    ranked.sort(key=lambda item: (-item[0], -item[1], item[2]))

    hand_picked = [per_id for _, _, per_id in ranked[:hand_picked_size]]
    rng = random.Random(random_seed)
    random_pick_count = min(random_sample_size, len(client_ids))
    random_sample = sorted(rng.sample(client_ids, random_pick_count)) if random_pick_count else []

    hand_picked_details = [
        {
            "per_id": per_id,
            "domains": dict(sorted(coverage.get(per_id, {}).items())),
            "domain_count": sum(1 for count in coverage.get(per_id, {}).values() if count > 0),
            "row_count": sum(coverage.get(per_id, {}).values()),
        }
        for per_id in hand_picked
    ]

    return {
        "strategy": {
            "hand_picked": "top patients by cross-domain coverage and total row count",
            "random": f"deterministic random sample with seed={random_seed}",
        },
        "hand_picked_per_ids": hand_picked,
        "hand_picked_details": hand_picked_details,
        "random_per_ids": random_sample,
        "population_size": len(client_ids),
        "random_sample_size": len(random_sample),
    }
