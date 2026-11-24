"""Read exact contact-lens relationships from Soft Optic source links."""
from sqlalchemy import text

from migration.pipeline.common import build_softoptic_contact_check_data, parse_date
from models import ContactLensOrder, MigrationSourceLink

CHECK = "optic_contact_lens_chk.csv"
ORDER = "optic_contact_presc.csv"
CONTACT_ORDER_TYPE = "softoptic_contact_order"
CONTACT_CHECK_TYPE = "softoptic_contact_check"
CONTACT_ORDER_TITLE_PREFIX = "עדשות מגע"
CONTACT_ORDER_TITLE_SQL = """
    CASE WHEN COALESCE(lower(btrim(orders.type)), '') IN ('', 'contact_lens')
         THEN :title_prefix
         ELSE :title_prefix || ' · ' || btrim(orders.type)
    END
"""


def contact_order_title(order_type):
    recorded_type = (order_type or "").strip()
    if not recorded_type or recorded_type.lower() == "contact_lens":
        return CONTACT_ORDER_TITLE_PREFIX
    return f"{CONTACT_ORDER_TITLE_PREFIX} · {recorded_type}"


MISSING_ORDER_ENTRIES = f"""
    WITH represented_orders AS MATERIALIZED (
        SELECT DISTINCT payload->>'order_id' AS order_id
        FROM migration_source_links
        WHERE company_id = :company_id AND (CAST(:clinic_id AS INTEGER) IS NULL OR clinic_id = :clinic_id)
          AND source_system = 'softoptic' AND source_table = 'optic_contact_presc.csv'
          AND target_model = 'OpticalExam' AND payload->>'order_id' IS NOT NULL
    ), missing_orders AS MATERIALIZED (
        SELECT DISTINCT ON (orders.id)
            orders.id AS order_id, orders.company_id, orders.clinic_id, orders.client_id, orders.user_id,
            orders.order_date, source.id AS source_id, {CONTACT_ORDER_TITLE_SQL} AS title
        FROM contact_lens_orders AS orders
        JOIN migration_source_links AS source
          ON source.target_id = orders.id AND source.company_id = orders.company_id AND source.clinic_id = orders.clinic_id
        LEFT JOIN represented_orders AS represented ON represented.order_id = orders.id::text
        WHERE orders.company_id = :company_id AND orders.deleted_at IS NULL
          AND (CAST(:clinic_id AS INTEGER) IS NULL OR orders.clinic_id = :clinic_id)
          AND (CAST(:job_id AS TEXT) IS NULL OR source.migration_job_id = :job_id) AND source.source_system = 'softoptic'
          AND source.source_table = 'optic_contact_presc.csv' AND source.target_model = 'ContactLensOrder'
          AND represented.order_id IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM migration_source_links AS existing
            WHERE existing.company_id = source.company_id AND existing.clinic_id = source.clinic_id
              AND existing.target_model = 'OpticalExam' AND existing.source_system = source.source_system
              AND existing.source_table = source.source_table AND existing.raw_row_ref = source.raw_row_ref
          )
        ORDER BY orders.id, source.id
    )
"""

CREATE_ORDER_ENTRIES = text(MISSING_ORDER_ENTRIES + """
    , assigned AS MATERIALIZED (
        SELECT *, nextval(pg_get_serial_sequence('optical_exams', 'id')) AS exam_id
        FROM missing_orders
    ), created AS (
        INSERT INTO optical_exams (id, company_id, clinic_id, client_id, user_id, exam_date, type, test_name)
        SELECT exam_id, company_id, clinic_id, client_id, user_id, order_date, 'softoptic_contact_order', title
        FROM assigned
        RETURNING id
    )
    INSERT INTO migration_source_links (
        company_id, clinic_id, migration_job_id, source_system, source_table, raw_row_ref,
        source_primary_key_parts, target_model, target_id, raw_payload, raw_payload_sha256, raw_captured_at, payload
    )
    SELECT source.company_id, source.clinic_id, source.migration_job_id, source.source_system, source.source_table,
           source.raw_row_ref, source.source_primary_key_parts, 'OpticalExam', created.id, source.raw_payload,
           source.raw_payload_sha256, source.raw_captured_at, json_build_object('order_id', assigned.order_id)
    FROM assigned
    JOIN created ON created.id = assigned.exam_id
    JOIN migration_source_links AS source ON source.id = assigned.source_id
""")


def create_postgres_order_entries(db, company_id, job_id, clinic_id):
    return db.execute(CREATE_ORDER_ENTRIES, {
        "company_id": company_id, "clinic_id": clinic_id, "job_id": job_id, "title_prefix": CONTACT_ORDER_TITLE_PREFIX,
    }).rowcount


def missing_postgres_order_entries(db, company_id, clinic_id):
    return db.execute(text(MISSING_ORDER_ENTRIES + " SELECT order_id, source_id, title FROM missing_orders ORDER BY order_id"), {
        "company_id": company_id, "clinic_id": clinic_id, "job_id": None, "title_prefix": CONTACT_ORDER_TITLE_PREFIX,
    }).all()


def contact_entry_data(db, exam):
    if exam.type != CONTACT_ORDER_TYPE:
        return None
    links = db.query(MigrationSourceLink).filter_by(
        company_id=exam.company_id, clinic_id=exam.clinic_id, source_system="softoptic",
        target_model="OpticalExam", target_id=exam.id,
    ).filter(MigrationSourceLink.source_table.in_((ORDER, CHECK))).order_by(MigrationSourceLink.id).all()
    order_ids = {(row.payload or {}).get("order_id") for row in links if row.source_table == ORDER}
    order_ids.discard(None)
    if len(order_ids) != 1:
        return None
    order = db.query(ContactLensOrder.id).filter(
        ContactLensOrder.id.in_(order_ids), ContactLensOrder.company_id == exam.company_id,
        ContactLensOrder.clinic_id == exam.clinic_id, ContactLensOrder.client_id == exam.client_id,
        ContactLensOrder.deleted_at.is_(None),
    ).one_or_none()
    if order is None:
        return None
    checks = []
    for row in links:
        if row.source_table == CHECK and row.raw_payload and (row.payload or {}).get("order_id") == order.id:
            checks.append({"id": row.id, "date": parse_date(row.raw_payload.get("last_action")),
                           "data": build_softoptic_contact_check_data(row.raw_payload)})
    return {"order_id": order.id, "checks": checks}


def order_entry_ids(db, company_id, clinic_ids):
    result = {}
    for target_id, payload in db.query(MigrationSourceLink.target_id, MigrationSourceLink.payload).filter(
        MigrationSourceLink.company_id == company_id, MigrationSourceLink.clinic_id.in_(clinic_ids),
        MigrationSourceLink.source_system == "softoptic", MigrationSourceLink.source_table == ORDER,
        MigrationSourceLink.target_model == "OpticalExam",
    ):
        order_id = (payload or {}).get("order_id")
        if order_id is not None:
            result[order_id] = target_id
    return result
