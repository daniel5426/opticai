"""Fix the combined PD and the "6/6-" VA of one clinic's SoftOptic import.

Two import mistakes, fixed for future imports in PRs #111 and #112:

- PD: OpticSoft's combined PD columns are named the other way round (pd_near is the far PD).
  Older imports put the far PD in the order's near box and the near PD in the old comb_pd field.
  An order is swapped only while both values still equal what the import wrote and no far PD
  was typed since, so an order edited by hand is left alone.
- VA: a lone trailing sign means one letter (6/6- is 6/6-1). Older imports kept the bare sign.
  Only values of exactly that shape ("6/<n>-" or "6/<n>+") in VA fields are changed.

Only the orders and exams this import created are read. Dry run by default; pass --apply to write.
Writes go in short batches with a lock timeout, and each changed record's old data is saved to a
JSON-lines backup first.

    cd backend && .venv/bin/python -m scripts.backfill_softoptic_pd_and_va --job-id <job>
"""
from __future__ import annotations

import argparse
import copy
import json
import re
from collections import Counter
from typing import Any, Iterator, List, Tuple

from sqlalchemy import text
from sqlalchemy.orm.attributes import flag_modified

from database import SessionLocal
from migration.pipeline.common import parse_float
from models import ExamLayoutInstance, MigrationSourceLink, Order, SoftOpticMigrationJob

BATCH_SIZE = 200
LONE_SIGN_VA = re.compile(r"^6/\d+(?:\.\d+)?[+-]$")
VA_KEY = re.compile(r"(?:^|_)(?:va|fa|ph)$")


def fix_va(data: Any) -> int:
    """Turn every "6/<n>-" or "6/<n>+" in a VA field into "-1"/"+1", in place."""
    fixed = 0
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, str) and VA_KEY.search(key) and LONE_SIGN_VA.match(value):
                data[key] = value + "1"
                fixed += 1
            else:
                fixed += fix_va(value)
    elif isinstance(data, list):
        for item in data:
            fixed += fix_va(item)
    return fixed


def fix_pd(prescription: Any, raw: dict) -> bool:
    """Swap the combined PD into its right boxes while it is still what the import wrote."""
    if not isinstance(prescription, dict) or prescription.get("comb_pd_far") not in (None, ""):
        return False
    far, near = parse_float(raw.get("pd_near")), parse_float(raw.get("pd_far"))
    if far is None and near is None:
        return False
    if prescription.get("comb_pd_close") != far or prescription.get("comb_pd") != near:
        return False
    prescription.pop("comb_pd", None)
    prescription["comb_pd_far"], prescription["comb_pd_close"] = far, near
    return True


def _links(db, job: SoftOpticMigrationJob, model: str):
    return db.query(MigrationSourceLink.target_id, MigrationSourceLink.raw_payload).filter(
        MigrationSourceLink.source_system == "softoptic",
        MigrationSourceLink.clinic_id == job.clinic_id,
        MigrationSourceLink.migration_job_id == job.id,
        MigrationSourceLink.target_model == model,
    )


def plan_batches(db, job: SoftOpticMigrationJob) -> Iterator[Tuple[List[tuple], Counter]]:
    """Yields batches of (record, attribute, new value) with what each batch fixes."""
    raw_by_order = {
        order_id: raw or {}
        for order_id, raw in _links(db, job, "Order").filter(MigrationSourceLink.source_table == "optic_glasses_presc.csv")
    }
    order_ids = sorted(raw_by_order)
    for start in range(0, len(order_ids), BATCH_SIZE):
        changes, counts = [], Counter()
        for order in db.query(Order).filter(Order.id.in_(order_ids[start:start + BATCH_SIZE]), Order.deleted_at.is_(None)):
            data = copy.deepcopy(order.order_data or {})
            pd_fixed = fix_pd(data.get("final-prescription"), raw_by_order[order.id])
            va_fixed = fix_va(data)
            counts["order PDs swapped"] += pd_fixed
            counts["order VAs fixed"] += va_fixed
            if pd_fixed or va_fixed:
                changes.append((order, "order_data", data))
        yield changes, counts

    exam_ids = sorted({exam_id for exam_id, _ in _links(db, job, "OpticalExam")})
    for start in range(0, len(exam_ids), BATCH_SIZE):
        changes, counts = [], Counter()
        for instance in db.query(ExamLayoutInstance).filter(ExamLayoutInstance.exam_id.in_(exam_ids[start:start + BATCH_SIZE])):
            data = copy.deepcopy(instance.exam_data or {})
            va_fixed = fix_va(data)
            counts["exam VAs fixed"] += va_fixed
            if va_fixed:
                changes.append((instance, "exam_data", data))
        yield changes, counts


def apply(changes: List[tuple]) -> None:
    for record, attribute, value in changes:
        setattr(record, attribute, value)
        flag_modified(record, attribute)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--job-id", required=True, help="softoptic_migration_jobs.id of the clinic's SoftOptic import")
    parser.add_argument("--apply", action="store_true", help="write the changes (default: dry run)")
    parser.add_argument("--backup", help="JSON-lines file for each changed record's old data")
    args = parser.parse_args()

    db = SessionLocal()
    backup = None
    try:
        job = db.get(SoftOpticMigrationJob, args.job_id)
        if job is None:
            raise SystemExit(f"No migration job {args.job_id}")
        clinic_id, job_id = job.clinic_id, job.id
        if args.apply:
            backup = open(args.backup or f"softoptic_pd_va_{job_id}_backup.jsonl", "a", encoding="utf-8")
        records, totals = 0, Counter()
        for changes, counts in plan_batches(db, job):
            records += len(changes)
            totals += counts
            if args.apply and changes:
                if db.bind.dialect.name == "postgresql":
                    db.execute(text("SET LOCAL lock_timeout = '2s'"))
                for record, attribute, _ in changes:
                    old = getattr(record, attribute)
                    backup.write(json.dumps({"model": type(record).__name__, "id": record.id, attribute: old}, ensure_ascii=False, default=str) + "\n")
                apply(changes)
                db.commit()
                backup.flush()
            else:
                db.rollback()
        print(f"clinic {clinic_id}: {records} records {'fixed' if args.apply else 'to fix'} {dict(totals)}")
        print("applied" if args.apply else "dry run; pass --apply to write")
    finally:
        db.close()
        if backup:
            backup.close()


if __name__ == "__main__":
    main()
