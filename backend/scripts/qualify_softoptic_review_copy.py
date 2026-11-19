"""Apply the Soft Optic repairs to the dedicated staging review clinic."""
from collections import Counter, defaultdict
import argparse
import json

from sqlalchemy import Column, DateTime, Integer, JSON, MetaData, Table, and_, func, select, text, tuple_

from database import SessionLocal
from migration.pipeline.common import parse_date
from migration.pipeline.steps import migrate_contact_lens_order_entries
from models import Clinic, ExamLayoutInstance, MigrationSourceLink, OpticalExam, SoftOpticMigrationJob
from scripts.copy_softoptic_clinic_for_review import COPY_KEY, STAGING, copy_values, target_identity
from scripts.restore_softoptic_visit_records import _find_checks, _insert_check
from services.softoptic_entries import CHECK, order_entry_ids
from services.softoptic_visit_repairs import COPIED_EYE_CARD_KEYS, plan_fit_visit_repair, remove_legacy_check_overlay

CLONE_JOB = f"{COPY_KEY}-source-11-company-28"
EYE_TABLES = ("optic_eye_tests.csv", "optic_exp_eyetests.csv")
CAPTION = "softoptic-details-eye-test"


def _archive_query(clinic, source_tables):
    return select(MigrationSourceLink).where(
        MigrationSourceLink.clinic_id == clinic.id, MigrationSourceLink.company_id == clinic.company_id,
        MigrationSourceLink.source_system == "softoptic", MigrationSourceLink.target_model == "OpticalExam",
        MigrationSourceLink.source_table.in_(source_tables),
    )


def _eye_source_cards(db, clinic, requested):
    if not requested:
        return {}
    candidates = defaultdict(list)
    links = _archive_query(clinic, EYE_TABLES).with_only_columns(MigrationSourceLink.target_id).distinct()
    fields = func.json_each(ExamLayoutInstance.exam_data).table_valued("key", "value")
    copied_cards = select(func.json_object_agg(fields.c.key, fields.c.value)).where(
        fields.c.key.in_(COPIED_EYE_CARD_KEYS),
    ).correlate(ExamLayoutInstance).scalar_subquery()
    records = db.query(OpticalExam.client_id, OpticalExam.exam_date, copied_cards.cast(JSON)).join(
        ExamLayoutInstance, and_(ExamLayoutInstance.exam_id == OpticalExam.id, ExamLayoutInstance.layout_id.is_(None)),
    ).filter(OpticalExam.clinic_id == clinic.id, OpticalExam.company_id == clinic.company_id,
             tuple_(OpticalExam.client_id, OpticalExam.exam_date).in_(requested),
             OpticalExam.id.in_(links), OpticalExam.type == "exam", OpticalExam.deleted_at.is_(None))
    for client_id, day, data in records.yield_per(250):
        candidates[client_id, day].append(data)
    return candidates


def plan_fit_repairs(db, clinic):
    sources = _archive_query(clinic, ("optic_contact_fit.csv",)).with_only_columns(
        MigrationSourceLink.target_id, MigrationSourceLink.raw_payload,
    )
    raw = {target_id: payload for target_id, payload in db.execute(sources.execution_options(yield_per=250)) if payload}
    exams = db.query(OpticalExam.client_id, ExamLayoutInstance).join(
        ExamLayoutInstance, ExamLayoutInstance.exam_id == OpticalExam.id,
    ).filter(OpticalExam.clinic_id == clinic.id, OpticalExam.company_id == clinic.company_id,
             OpticalExam.type == "contact_fit", OpticalExam.id.in_(raw),
             OpticalExam.deleted_at.is_(None), ExamLayoutInstance.layout_id.is_(None), ExamLayoutInstance.order == 0)
    source_dates = exams.with_entities(OpticalExam.client_id, ExamLayoutInstance.exam_data[CAPTION]["eye_test_date"].as_string())
    requested = {(client_id, day) for client_id, value in source_dates if (day := parse_date(value))}
    archived = defaultdict(list)
    requested = sorted((client, day) for client, day in requested if client is not None)
    for start in range(0, len(requested), 750):
        archived.update(_eye_source_cards(db, clinic, requested[start:start + 750]))
    print(f"Compared source candidates for {len(requested):,} fitting dates", flush=True)
    counts = Counter()
    changes = []
    for client_id, instance in exams.yield_per(250):
        current = instance.exam_data or {}
        day = parse_date((current.get(CAPTION) or {}).get("eye_test_date"))
        matching = [
            plan for candidate in archived.get((client_id, day), [])
            if (plan := plan_fit_visit_repair(current, raw[instance.exam_id], candidate)).removed_copied_blocks
        ]
        # Require one exact match to the copied blocks on the caption's source date.
        plan = matching[0] if len(matching) == 1 else plan_fit_visit_repair(current, raw[instance.exam_id])
        if plan.data != current:
            changes.append({"id": instance.id, "previous_updated_at": instance.updated_at, "exam_data": plan.data})
        counts["reflex_fields_moved"] += plan.moved_reflex_fields
        counts["fits_with_verified_copies_removed"] += bool(plan.removed_copied_blocks)
        counts["fits_with_copies_left_for_review"] += plan.copied_data_needs_review
    counts["fitting_layouts_updated"] = len(changes)
    return changes, dict(counts)


