"""Use linked Soft Optic order types in the titles of the staging review exams."""
import argparse
import json

from sqlalchemy import text

from database import SessionLocal
from migration.pipeline.common import CONTACT_ORDER_TEST_NAME
from scripts.copy_softoptic_clinic_for_review import STAGING, target_identity
from scripts.qualify_softoptic_review_copy import CLONE_JOB
from services.softoptic_entries import CONTACT_ORDER_TITLE_PREFIX, CONTACT_ORDER_TITLE_SQL


CANDIDATES = f"""
    WITH order_links AS (
        SELECT exam.id, exam.client_id, min(source.payload->>'order_id') AS order_id
        FROM optical_exams AS exam
        JOIN migration_source_links AS source
          ON source.target_id = exam.id AND source.company_id = exam.company_id AND source.clinic_id = exam.clinic_id
        WHERE exam.company_id = :company_id AND exam.clinic_id = :clinic_id
          AND exam.type = 'softoptic_contact_order' AND exam.deleted_at IS NULL AND exam.test_name = :legacy_title
          AND source.source_system = 'softoptic' AND source.source_table = 'optic_contact_presc.csv'
          AND source.target_model = 'OpticalExam'
        GROUP BY exam.id
        HAVING count(DISTINCT source.payload->>'order_id') = 1
    ), titles AS (
        SELECT order_links.id, {CONTACT_ORDER_TITLE_SQL} AS title
        FROM order_links
        JOIN contact_lens_orders AS orders ON orders.id::text = order_links.order_id
          AND orders.company_id = :company_id AND orders.clinic_id = :clinic_id
          AND orders.client_id = order_links.client_id AND orders.deleted_at IS NULL
    )
"""


def backfill_titles(db, clinic_id, *, apply=False):
    target_identity(db.bind.url, STAGING)
    if apply:
        db.execute(text("SET LOCAL lock_timeout = '4s'"))
        db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:job))"), {"job": CLONE_JOB})
    else:
        db.execute(text("SET TRANSACTION READ ONLY"))
    company_id = db.execute(text("""
        SELECT clinic.company_id
        FROM clinics AS clinic
        JOIN softoptic_migration_jobs AS job ON job.clinic_id = clinic.id AND job.company_id = clinic.company_id
        WHERE clinic.id = :clinic_id AND clinic.company_id = 28 AND clinic.unique_id = :job
          AND job.id = :job AND job.source_metadata->>'review_copy' = 'true'
          AND job.source_metadata->>'source_clinic_id' = '11'
    """), {"clinic_id": clinic_id, "job": CLONE_JOB}).scalar_one()
    return repair_contact_order_titles(db, clinic_id, company_id, apply=apply)


def repair_contact_order_titles(db, clinic_id, company_id, *, apply=False):
    rows = contact_order_title_changes(db, clinic_id, company_id, apply=apply)
    return {"eligible": len(rows), "with_recorded_type": sum(row.title != CONTACT_ORDER_TITLE_PREFIX for row in rows)}


def contact_order_title_changes(db, clinic_id, company_id, *, apply=False):
    params = {
        "company_id": company_id, "clinic_id": clinic_id, "legacy_title": CONTACT_ORDER_TEST_NAME,
        "title_prefix": CONTACT_ORDER_TITLE_PREFIX,
    }
    if apply:
        statement = CANDIDATES + """
            , updated AS (
                UPDATE optical_exams AS exam SET test_name = titles.title
                FROM titles
                WHERE exam.id = titles.id AND exam.company_id = :company_id AND exam.clinic_id = :clinic_id
                  AND exam.type = 'softoptic_contact_order' AND exam.deleted_at IS NULL AND exam.test_name = :legacy_title
                RETURNING exam.id, exam.test_name AS title
            )
        """ + " SELECT id, title FROM updated ORDER BY id"
    else:
        statement = CANDIDATES + " SELECT id, title FROM titles ORDER BY id"
    return db.execute(text(statement), params).all()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--clinic-id", type=int, required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    with SessionLocal() as db, db.begin():
        report = backfill_titles(db, args.clinic_id, apply=args.apply)
    print(json.dumps({"clinic_id": args.clinic_id, "applied": args.apply, **report}))


if __name__ == "__main__":
    main()
