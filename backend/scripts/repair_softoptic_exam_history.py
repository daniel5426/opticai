"""Preview or apply the Soft Optic history repair for the verified Harel clinic."""
import argparse
import hashlib
import json
import os
from pathlib import Path

from dotenv import dotenv_values
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from models import Clinic, MigrationSourceLink, SoftOpticMigrationJob
from scripts.backfill_softoptic_contact_order_titles import contact_order_title_changes
from scripts.copy_softoptic_clinic_for_review import PRODUCTION, STAGING, target_identity
from scripts.qualify_softoptic_review_copy import (
    CLONE_JOB, _archive_query, plan_check_overlay_repairs, plan_fit_repairs, write_layout_repairs,
)
from scripts.restore_softoptic_visit_records import _find_checks, _insert_check
from services.softoptic_entries import (
    CHECK, CONTACT_ORDER_TITLE_PREFIX, create_postgres_order_entries, missing_postgres_order_entries, order_entry_ids,
)

TARGETS = {"production": (PRODUCTION, 11, 6), "staging": (STAGING, 90, 28)}


def resolve_clinic(db, target):
    _, clinic_id, company_id = TARGETS[target]
    clinic = db.query(Clinic).filter_by(id=clinic_id, company_id=company_id).one()
    if target == "staging":
        job = db.get(SoftOpticMigrationJob, CLONE_JOB)
        metadata = (job.source_metadata or {}) if job else {}
        if not (clinic.unique_id == CLONE_JOB and job and job.clinic_id == clinic.id
                and job.company_id == clinic.company_id and metadata.get("review_copy") is True
                and str(metadata.get("source_clinic_id")) == "11"):
            raise SystemExit("The staging target is not the verified Soft Optic review copy")
    elif not db.scalar(_archive_query(clinic, ("optic_contact_fit.csv",)).with_only_columns(MigrationSourceLink.id).limit(1)):
        raise SystemExit("The production target has no verified Soft Optic exam history")
    return clinic


def repair(db, clinic, *, apply_plan=None):
    missing_orders = missing_postgres_order_entries(db, clinic.company_id, clinic.id)
    order_entries = order_entry_ids(db, clinic.company_id, [clinic.id])
    representable_orders = order_entries.keys() | {row.order_id for row in missing_orders}
    checks, ambiguous = _find_checks(db, clinic)
    linked_checks = sum(check.order_id in representable_orders for check in checks)
    restored_refs = {check.source.raw_row_ref for check in checks}
    restored_refs.update((row.payload or {}).get("restored_from", row.raw_row_ref)
                         for row in db.scalars(_archive_query(clinic, (CHECK,)))
                         if (row.payload or {}).get("restored_from"))
    overlays, overlay_counts = plan_check_overlay_repairs(db, clinic, restored_refs)
    fittings, fit_counts = plan_fit_repairs(db, clinic)
    titles = contact_order_title_changes(db, clinic.id, clinic.company_id)
    summary = {
        "clinic_id": clinic.id,
        "order_entries_created": len(missing_orders),
        "new_entries_with_recorded_type": sum(row.title != CONTACT_ORDER_TITLE_PREFIX for row in missing_orders),
        "existing_order_titles_updated": len(titles),
        "checks_paired_by_source": linked_checks,
        "standalone_checks_restored": len(checks) - linked_checks,
        "checks_left_for_review": ambiguous,
        **overlay_counts,
        **fit_counts,
    }
    plan = [summary, [tuple(row) for row in missing_orders], [tuple(row) for row in titles],
            [(check.source.id, check.source.raw_payload_sha256, check.order_id) for check in checks],
            sorted(overlays, key=lambda row: row["id"]), sorted(fittings, key=lambda row: row["id"])]
    token = hashlib.sha256(json.dumps(plan, sort_keys=True, default=str).encode()).hexdigest()
    if apply_plan is not None:
        if apply_plan != token:
            raise SystemExit("The repair differs from the reviewed preview. Run a fresh preview.")
        created = create_postgres_order_entries(db, clinic.company_id, None, clinic.id)
        if created != len(missing_orders):
            raise RuntimeError("Contact-lens orders changed during repair")
        order_entries = order_entry_ids(db, clinic.company_id, [clinic.id])
        for check in checks:
            entry_id = order_entries.get(check.order_id)
            if (entry_id is not None) != (check.order_id in representable_orders):
                raise RuntimeError("A verified check's order entry changed during repair")
            _insert_check(db, check, entry_id)
        write_layout_repairs(db, clinic, overlays, "exam")
        write_layout_repairs(db, clinic, fittings, "contact_fit")
        changed_titles = contact_order_title_changes(db, clinic.id, clinic.company_id, apply=True)
        if changed_titles != titles:
            raise RuntimeError("Contact-lens titles changed during repair")
    return {**summary, "plan": token, "applied": apply_plan is not None}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", choices=TARGETS, required=True)
    parser.add_argument("--apply", metavar="PREVIEW_PLAN", help="Apply the exact plan from a read-only preview")
    args = parser.parse_args()
    project, clinic_id, _ = TARGETS[args.target]
    env = dotenv_values(Path(__file__).resolve().parents[1] / ".env")
    env_key = "PRODUCTION_DATABASE_URL" if args.target == "production" else "DATABASE_URL"
    url = target_identity(os.environ.get(env_key) or env[env_key], project)
    engine = create_engine(url, isolation_level="REPEATABLE READ", hide_parameters=True, connect_args={"connect_timeout": 10})
    with Session(engine) as db, db.begin():
        if args.apply is None:
            db.execute(text("SET TRANSACTION READ ONLY"))
        else:
            db.execute(text("SET LOCAL lock_timeout = '3s'"))
            db.execute(text("SELECT pg_advisory_xact_lock(:namespace, :clinic_id)"), {"namespace": 841667, "clinic_id": clinic_id})
        db.execute(text("SET LOCAL statement_timeout = '120s'"))
        report = repair(db, resolve_clinic(db, args.target), apply_plan=args.apply)
    print(json.dumps({"target": args.target, **report}, indent=2))


if __name__ == "__main__":
    main()
