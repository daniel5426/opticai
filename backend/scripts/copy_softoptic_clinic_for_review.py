"""Copy one production clinic's clinical history to a fresh staging clinic.

The default reports the scope. --execute commits the copy atomically.
Patient labels use the source client ID. Contact details, attachments, narrative
fields, staff accounts, billing and notifications are outside the review copy.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import os
from pathlib import Path

from dotenv import dotenv_values
from psycopg2 import Error, sql
from sqlalchemy import JSON, MetaData, Table, and_, create_engine, func, insert, or_, select, text, update
from sqlalchemy.engine import make_url

from migration.pipeline.common import _source_snapshot_hash

PRODUCTION = "ncmcwspdjtyetwfijahj"
STAGING = "eoyqvffwzllggemzfxaw"
COPY_KEY = "softoptic-review"
CONTACT_TABLES = ("clients", "optical_exams", "contact_lens_orders", "orders")
PRIVATE_TEXT_KEYS = ("remark", "note", "comment", "address", "phone", "email", "name", "national_id", "memo")


def target_identity(value, project):
    url = make_url(value)
    if not (url.get_backend_name() == "postgresql" and url.database == "postgres" and (
        (url.host == f"db.{project}.supabase.co" and url.username == "postgres") or
        (url.host == "aws-0-eu-central-1.pooler.supabase.com" and url.username == f"postgres.{project}")
    )):
        raise SystemExit(f"Unexpected database target for project {project}")
    return url


def preview_json(data):
    if isinstance(data, list):
        return [preview_json(item) for item in data]
    if not isinstance(data, dict):
        return data
    result = {}
    for key, value in data.items():
        field = key.lower()
        reflex = field in {"obj_right_remarks", "obj_left_remarks"}
        source_title = field in {"test_reason", "visit_reason"}
        if isinstance(value, str) and value.strip() and any(token in field for token in PRIVATE_TEXT_KEYS) and not (reflex or source_title):
            result[key] = None
        else:
            result[key] = preview_json(value)
    return result


def project_rows(connection, query, batch=2400):
    with connection.execution_options(yield_per=batch).execute(query) as result:
        for rows in result.mappings().partitions(batch):
            yield rows


def copy_values(target, table, values):
    fields = tuple(values[0])
    json_fields = {field for field in fields if isinstance(table.c[field].type, JSON)}
    buffer = io.StringIO()
    csv.writer(buffer, quoting=csv.QUOTE_NOTNULL).writerows(
        [json.dumps(row[field], ensure_ascii=False) if field in json_fields and row[field] is not None else row[field]
         for field in fields]
        for row in values
    )
    buffer.seek(0)
    command = sql.SQL("COPY {} ({}) FROM STDIN WITH (FORMAT CSV)").format(
        sql.Identifier(table.schema or "public", table.name),
        sql.SQL(", ").join(sql.Identifier(field) for field in fields),
    )
    with target.connection.cursor() as cursor:
        try:
            cursor.copy_expert(command.as_string(cursor), buffer)
        except Error as error:
            raise RuntimeError(f"Copy failed for {table.name} with PostgreSQL status {error.pgcode}") from None


def copy_rows(source, target, query, target_table, prepare):
    ids = {}
    sequence = target.scalar(text("SELECT pg_get_serial_sequence(:table, 'id')"), {"table": target_table.name})
    if sequence is None:
        raise ValueError(f"Missing ID sequence for {target_table.name}")
    for rows in project_rows(source, query):
        new_ids = target.scalars(text(
            "SELECT nextval(CAST(:sequence AS regclass)) FROM generate_series(1, :size)",
        ), {"sequence": sequence, "size": len(rows)}).all()
        values = [{"id": new_id, **prepare(dict(row))} for row, new_id in zip(rows, new_ids, strict=True)]
        copy_values(target, target_table, values)
        ids.update(zip((row["id"] for row in rows), new_ids, strict=True))
    print(f"Prepared {len(ids):,} {target_table.name}", flush=True)
    return ids


def compatible_values(row, dst, **overrides):
    denied = {"id", "deleted_at", "deleted_by_user_id", "trash_item_id"}
    out = {key: value for key, value in row.items() if key in dst.c and key not in denied}
    out.update(overrides)
    return out


def scoped(table, clinic_id, company_id):
    columns = table.c
    condition = and_(columns.clinic_id == clinic_id, columns.company_id == company_id)
    if "deleted_at" in columns:
        condition = and_(condition, columns.deleted_at.is_(None))
    return condition


def clone(source, target, source_clinic_id, target_email, execute):
    source_md, target_md = MetaData(), MetaData()

    def src(name):
        existing = source_md.tables.get(name)
        return existing if existing is not None else Table(name, source_md, autoload_with=source, resolve_fks=False)

    def dst(name):
        existing = target_md.tables.get(name)
        return existing if existing is not None else Table(name, target_md, autoload_with=target, resolve_fks=False)

    clinics = src("clinics")
    from_clinic = source.execute(select(clinics).where(clinics.c.id == source_clinic_id)).mappings().one()
    from_company = from_clinic["company_id"]
    if (source_clinic_id, from_company) != (11, 6):
        raise SystemExit("The source clinic does not match the approved Harel clinic")
    users, staging_clinics = dst("users"), dst("clinics")
    owner = target.execute(select(users.c.id, users.c.company_id).where(
        func.lower(users.c.email) == target_email.lower(), users.c.is_active.is_(True), users.c.role_level >= 4,
    )).mappings().one()
    to_company = owner["company_id"]
    if to_company != 28:
        raise SystemExit("The staging reviewer does not match the approved destination company")
    slug = f"{COPY_KEY}-source-{source_clinic_id}-company-{to_company}"
    if execute:
        target.execute(text("SELECT pg_advisory_xact_lock(hashtext(:key))"), {"key": slug})
    found_id = target.execute(select(staging_clinics.c.id).where(staging_clinics.c.unique_id == slug)).scalar_one_or_none()
    if found_id is not None:
        return {"staging_clinic_id": found_id, "status": "existing", "target_company_id": to_company}

    source_queries = {name: select(src(name)).where(scoped(src(name), source_clinic_id, from_company))
                      for name in CONTACT_TABLES}
    client = src("clients")
    related_clients = [query.with_only_columns(src(name).c.client_id, maintain_column_froms=True)
                       for name, query in source_queries.items() if name != "clients"]
    source_queries["clients"] = select(client).where(
        client.c.company_id == from_company, client.c.deleted_at.is_(None),
        or_(client.c.clinic_id == source_clinic_id, *(client.c.id.in_(ids) for ids in related_clients)),
    )
    # Only copy records whose client is part of the review clinic.
    client_ids_query = source_queries["clients"].with_only_columns(client.c.id)
    for name in CONTACT_TABLES[1:]:
        source_queries[name] = source_queries[name].where(src(name).c.client_id.in_(client_ids_query))
    if not execute:
        return {"status": "preview", "target_company_id": to_company, "counts": {
            name: source.execute(select(func.count()).select_from(query.subquery())).scalar_one()
            for name, query in source_queries.items()
        }}

    clinic_name = "אופטיקה הראל · בדיקת Soft Optic (Staging)"
    clinic_id = target.execute(insert(staging_clinics).returning(staging_clinics.c.id), {
        "company_id": to_company, "unique_id": slug, "name": clinic_name, "clinic_name": clinic_name,
        "is_active": True, "maintenance_mode": False,
    }).scalar_one()
    fields = ("primary_theme_color", "secondary_theme_color", "va_test_distance", "appointment_duration")
    settings = src("settings")
    source_settings = source.execute(select(settings).where(
        settings.c.clinic_id == source_clinic_id,
    ).order_by(settings.c.id).limit(1)).mappings().first() or {}
    target.execute(insert(dst("settings")), {
        **{key: source_settings[key] for key in fields if source_settings.get(key) is not None},
        "clinic_id": clinic_id, "clinic_name": clinic_name, "send_email_before_appointment": False,
    })

    layout, instance = src("exam_layouts"), src("exam_layout_instances")
    exam_ids_query = source_queries["optical_exams"].with_only_columns(src("optical_exams").c.id)
    source_instances = select(instance).where(instance.c.exam_id.in_(exam_ids_query))
    layouts = select(layout).where(or_(layout.c.clinic_id == source_clinic_id,
        layout.c.id.in_(source_instances.with_only_columns(instance.c.layout_id))))
    layout_parents = {}
    dst_layouts = dst("exam_layouts")

    def prepare_layout(row):
        layout_parents[row["id"]] = row["parent_layout_id"]
        return compatible_values(row, dst_layouts, clinic_id=clinic_id, parent_layout_id=None,
                                 seed_key=None, is_seeded_default=False)

    layout_map = copy_rows(source, target, layouts.order_by(layout.c.id), dst_layouts, prepare_layout)
    for old, parent in layout_parents.items():
        if parent in layout_map:
            target.execute(update(dst_layouts).where(dst_layouts.c.id == layout_map[old]).values(parent_layout_id=layout_map[parent]))

    dst_clients = dst("clients")
    def prepare_client(row):
        return {"company_id": to_company, "clinic_id": clinic_id, "first_name": "Soft Optic",
                "last_name": str(row["id"]), "gender": row["gender"], "send_notifications": False}

    client_map = copy_rows(source, target, source_queries["clients"].order_by(client.c.id), dst_clients, prepare_client)
    maps = {"Client": client_map}
    for name, model in (("optical_exams", "OpticalExam"), ("contact_lens_orders", "ContactLensOrder"), ("orders", "Order")):
        out_table = dst(name)

        def prepare(row):
            values = compatible_values(row, out_table, company_id=to_company, clinic_id=clinic_id,
                                       client_id=client_map[row["client_id"]], user_id=None)
            for optional in ("creation_key", "creation_request_hash", "supply_in_clinic_id", "advisor", "deliverer",
                             "lens_id", "frame_id", "notes", "supplier_notes"):
                if optional in out_table.c:
                    values[optional] = None
            if "order_data" in values:
                values["order_data"] = preview_json(values["order_data"])
            return values

        maps[model] = copy_rows(source, target, source_queries[name].order_by(src(name).c.id), out_table, prepare)
    dst_instances = dst("exam_layout_instances")
    instance_ids = copy_rows(source, target, source_instances.order_by(instance.c.id), dst_instances, lambda row:
        compatible_values(row, dst_instances, exam_id=maps["OpticalExam"][row["exam_id"]],
                          layout_id=layout_map.get(row["layout_id"]), exam_data=preview_json(row["exam_data"]))
    )

    jobs = dst("softoptic_migration_jobs")
    job_id = slug
    target.execute(insert(jobs), {
        "id": job_id, "clinic_id": clinic_id, "company_id": to_company, "user_id": owner["id"],
        "source_system": "softoptic", "status": "completed", "step": "completed", "progress": 100,
        "source_metadata": {"review_copy": True, "source_clinic_id": source_clinic_id},
        "export_summary": {}, "validation_summary": {}, "import_summary": {}, "checkpoint": {},
        "warnings": [], "errors": [], "include_documents": False, "pause_requested": False, "attempt_count": 0,
    })
    link = src("migration_source_links")
    dst_links = dst("migration_source_links")
    link_query = select(link).where(
        scoped(link, source_clinic_id, from_company), link.c.source_system == "softoptic",
        link.c.target_model.in_(maps),
    ).order_by(link.c.id)
    count_links = 0
    for rows in project_rows(source, link_query, batch=1500):
        values = []
        for row in rows:
            dest = maps[row["target_model"]].get(row["target_id"])
            if dest is None:
                continue
            raw = preview_json(row["raw_payload"]) if row["target_model"] != "Client" else None
            payload = {"review_copy": True}
            order_source_id = (row["payload"] or {}).get("order_id")
            if order_source_id in maps["ContactLensOrder"]:
                payload["order_id"] = maps["ContactLensOrder"][order_source_id]
            values.append(compatible_values(row, dst_links, target_id=dest, clinic_id=clinic_id,
                company_id=to_company, migration_job_id=job_id, raw_payload=raw,
                raw_payload_sha256=_source_snapshot_hash(raw) if raw is not None else None,
                raw_captured_at=row["raw_captured_at"] if raw is not None else None, payload=payload))
        if values:
            copy_values(target, dst_links, values)
            count_links += len(values)
    return {
        "status": "copied", "target_company_id": to_company, "staging_clinic_id": clinic_id, "migration_job_id": job_id,
        "counts": {**{model: len(ids) for model, ids in maps.items()}, "ExamLayout": len(layout_map),
                   "ExamLayoutInstance": len(instance_ids), "MigrationSourceLink": count_links},
        "review_clients": {old: client_map.get(old) for old in (76521, 76616)},
        "review_exams": {old: maps["OpticalExam"].get(old) for old in (208989, 208991, 202807, 214137)},
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-clinic", required=True, type=int)
    parser.add_argument("--target-email", required=True)
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    env = dotenv_values(Path(__file__).resolve().parents[1] / ".env")
    production = target_identity(os.environ.get("SOFTOPTIC_COPY_SOURCE_URL") or env["PRODUCTION_DATABASE_URL"], PRODUCTION)
    staging = target_identity(env["DATABASE_URL"], STAGING)
    read_engine = create_engine(production, connect_args={"connect_timeout": 10}, hide_parameters=True, isolation_level="REPEATABLE READ")
    write_engine = create_engine(staging, connect_args={"connect_timeout": 10}, hide_parameters=True)
    with read_engine.begin() as source, write_engine.begin() as target:
        source.execute(text("SET TRANSACTION READ ONLY"))
        source.execute(text("SET LOCAL statement_timeout = '120s'"))
        target.execute(text("SET LOCAL lock_timeout = '3s'"))
        if not args.execute:
            target.execute(text("SET TRANSACTION READ ONLY"))
        result = clone(source, target, args.source_clinic, args.target_email, args.execute)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
