"""Read imported SoftOptic glasses orders' prescriptions the way OpticSoft shows them.

Older imports lost a "Balan" (Balance) SPH, read "+225 " as 2.25 instead of 22.50, kept OpticSoft's
prism base as typed ("Down", "in") where Prysm's base field lists IN/OUT/UP/DOWN, and read a lens
diameter "3444" (34/44) as a number without putting it on the lens. They also dropped the near PD
(pd_near), which most of these orders carry. A value is changed only while
it still equals what the older import stored, so anything edited since the import is left alone.

Dry run by default; pass --apply to write.

    cd backend && .venv/bin/python -m scripts.backfill_softoptic_order_prescription --job-id <job>
"""
from __future__ import annotations

import argparse
import copy
from collections import Counter
from typing import Any, Dict, List, Tuple

from sqlalchemy.orm.attributes import flag_modified

from database import SessionLocal
from migration.pipeline.common import (
    clean_legacy_text,
    parse_float,
    parse_optical_float,
    parse_softoptic_base,
    parse_softoptic_lens_diameter,
    parse_softoptic_power,
)
from models import MigrationSourceLink, Order, SoftOpticMigrationJob

# Prescription field -> (source column, older import's reading, current reading)
FIELDS = {
    f"{eye}_{field}": (f"{side}_{column}", old, new)
    for eye, side in (("r", "right"), ("l", "left"))
    for field, column, old, new in (
        ("sph", "sph", parse_optical_float, parse_softoptic_power),
        ("cyl", "cyl", parse_optical_float, parse_softoptic_power),
        ("base", "base", clean_legacy_text, parse_softoptic_base),
        ("diam", "diam", parse_float, parse_softoptic_lens_diameter),
    )
}


def _fix_prescription(block: Any, raw: Dict[str, Any], counts: Counter) -> bool:
    if not isinstance(block, dict):
        return False
    changed = False
    for field, (column, old, new) in FIELDS.items():
        before, after = old(raw.get(column)), new(raw.get(column))
        if before == after or block.get(field) != before:
            continue
        block[field] = after
        counts[f"{field[2:]} fixed"] += 1
        changed = True
    return changed


def _add_near_pd(block: Any, raw: Dict[str, Any], counts: Counter) -> bool:
    near_pd = parse_float(raw.get("pd_near"))
    if not isinstance(block, dict) or near_pd is None or block.get("comb_pd_close") is not None:
        return False
    block["comb_pd_close"] = near_pd
    counts["near pd added"] += 1
    return True


def _fix_lens(lens: Any, raw: Dict[str, Any], counts: Counter) -> bool:
    """Older imports put no diameter on the lens."""
    if not isinstance(lens, dict):
        return False
    changed = False
    for eye in ("right", "left"):
        diameter = parse_softoptic_lens_diameter(raw.get(f"{eye}_diam"))
        if diameter and not lens.get(f"{eye}_diameter"):
            lens[f"{eye}_diameter"] = diameter
            counts["lens diameter added"] += 1
            changed = True
    return changed


def plan(db, job: SoftOpticMigrationJob) -> Tuple[List[tuple], Counter]:
    """Each change is (order, new order_data)."""
    changes: List[tuple] = []
    counts: Counter = Counter()
    raw_by_order = dict(
        db.query(MigrationSourceLink.target_id, MigrationSourceLink.raw_payload)
        .filter(
            # Matches the (source_system, source_table, clinic_id) index; the job id alone scans every row.
            MigrationSourceLink.source_system == "softoptic",
            MigrationSourceLink.clinic_id == job.clinic_id,
            MigrationSourceLink.migration_job_id == job.id,
            MigrationSourceLink.target_model == "Order",
            MigrationSourceLink.source_table == "optic_glasses_presc.csv",
        )
        .all()
    )
    ids = sorted(raw_by_order)
    for start in range(0, len(ids), 500):
        for order in db.query(Order).filter(Order.id.in_(ids[start:start + 500]), Order.deleted_at.is_(None)).all():
            raw = raw_by_order[order.id] or {}
            data = copy.deepcopy(order.order_data or {})
            changed = _fix_prescription(data.get("final-prescription"), raw, counts)
            if "final-prescription" not in data and parse_float(raw.get("pd_near")) is not None:
                # The import left out a prescription with nothing but this near PD; a new import makes one.
                data["final-prescription"] = {}
            changed = _add_near_pd(data.get("final-prescription"), raw, counts) or changed
            changed = _fix_lens(data.get("lens"), raw, counts) or changed
            for tab in data.get("lens_frame_tabs") or []:
                if isinstance(tab, dict):
                    changed = _fix_lens(tab.get("lens"), raw, counts) or changed
            if changed:
                changes.append((order, data))
    counts["orders"] = len(raw_by_order)
    return changes, counts


def apply_changes(changes: List[tuple]) -> None:
    for order, data in changes:
        order.order_data = data
        flag_modified(order, "order_data")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--job-id", required=True, help="softoptic_migration_jobs.id of the SoftOptic import")
    parser.add_argument("--apply", action="store_true", help="write the changes (default: dry run)")
    parser.add_argument("--samples", type=int, default=5)
    args = parser.parse_args()

    db = SessionLocal()
    try:
        job = db.get(SoftOpticMigrationJob, args.job_id)
        if job is None:
            raise SystemExit(f"No migration job {args.job_id}")
        changes, counts = plan(db, job)
        print(f"clinic {job.clinic_id}: {len(changes)} orders to update {dict(counts)}")
        for order, data in changes[: args.samples]:
            prescription = data.get("final-prescription") or {}
            print(f"  order {order.id}: " + ", ".join(f"{field}={prescription.get(field)!r}" for field in FIELDS))
        if args.apply:
            apply_changes(changes)
            db.commit()
            print("applied")
        else:
            db.rollback()
            print("dry run; pass --apply to write")
    finally:
        db.close()


if __name__ == "__main__":
    main()
