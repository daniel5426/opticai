"""Restore standalone contact-lens visit records from source snapshots.

The default is a read-only, clinic-scoped preview. The explicit apply mode
creates missing rows in one transaction. Original IDs, links and legacy
attachments remain available for separate clinical verification.
"""
from collections import defaultdict
from dataclasses import dataclass
import argparse
import json

from sqlalchemy import text

from database import SessionLocal
from migration.pipeline.common import CONTACT_CHECK_TEST_NAME, build_softoptic_contact_check_data, clean_legacy_text, parse_date
from migration.pipeline.steps import migrate_contact_lens_order_entries
from models import Clinic, ContactLensOrder, ExamLayoutInstance, MigrationSourceLink, OpticalExam
from services.softoptic_entries import CHECK, ORDER, order_entry_ids


@dataclass
class ArchivedCheck:
    source: MigrationSourceLink
    client_id: int
    order_id: int | None


def _find_checks(db, clinic):
    rows = db.query(MigrationSourceLink).filter_by(
        clinic_id=clinic.id, company_id=clinic.company_id, source_system="softoptic", source_table=CHECK,
    ).order_by(MigrationSourceLink.id).all()
    exam_ids = {row.target_id for row in rows if row.target_model == "OpticalExam"}
    order_ids = {row.target_id for row in rows if row.target_model == "ContactLensOrder"}

    def scoped_rows(model, ids):
        return {record.id: record for record in db.query(model).filter(
            model.id.in_(ids), model.clinic_id == clinic.id, model.company_id == clinic.company_id,
            model.deleted_at.is_(None),
        )}

    exams = scoped_rows(OpticalExam, exam_ids)
    orders = scoped_rows(ContactLensOrder, order_ids)
    clients = {record.client_id for record in (*exams.values(), *orders.values())}
    order_codes = defaultdict(set)
    for link, order_client in db.query(MigrationSourceLink, ContactLensOrder.client_id).join(
        ContactLensOrder, ContactLensOrder.id == MigrationSourceLink.target_id,
    ).filter(
        MigrationSourceLink.clinic_id == clinic.id, MigrationSourceLink.company_id == clinic.company_id,
        MigrationSourceLink.source_system == "softoptic", MigrationSourceLink.source_table == ORDER,
        MigrationSourceLink.target_model == "ContactLensOrder",
        ContactLensOrder.clinic_id == clinic.id, ContactLensOrder.company_id == clinic.company_id,
        ContactLensOrder.client_id.in_(clients), ContactLensOrder.deleted_at.is_(None),
    ):
        raw = link.raw_payload or {}
        code, account = clean_legacy_text(raw.get("code")), clean_legacy_text(raw.get("account_code"))
        if code and account:
            order_codes[order_client, code, account].add(link.target_id)

    by_reference = defaultdict(list)
    restored = set()
    for row in rows:
        exam = exams.get(row.target_id) if row.target_model == "OpticalExam" else None
        order = orders.get(row.target_id) if row.target_model == "ContactLensOrder" else None
        if exam and exam.type in {"softoptic_contact_check", "softoptic_contact_order"}:
            restored.add((row.payload or {}).get("restored_from", row.raw_row_ref))
        elif row.raw_payload and (exam or order):
            by_reference[row.raw_row_ref].append((row, (exam or order).client_id))

    plans = []
    needs_review = 0
    for reference, copies in by_reference.items():
        if reference in restored:
            continue
        source, client_id = copies[0]
        if (any(client_id != other_client or source.raw_payload != other_source.raw_payload
                for other_source, other_client in copies) or not parse_date(source.raw_payload.get("last_action"))):
            needs_review += 1
            continue
        raw = source.raw_payload
        code, account = clean_legacy_text(raw.get("contact_presc_code")), clean_legacy_text(raw.get("account_code"))
        matching_orders = order_codes[client_id, code, account]
        order_id = next(iter(matching_orders)) if len(matching_orders) == 1 else None
        plans.append(ArchivedCheck(source, client_id, order_id))
    return plans, needs_review


def _insert_check(db, plan, order_entry_id=None):
    source = plan.source
    archive = source.raw_payload
    entry_id = order_entry_id
    if entry_id is None:
        exam = OpticalExam(
            company_id=source.company_id, clinic_id=source.clinic_id, client_id=plan.client_id,
            type="softoptic_contact_check", exam_date=parse_date(archive.get("last_action")),
            test_name=CONTACT_CHECK_TEST_NAME,
        )
        db.add(exam)
        db.flush()
        entry_id = exam.id
        db.add(ExamLayoutInstance(exam_id=entry_id, is_active=True, order=0, exam_data=build_softoptic_contact_check_data(archive)))
    db.add(MigrationSourceLink(
        company_id=source.company_id, clinic_id=source.clinic_id, migration_job_id=source.migration_job_id,
        source_system=source.source_system, source_table=source.source_table, target_model="OpticalExam",
        raw_row_ref=f"{source.raw_row_ref}:role=standalone-check",
        source_primary_key_parts=source.source_primary_key_parts,
        target_id=entry_id, raw_payload=archive, raw_payload_sha256=source.raw_payload_sha256,
        raw_captured_at=source.raw_captured_at,
        payload={"restored_from": source.raw_row_ref, "order_id": plan.order_id},
    ))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--clinic-id", required=True, type=int)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    with SessionLocal() as db, db.begin():
        if db.bind.dialect.name == "postgresql":
            if not args.apply:
                db.execute(text("SET TRANSACTION READ ONLY"))
            else:
                db.execute(text("SET LOCAL lock_timeout = '2s'"))
        clinic_query = db.query(Clinic).filter(Clinic.id == args.clinic_id)
        if args.apply:
            clinic_query = clinic_query.with_for_update()
        clinic = clinic_query.one()
        checks, needs_review = _find_checks(db, clinic)
        added_orders = 0
        if args.apply:
            job_ids = db.query(MigrationSourceLink.migration_job_id).filter_by(
                clinic_id=clinic.id, company_id=clinic.company_id, source_system="softoptic",
                source_table=ORDER, target_model="ContactLensOrder",
            ).filter(MigrationSourceLink.migration_job_id.is_not(None)).distinct()
            for (job_id,) in job_ids:
                added_orders += migrate_contact_lens_order_entries(db, {
                    "company_id": clinic.company_id, "source_system": "softoptic", "migration_job_id": job_id,
                }, clinic_id=clinic.id)
            mapped = order_entry_ids(db, clinic.company_id, [clinic.id])
            for plan in checks:
                _insert_check(db, plan, mapped.get(plan.order_id))
    print(json.dumps({"clinic_id": args.clinic_id, "applied": args.apply,
                      "checks": len(checks), "checks_with_verified_order": sum(plan.order_id is not None for plan in checks),
                      "checks_needing_review": needs_review,
                      "order_entries_created": added_orders}))


if __name__ == "__main__":
    main()