def write_layout_repairs(db, clinic, changes, exam_type):
    if not changes:
        return
    db.execute(text("""
        CREATE TEMP TABLE review_fit_repairs (
            id INTEGER PRIMARY KEY, previous_updated_at TIMESTAMPTZ, exam_data JSON NOT NULL
        ) ON COMMIT DROP
    """))
    target = Table(
        "review_fit_repairs", MetaData(), Column("id", Integer), Column("previous_updated_at", DateTime(timezone=True)),
        Column("exam_data", JSON), schema="pg_temp",
    )
    for start in range(0, len(changes), 250):
        copy_values(db.connection(), target, changes[start:start + 250])
    updated = db.execute(text("""
        UPDATE exam_layout_instances AS instance
        SET exam_data = repair.exam_data, updated_at = now()
        FROM pg_temp.review_fit_repairs AS repair, optical_exams AS exam
        WHERE instance.id = repair.id AND instance.exam_id = exam.id
          AND instance.updated_at IS NOT DISTINCT FROM repair.previous_updated_at
          AND instance.layout_id IS NULL AND instance."order" = 0
          AND exam.company_id = :company_id AND exam.clinic_id = :clinic_id
          AND exam.type = :exam_type AND exam.deleted_at IS NULL
    """), {"company_id": clinic.company_id, "clinic_id": clinic.id, "exam_type": exam_type}).rowcount
    if updated != len(changes):
        raise RuntimeError("An exam layout changed during repair. Run a fresh preview.")
    db.execute(text("DROP TABLE pg_temp.review_fit_repairs"))


def plan_check_overlay_repairs(db, clinic, restored_refs):
    links = defaultdict(list)
    for row in db.scalars(_archive_query(clinic, (CHECK,)).order_by(MigrationSourceLink.id)):
        links[row.target_id].append(row)
    exams = db.query(ExamLayoutInstance).join(OpticalExam).filter(
        OpticalExam.clinic_id == clinic.id, OpticalExam.company_id == clinic.company_id,
        OpticalExam.type == "exam", OpticalExam.id.in_(links), OpticalExam.deleted_at.is_(None),
        ExamLayoutInstance.layout_id.is_(None), ExamLayoutInstance.order == 0,
    )
    counts = Counter(legacy_check_overlays_removed=0, legacy_check_overlays_left_for_review=0)
    changes = []
    for instance in exams:
        current = instance.exam_data or {}
        if "over-refraction" not in current:
            continue
        rows = links[instance.exam_id]
        repaired = current
        if all(row.raw_payload and row.raw_row_ref in restored_refs for row in rows):
            repaired = remove_legacy_check_overlay(current, [row.raw_payload for row in rows])
        if repaired == current:
            counts["legacy_check_overlays_left_for_review"] += 1
        else:
            changes.append({"id": instance.id, "previous_updated_at": instance.updated_at, "exam_data": repaired})
            counts["legacy_check_overlays_removed"] += 1
    return changes, dict(counts)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--clinic-id", type=int, required=True)
    args = parser.parse_args()
    with SessionLocal() as db, db.begin():
        target_identity(db.bind.url, STAGING)
        db.execute(text("SET LOCAL lock_timeout = '3s'"))
        db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:key))"), {"key": CLONE_JOB})
        clinic = db.query(Clinic).filter_by(id=args.clinic_id, company_id=28, unique_id=CLONE_JOB).one()
        job = db.get(SoftOpticMigrationJob, CLONE_JOB)
        if not job or job.clinic_id != clinic.id or not (job.source_metadata or {}).get("review_copy"):
            raise SystemExit("The target is not the designated staging review copy")
        reviews, ambiguous = _find_checks(db, clinic)
        orders_created = migrate_contact_lens_order_entries(db, {
            "company_id": clinic.company_id, "migration_job_id": job.id,
        }, clinic_id=clinic.id)
        print(f"Prepared {orders_created:,} contact-lens history entries", flush=True)
        order_entries = order_entry_ids(db, clinic.company_id, [clinic.id])
        linked = 0
        for check in reviews:
            entry = order_entries.get(check.order_id)
            _insert_check(db, check, entry)
            linked += entry is not None
        restored_refs = {(row.payload or {}).get("restored_from") for row in db.scalars(_archive_query(clinic, (CHECK,)))}
        overlays, overlay_counts = plan_check_overlay_repairs(db, clinic, restored_refs - {None})
        write_layout_repairs(db, clinic, overlays, "exam")
        print(f"Processed {len(reviews):,} archived contact-lens checks and their legacy attachments", flush=True)
        fittings, fit_counts = plan_fit_repairs(db, clinic)
        write_layout_repairs(db, clinic, fittings, "contact_fit")
        summary = {
            "clinic_id": clinic.id, "order_entries_created": orders_created, "checks_paired_by_source": linked,
            "standalone_checks_restored": len(reviews) - linked, "checks_left_for_review": ambiguous,
            **fit_counts, **overlay_counts,
        }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
