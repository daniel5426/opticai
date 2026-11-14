"""Put OpticSoft's implied point back into the BC of imported SoftOptic contact lens orders.

OpticSoft keeps a base curve as digits with an implied point after the first ("84" is 8.4, "765" is
7.65). Imports before the fix read it as 84.0, and lens checks copied it as the text "84". A BC is a
few millimetres, so a whole number of 20 or more can only be that code: only such values are
changed, which leaves anything corrected since the import alone.

For one import job, this fixes its clinic's imported contact lens orders only. Other fields, orders
the job did not import, and other clinics are never touched.

Dry run by default; pass --apply to write.

    cd backend && .venv/bin/python -m scripts.backfill_softoptic_contact_order_bc --job-id <job>
"""
from __future__ import annotations

import argparse
import copy
from collections import Counter
from typing import Any, List, Optional, Tuple

from sqlalchemy.orm.attributes import flag_modified

from database import SessionLocal
from migration.pipeline.common import parse_softoptic_bc
from models import ContactLensOrder, MigrationSourceLink, SoftOpticMigrationJob

BC_FIELDS = ("r_bc", "l_bc", "r_bc_2", "l_bc_2")


def fixed_bc(value: Any) -> Optional[Any]:
    """The BC an OpticSoft code stands for, or None when the value is not such a code."""
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        if value < 20 or value != int(value):
            return None
        value = str(int(value))
    text = str(value).strip()
    if not text.isdigit() or int(text) < 20:
        return None
    return parse_softoptic_bc(text)


def plan(db, job: SoftOpticMigrationJob) -> Tuple[List[Tuple[ContactLensOrder, dict]], Counter]:
    counts: Counter = Counter()
    order_ids = sorted({
        target_id
        for (target_id,) in db.query(MigrationSourceLink.target_id).filter(
            # Matches the (source_system, source_table, clinic_id) index; the job id alone scans every row.
            MigrationSourceLink.source_system == "softoptic",
            MigrationSourceLink.source_table == "optic_contact_presc.csv",
            MigrationSourceLink.clinic_id == job.clinic_id,
            MigrationSourceLink.migration_job_id == job.id,
            MigrationSourceLink.target_model == "ContactLensOrder",
        )
    })
    changes: List[Tuple[ContactLensOrder, dict]] = []
    for start in range(0, len(order_ids), 500):
        for order in db.query(ContactLensOrder).filter(
            ContactLensOrder.id.in_(order_ids[start:start + 500]),
            ContactLensOrder.clinic_id == job.clinic_id,
        ):
            data = copy.deepcopy(order.order_data or {})
            exam = data.get("contact-lens-exam")
            if not isinstance(exam, dict):
                continue
            fixed = 0
            for field in BC_FIELDS:
                new = fixed_bc(exam.get(field))
                if new is not None:
                    exam[field] = new
                    fixed += 1
            if fixed:
                counts["bc values fixed"] += fixed
                changes.append((order, data))
    counts["orders"] = len(order_ids)
    return changes, counts


def apply(changes: List[Tuple[ContactLensOrder, dict]]) -> None:
    for order, data in changes:
        order.order_data = data
        flag_modified(order, "order_data")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--job-id", required=True, help="softoptic_migration_jobs.id of the clinic's SoftOptic import")
    parser.add_argument("--apply", action="store_true", help="write the changes (default: dry run)")
    parser.add_argument("--samples", type=int, default=5)
    args = parser.parse_args()

    db = SessionLocal()
    try:
        job = db.get(SoftOpticMigrationJob, args.job_id)
        if job is None:
            raise SystemExit(f"No migration job {args.job_id}")
        changes, counts = plan(db, job)
        print(f"clinic {job.clinic_id}: {len(changes)} contact lens orders to fix {dict(counts)}")
        for order, data in changes[: args.samples]:
            before = {field: (order.order_data or {}).get("contact-lens-exam", {}).get(field) for field in BC_FIELDS}
            after = {field: data["contact-lens-exam"].get(field) for field in BC_FIELDS}
            print(f"  order {order.id}: {before} -> {after}")
        if args.apply:
            apply(changes)
            db.commit()
            print("applied")
        else:
            db.rollback()
            print("dry run; pass --apply to write")
    finally:
        db.close()


if __name__ == "__main__":
    main()
