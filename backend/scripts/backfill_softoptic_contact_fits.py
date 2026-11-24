"""Give imported SoftOptic contact fits the fields and tabs of OpticSoft's fit screen.

Rebuild missing fit cards from the archived fitting row. Move unchanged Reflex
values to the standard card. Retain previously copied eye-test measurements for
review. Remove a note card only while it still holds the imported remark.

Dry run by default; pass --apply to write.

    cd backend && .venv/bin/python -m scripts.backfill_softoptic_contact_fits --job-id <job>
"""
from __future__ import annotations

import argparse
from collections import Counter
from typing import Any, Dict, List, Tuple

from sqlalchemy.orm.attributes import flag_modified

from database import SessionLocal
from migration.pipeline.common import (
    CONTACT_FIT_TEST_NAME,
    build_contact_fit_exam_data,
    clean_legacy_text,
    parse_float,
)
from models import ExamLayoutInstance, MigrationSourceLink, OpticalExam, SoftOpticMigrationJob
from services.softoptic_visit_repairs import plan_fit_visit_repair

# Older imports' names for a fit, including this script's first one.
OLD_TEST_NAMES = {"Migrated Contact Fit", "בדיקת התאמה"}
OLD_LENS_KEYS = ("old-contact-lenses", "old-contact-lenses-old-contact-lenses-1")
# The note cards older imports made: title -> source column.
OLD_NOTES = {"Fit remark": "fit_remark", "Observation remarks": "obs_remarks", "Fit remarks": "fit_remarks"}


def _imported_note_keys(data: Dict[str, Any], raw: Dict[str, Any]) -> List[str]:
    keys = []
    for key, block in data.items():
        if not (key == "notes" or key.startswith("notes-notes-")) or not isinstance(block, dict):
            continue
        column = OLD_NOTES.get(block.get("title"))
        if column and block.get("note") == clean_legacy_text(raw.get(column)):
            keys.append(key)
    return keys


def _fix_old_lens_bc(data: Dict[str, Any], rebuilt: Dict[str, Any], raw: Dict[str, Any]) -> int:
    """Older imports read BC "86 " as 86 and "860" as 860; fix it while it is still that value."""
    fixed = 0
    for key in OLD_LENS_KEYS:
        block = data.get(key)
        if not isinstance(block, dict):
            continue
        for eye, side in (("r", "right"), ("l", "left")):
            field = f"{eye}_bc"
            old, new = parse_float(raw.get(f"old_{side}_bc")), (rebuilt.get(key) or {}).get(field)
            if old is None or block.get(field) != old or old == new:
                continue
            block = {**block, field: new}
            if new is None:
                block.pop(field)
            data[key] = block
            fixed += 1
    return fixed


def plan(db, job: SoftOpticMigrationJob) -> Tuple[List[tuple], Counter]:
    """Each change is (exam, instance, new test name or None, new exam_data or None)."""
    changes: List[tuple] = []
    counts: Counter = Counter()
    raw_by_exam = dict(
        db.query(MigrationSourceLink.target_id, MigrationSourceLink.raw_payload)
        .filter(
            # Matches the (source_system, source_table, clinic_id) index; the job id alone scans every row.
            MigrationSourceLink.source_system == "softoptic",
            MigrationSourceLink.clinic_id == job.clinic_id,
            MigrationSourceLink.migration_job_id == job.id,
            MigrationSourceLink.target_model == "OpticalExam",
            MigrationSourceLink.source_table == "optic_contact_fit.csv",
        )
        .all()
    )
    ids = sorted(raw_by_exam)
    for start in range(0, len(ids), 500):
        rows = (
            db.query(OpticalExam, ExamLayoutInstance)
            .join(ExamLayoutInstance, ExamLayoutInstance.exam_id == OpticalExam.id)
            .filter(
                OpticalExam.id.in_(ids[start:start + 500]),
                OpticalExam.type == "contact_fit",
                OpticalExam.deleted_at.is_(None),
                ExamLayoutInstance.layout_id.is_(None),
            )
            .all()
        )
        for exam, instance in rows:
            raw = raw_by_exam[exam.id] or {}
            current = dict(instance.exam_data or {})
            rebuilt = build_contact_fit_exam_data(raw)
            repair = plan_fit_visit_repair(current, raw, updated=instance.updated_at is not None)
            data = repair.data
            counts["reflex fields moved"] += repair.moved_reflex_fields
            counts["historic copies needing review"] += repair.copied_data_needs_review
            # Reflex is handled by the source-checked move above.
            rebuilt.pop("retinoscop", None)
            rebuilt.pop("retinoscop-retinoscop-1", None)
            for key in _imported_note_keys(current, raw):
                data.pop(key)
                counts["notes moved"] += 1
            added = [key for key in rebuilt if key not in current]
            for key in added:
                data[key] = rebuilt[key]
            # Details cards an earlier run added get the fields added since.
            for key, block in rebuilt.items():
                existing = data.get(key) or {}
                if key.startswith("softoptic-details-") and key not in added and isinstance(existing, dict):
                    data[key] = {**block, **existing}
            counts["bc fixed"] += _fix_old_lens_bc(data, rebuilt, raw)
            counts["cards added"] += len(added)
            name = CONTACT_FIT_TEST_NAME if exam.test_name in OLD_TEST_NAMES else None
            if name:
                counts["renamed"] += 1
            if name or data != current:
                changes.append((exam, instance, name, data if data != current else None))
    counts["fits"] = len(ids)
    return changes, counts


def apply_changes(changes: List[tuple]) -> None:
    for exam, instance, name, data in changes:
        if name:
            exam.test_name = name
        if data is not None:
            instance.exam_data = data
            flag_modified(instance, "exam_data")


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
        print(f"clinic {job.clinic_id}: {len(changes)} fits to update {dict(counts)}")
        for exam, instance, name, data in changes[: args.samples]:
            before = set(instance.exam_data or {})
            after = set(data or before)
            print(f"  exam {exam.id}: name {name!r}, adds {sorted(after - before)}, removes {sorted(before - after)}")
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
