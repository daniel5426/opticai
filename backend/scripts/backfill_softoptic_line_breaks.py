"""Turn OpticSoft's literal line-break codes into line breaks in an imported SoftOptic clinic's texts.

OpticSoft's export writes a line break inside a text as the literal codes \\x0d\\x0a. Older imports
kept them, so notes read "לחצי שנה\\x0d\\x0a640". Only those codes are replaced, in the text fields and
JSON texts of the records the import created; nobody types them, so anything edited since stays.

For one import job, this touches its clinic's imported records only: orders, contact lens orders,
exams, clients, medical logs, billings and referrals. Other clinics are never read or written.

Dry run by default; pass --apply to write.

    cd backend && .venv/bin/python -m scripts.backfill_softoptic_line_breaks --job-id <job>
"""
from __future__ import annotations

import argparse
import copy
from collections import Counter
import json
from typing import Any, Dict, Iterator, List, Tuple

from sqlalchemy import JSON, String, Text, inspect, text
from sqlalchemy.orm.attributes import flag_modified

from database import SessionLocal
from migration.pipeline.common import LEGACY_LINE_BREAK, decode_legacy_line_breaks
from models import (
    Billing,
    Client,
    ContactLensOrder,
    ExamLayoutInstance,
    MedicalLog,
    MigrationSourceLink,
    Order,
    Referral,
    SoftOpticMigrationJob,
)

# Short committed batches, so a big clinic never holds one long transaction that blocks migrations.
BATCH_SIZE = 200

MODELS = {model.__name__: model for model in (Order, ContactLensOrder, ExamLayoutInstance, Client, MedicalLog, Billing, Referral)}


def _decode(value: Any) -> Tuple[Any, int]:
    """The value with its codes decoded, and how many texts changed."""
    if isinstance(value, str):
        return (decode_legacy_line_breaks(value), 1) if LEGACY_LINE_BREAK.search(value) else (value, 0)
    if isinstance(value, dict):
        changed = 0
        for key, item in value.items():
            value[key], count = _decode(item)
            changed += count
        return value, changed
    if isinstance(value, list):
        changed = 0
        for index, item in enumerate(value):
            value[index], count = _decode(item)
            changed += count
        return value, changed
    return value, 0


def _text_columns(model) -> List[Tuple[str, bool]]:
    """(attribute, is JSON) for every column that can hold text."""
    return [
        (column.key, isinstance(column.type, JSON))
        for column in inspect(model).columns
        if isinstance(column.type, (String, Text, JSON))
    ]


def _targets(db, job: SoftOpticMigrationJob) -> Dict[str, List[int]]:
    targets: Dict[str, set] = {}
    for model_name, target_id in db.query(MigrationSourceLink.target_model, MigrationSourceLink.target_id).filter(
        MigrationSourceLink.source_system == "softoptic",
        MigrationSourceLink.clinic_id == job.clinic_id,
        MigrationSourceLink.migration_job_id == job.id,
        MigrationSourceLink.target_model.in_(list(MODELS)),
    ):
        if target_id is not None:
            targets.setdefault(model_name, set()).add(target_id)
    return {model_name: sorted(ids) for model_name, ids in targets.items()}


def plan_batches(db, job: SoftOpticMigrationJob, batch_size: int = BATCH_SIZE) -> Iterator[Tuple[List[Tuple[Any, Dict[str, Any]]], Counter]]:
    """The changes a batch of imported records at a time, each (record, {attribute: new value})."""
    for model_name, ids in _targets(db, job).items():
        model = MODELS[model_name]
        columns = _text_columns(model)
        for start in range(0, len(ids), batch_size):
            changes: List[Tuple[Any, Dict[str, Any]]] = []
            counts: Counter = Counter()
            for record in db.query(model).filter(model.id.in_(ids[start:start + batch_size])):
                updates: Dict[str, Any] = {}
                for attribute, is_json in columns:
                    value = getattr(record, attribute)
                    new, changed = _decode(copy.deepcopy(value) if is_json else value)
                    if changed:
                        updates[attribute] = new
                        counts[f"{model_name} texts"] += changed
                if updates:
                    changes.append((record, updates))
            yield changes, counts


def plan(db, job: SoftOpticMigrationJob) -> Tuple[List[Tuple[Any, Dict[str, Any]]], Counter]:
    changes: List[Tuple[Any, Dict[str, Any]]] = []
    counts: Counter = Counter()
    for batch, batch_counts in plan_batches(db, job):
        changes += batch
        counts += batch_counts
    return changes, counts


def apply(changes: List[Tuple[Any, Dict[str, Any]]]) -> None:
    for record, updates in changes:
        for attribute, value in updates.items():
            setattr(record, attribute, value)
            flag_modified(record, attribute)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--job-id", required=True, help="softoptic_migration_jobs.id of the clinic's SoftOptic import")
    parser.add_argument("--apply", action="store_true", help="write the changes (default: dry run)")
    parser.add_argument("--backup", help="JSON-lines file for each changed record's old texts (default: next to the script's run)")
    args = parser.parse_args()

    db = SessionLocal()
    backup = None
    try:
        job = db.get(SoftOpticMigrationJob, args.job_id)
        if job is None:
            raise SystemExit(f"No migration job {args.job_id}")
        clinic_id, job_id = job.clinic_id, job.id
        if args.apply:
            backup = open(args.backup or f"softoptic_line_breaks_{job_id}_backup.jsonl", "a", encoding="utf-8")
        records, totals = 0, Counter()
        db.rollback()
        for changes, counts in plan_batches(db, job):
            records += len(changes)
            totals += counts
            if args.apply and changes:
                if db.bind.dialect.name == "postgresql":
                    db.execute(text("SET LOCAL lock_timeout = '2s'"))
                for record, updates in changes:
                    old = {attribute: getattr(record, attribute) for attribute in updates}
                    backup.write(json.dumps({"model": type(record).__name__, "id": record.id, "old": old}, ensure_ascii=False, default=str) + "\n")
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
