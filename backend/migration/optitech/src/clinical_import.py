"""Import independent OptiTech clinical exams and attach declared child records."""
from __future__ import annotations

from typing import Any, Mapping

from .clinical_cards import CARD_TYPES, CHILD_CLINICAL_TABLES, CLINICAL_TABLES, build_clinical_data
from .exam_layouts import build_instance_layout_data
from .reader import iter_exported_rows
from .records import NormalizedSeedBase, build_source_ref, parse_access_date, parse_intish
from .repair import merge_layout
from .trace import build_trace_payload, can_resume_source_link, load_trace_links, upsert_source_link


def _date_key(row: Mapping[str, Any]):
    per_id, check_date = parse_intish(row.get("PerId")), parse_access_date(row.get("CheckDate"))
    return (per_id, check_date.isoformat()) if per_id is not None and check_date else None


def _parent_key(table: str, row: Mapping[str, Any]):
    if table == "tblCrdFrps":
        value = parse_intish(row.get("FrpId"))
        return (value,) if value is not None else None
    return _date_key(row)


def _parent_instance_index(db, clinic_id: int, source_table: str):
    result = {}
    links = load_trace_links(db, clinic_id=clinic_id, target_model="ExamLayoutInstance", source_table=source_table)
    for link in links.values():
        raw = link.raw_payload if isinstance(link.raw_payload, dict) else {}
        if not raw:
            raw = {
                str(item.get("column")): item.get("value")
                for item in (link.source_primary_key_parts or [])
                if isinstance(item, dict) and item.get("column")
            }
            if link.source_per_id is not None:
                raw.setdefault("PerId", link.source_per_id)
        key = _parent_key(source_table, raw)
        if key is not None:
            result[key] = link
    return result


def _create_standalone(db, *, clinic, client_map, user_map, table, kind, row, ref, migration_job_id, catalog):
    from .phase3 import ExamLayoutInstance, OpticalExam

    per_id, user_id = parse_intish(row.get("PerId")), parse_intish(row.get("UserId"))
    exam_date = parse_access_date(row.get("CheckDate") or row.get("FrpDate") or row.get("LineDate"))
    if per_id not in client_map or exam_date is None:
        return None
    exam = OpticalExam(
        client_id=client_map[per_id], clinic_id=clinic.id, clinic=clinic.name,
        user_id=user_map.get(user_id), exam_date=exam_date, test_name=f"OptiTech {kind}",
        type="opticlens" if kind in {"ortho-k", "replacement-plan", "replacement-plan-line", "contact-lens-fitting"} else "exam",
    )
    db.add(exam)
    db.flush()
    instance = ExamLayoutInstance(exam_id=exam.id, is_active=True, order=0, exam_data={})
    db.add(instance)
    db.flush()
    instance.exam_data = build_clinical_data(table, row, instance.id, catalog, repeated=table in CHILD_CLINICAL_TABLES)
    instance.layout_data = build_instance_layout_data(CARD_TYPES, instance.exam_data)
    seed = NormalizedSeedBase(source_ref=ref, source_per_id=per_id, source_user_id=user_id)
    for model, target, payload in (
        ("OpticalExam", exam, {"exam_date": exam_date, "test_name": exam.test_name}),
        ("ExamLayoutInstance", instance, {"exam_data": instance.exam_data, "layout_data": instance.layout_data}),
    ):
        upsert_source_link(
            db, source_ref=ref, source_per_id=per_id, source_user_id=user_id, target_model=model,
            target_id=target.id, clinic_id=clinic.id, company_id=clinic.company_id,
            payload=build_trace_payload(seed, payload, {}), migration_job_id=migration_job_id,
        )
    return exam, instance


def import_clinical_exams(db, *, clinic, client_map, user_map, migration_job_id, catalog=None, commit_each_batch=False, preserve_existing=False):
    from .phase3 import DomainCounters, ExamLayoutInstance, OpticalExam, emit_batch_progress

    counts = {"processed": 0, "created": 0, "updated": 0, "skipped": 0, "attached": 0, "default_only": 0, "unresolved_parent": 0}
    skips = []
    catalog = catalog or {}

    def checkpoint():
        db.flush()
        if commit_each_batch:
            db.commit()
        emit_batch_progress("clinical_exams", DomainCounters(**{key: counts[key] for key in ("processed", "created", "updated", "skipped")}))

    for table, kind in CLINICAL_TABLES.items():
        exam_links = load_trace_links(db, clinic_id=clinic.id, target_model="OpticalExam", source_table=table)
        instance_links = load_trace_links(db, clinic_id=clinic.id, target_model="ExamLayoutInstance", source_table=table)
        for row in iter_exported_rows(table):
            counts["processed"] += 1
            ref = build_source_ref(table, row)
            per_id = parse_intish(row.get("PerId"))
            exam_date = parse_access_date(row.get("CheckDate") or row.get("FrpDate"))
            data = build_clinical_data(table, row, 0, catalog)
            link, ilink = exam_links.get(ref.raw_row_ref), instance_links.get(ref.raw_row_ref)
            reason = None
            if per_id not in client_map:
                reason = "missing_phase2_client_mapping"
            elif exam_date is None:
                reason = "missing_exam_date"
            elif not data:
                reason = "default_only_record"
                counts["default_only"] += 1
            elif any(item and not can_resume_source_link(item, migration_job_id) for item in (link, ilink)):
                reason = "existing_non_resumable_import"
            if reason:
                counts["skipped"] += 1
                skips.append({"domain": "clinical_exams", "source_table": table, "raw_row_ref": ref.raw_row_ref, "reason": reason})
                continue
            if preserve_existing and link and ilink:
                counts["skipped"] += 1
                skips.append({"domain": "clinical_exams", "source_table": table, "raw_row_ref": ref.raw_row_ref, "reason": "existing_record_preserved"})
                continue
            if link or ilink:
                exam = db.get(OpticalExam, link.target_id) if link else None
                instance = db.get(ExamLayoutInstance, ilink.target_id) if ilink else None
                if exam is not None and instance is not None:
                    instance.exam_data = build_clinical_data(table, row, instance.id, catalog)
                    instance.layout_data = merge_layout(instance.layout_data, build_instance_layout_data(CARD_TYPES, instance.exam_data))
                    counts["updated"] += 1
                    continue
            if _create_standalone(db, clinic=clinic, client_map=client_map, user_map=user_map, table=table,
                                  kind=kind, row=row, ref=ref, migration_job_id=migration_job_id, catalog=catalog):
                counts["created"] += 1
        checkpoint()

    parent_tables = {metadata[0] for metadata in CHILD_CLINICAL_TABLES.values()}
    parent_indexes = {table: _parent_instance_index(db, clinic.id, table) for table in parent_tables}
    for table, (parent_table, kind, _component) in CHILD_CLINICAL_TABLES.items():
        child_links = load_trace_links(db, clinic_id=clinic.id, target_model="ExamLayoutInstance", source_table=table)
        for row in iter_exported_rows(table):
            counts["processed"] += 1
            ref = build_source_ref(table, row)
            card_data = build_clinical_data(table, row, 0, catalog, repeated=True)
            if not card_data:
                counts["skipped"] += 1
                counts["default_only"] += 1
                skips.append({"domain": "clinical_exams", "source_table": table, "raw_row_ref": ref.raw_row_ref, "reason": "default_only_record"})
                continue
            existing = child_links.get(ref.raw_row_ref)
            if existing and not can_resume_source_link(existing, migration_job_id):
                counts["skipped"] += 1
                skips.append({"domain": "clinical_exams", "source_table": table, "raw_row_ref": ref.raw_row_ref, "reason": "existing_non_resumable_import"})
                continue
            key = (parse_intish(row.get("FrpId")),) if parent_table == "tblCrdFrps" else _date_key(row)
            parent_link = parent_indexes[parent_table].get(key)
            if parent_link is None:
                counts["unresolved_parent"] += 1
                created = _create_standalone(db, clinic=clinic, client_map=client_map, user_map=user_map, table=table,
                    kind=kind, row=row, ref=ref, migration_job_id=migration_job_id, catalog=catalog)
                reason = "missing_parent_preserved_standalone" if created else "missing_parent_unresolvable"
                counts["created" if created else "skipped"] += 1
                skips.append({"domain": "clinical_exams", "source_table": table, "raw_row_ref": ref.raw_row_ref, "reason": reason})
                continue
            if preserve_existing and existing and existing.target_id == parent_link.target_id:
                counts["skipped"] += 1
                skips.append({"domain": "clinical_exams", "source_table": table, "raw_row_ref": ref.raw_row_ref, "reason": "existing_card_preserved"})
                continue
            instance = db.get(ExamLayoutInstance, parent_link.target_id)
            if instance is None:
                counts["skipped"] += 1
                skips.append({"domain": "clinical_exams", "source_table": table, "raw_row_ref": ref.raw_row_ref, "reason": "missing_parent_target"})
                continue
            card_data = build_clinical_data(table, row, instance.id, catalog, repeated=True)
            merged = dict(instance.exam_data or {})
            merged.update(card_data)
            instance.exam_data = merged
            instance.layout_data = merge_layout(instance.layout_data, build_instance_layout_data(CARD_TYPES, card_data))
            seed = NormalizedSeedBase(source_ref=ref, source_per_id=parse_intish(row.get("PerId")), source_user_id=parse_intish(row.get("UserId")))
            saved = upsert_source_link(
                db, source_ref=ref, source_per_id=seed.source_per_id, source_user_id=seed.source_user_id,
                target_model="ExamLayoutInstance", target_id=instance.id, clinic_id=clinic.id,
                company_id=clinic.company_id,
                payload=build_trace_payload(seed, {"exam_data": card_data}, {"parent_source_table": parent_table, "parent_raw_row_ref": parent_link.raw_row_ref}),
                migration_job_id=migration_job_id, existing_link=existing,
            )
            child_links[saved.raw_row_ref] = saved
            counts["attached"] += 1
        checkpoint()
    return counts, skips
