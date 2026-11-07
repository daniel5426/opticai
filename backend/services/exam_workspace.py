"""One locked transaction for an exam draft, including its measurement instances."""
from datetime import datetime, timezone
from hashlib import sha256
import json

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from models import Client, ExamLayout, ExamLayoutInstance, OpticalExam
from security.scope import apply_clinic_user_scope, assert_record_scope, resolve_company_id
from services.legacy_exam_compatibility import preserve_unrepresented_components, preserve_unrepresented_layout
from services.prism_axis_compatibility import normalize_prism_axis_exam_data
from services.prescription_search_index import rebuild_exam_instance_index

EXAM_FIELDS = ("id", "company_id", "client_id", "clinic_id", "user_id", "exam_date", "test_name", "dominant_eye", "type")


def lock_exam(db, user, exam_id):
    exam = db.query(OpticalExam).populate_existing().filter(OpticalExam.id == exam_id).with_for_update().first()
    if not exam:
        raise HTTPException(404, "Exam not found")
    assert_record_scope(db, user, exam)
    return exam


def lock_instance_exam(db, user, instance_id):
    # Read only identity before acquiring the parent; every writer uses this lock order.
    exam_id = db.query(ExamLayoutInstance.exam_id).filter(ExamLayoutInstance.id == instance_id).scalar()
    if not exam_id:
        raise HTTPException(404, "Exam layout instance not found")
    return lock_exam(db, user, exam_id)


def exam_dict(exam):
    return {key: getattr(exam, key) for key in EXAM_FIELDS}


def instance_dict(instance):
    return {"instance": {key: getattr(instance, key) for key in ("id", "layout_id", "layout_data", "order", "is_active")},
            "exam_data": normalize_prism_axis_exam_data(instance.exam_data or {})}


def digest(value):
    return sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str).encode()).hexdigest()


def save_token(exam, instances):
    return digest({"exam": exam_dict(exam), "instances": [
        {key: getattr(row, key) for key in ("id", "layout_id", "layout_data", "order", "exam_data")}
        for row in sorted(instances, key=lambda item: item.id)]})


def save_workspace(db, user, payload, request, exam_id=None, creation_key=None):
    if (user.role_level or 1) < 2:
        raise HTTPException(403, "Editing permission is required")
    data = payload.model_dump(exclude_unset=True)
    fingerprint = digest(data)
    company_id = resolve_company_id(db, user)
    try:
        if exam_id is None:
            if not creation_key or len(creation_key) > 64:
                raise HTTPException(422, "An Idempotency-Key is required")
            existing = db.query(OpticalExam).execution_options(include_deleted=True).filter_by(
                company_id=company_id, creation_key=creation_key).first()
            if existing:
                return creation_replay(db, user, existing, fingerprint, data)
            fields = data["exam"]
            if not fields.get("client_id"):
                raise HTTPException(422, "client_id is required")
            exam = OpticalExam(**apply_clinic_user_scope(db, user, fields),
                               creation_key=creation_key, creation_request_hash=fingerprint)
            db.add(exam)
            db.flush()
            rows = []
        else:
            exam = lock_exam(db, user, exam_id)
            rows = db.query(ExamLayoutInstance).populate_existing().filter_by(exam_id=exam.id).order_by(ExamLayoutInstance.id).with_for_update().all()
            if not payload.save_token or payload.save_token != save_token(exam, rows):
                raise HTTPException(409, "exam_save_conflict")
            fields = data["exam"]
            for identity in ("client_id", "clinic_id"):
                if identity in fields and fields[identity] != getattr(exam, identity):
                    raise HTTPException(422, "Exam identity cannot change")
            scoped = apply_clinic_user_scope(db, user, {**exam_dict(exam), **fields})
            for key in fields:
                if key not in ("id", "company_id", "client_id", "clinic_id"):
                    setattr(exam, key, scoped[key])

        by_id = {row.id: row for row in rows}
        removed = set(payload.removed_instance_ids)
        if len(removed) != len(payload.removed_instance_ids) or not removed.issubset(by_id):
            raise HTTPException(422, "Invalid removed instances")
        keys = {str(row.id): row.id for row in rows if row.id not in removed}
        touched = []
        seen = set()
        for item in payload.instances:
            if item.client_key in seen:
                raise HTTPException(422, "Duplicate instance client key")
            seen.add(item.client_key)
            if item.id:
                row = by_id.get(item.id)
                if not row or item.id in removed or any(other.id == item.id for other in touched):
                    raise HTTPException(422, "Instance does not belong to exam")
                if item.client_key in keys and keys[item.client_key] != item.id:
                    raise HTTPException(422, "Invalid instance client key")
            else:
                if item.client_key in keys:
                    raise HTTPException(422, "Duplicate instance client key")
                layout = db.get(ExamLayout, item.layout_id) if item.layout_id else None
                if not layout or layout.is_group or not layout.is_active or layout.clinic_id not in (None, exam.clinic_id):
                    raise HTTPException(422, "Invalid exam layout")
                row = ExamLayoutInstance(exam_id=exam.id, layout_id=layout.id, layout_data=layout.layout_data,
                                         order=len(rows), is_active=False, exam_data={})
                db.add(row)
                db.flush()
                rows.append(row)
                by_id[row.id] = row
            original = row.exam_data or {}
            incoming = {key: ({**value, "layout_instance_id": row.id} if isinstance(value, dict) and "layout_instance_id" in value else value)
                        for key, value in item.exam_data.items()}
            row.exam_data = preserve_unrepresented_components(original, normalize_prism_axis_exam_data(incoming), request)
            if "layout_data" in item.model_fields_set and item.layout_data is not None:
                row.layout_data = preserve_unrepresented_layout(row.layout_data, item.layout_data, request)
            keys[item.client_key] = row.id
            touched.append(row)
            # Metadata can change indexed source dates even when measurements do not.
            if row.exam_data != original or not item.id or fields.get("exam_date") is not None:
                rebuild_exam_instance_index(db, row)

        for instance_id in removed:
            db.delete(by_id[instance_id])
        live = [row for row in rows if row.id not in removed]
        if payload.instance_order is not None:
            order = payload.instance_order
            ids = [keys.get(key) for key in order]
            if len(set(ids)) != len(ids) or set(ids) != {row.id for row in live}:
                raise HTTPException(422, "Invalid instance order")
            for position, instance_id in enumerate(ids):
                row = by_id[instance_id]
                if row.order != position:
                    row.order = position
                    if row not in touched:
                        touched.append(row)
        if payload.active_client_key is not None:
            active_id = keys.get(payload.active_client_key)
            if active_id not in {row.id for row in live}:
                raise HTTPException(422, "Invalid active instance")
            for row in live:
                row.is_active = row.id == active_id
        if fields.get("exam_date") is not None:
            for row in live:
                if row not in touched:
                    rebuild_exam_instance_index(db, row)
        client = db.get(Client, exam.client_id)
        client.client_updated_date = datetime.now(timezone.utc)
        client.ai_exam_state = None
        db.flush()
        result = {"exam": exam_dict(exam), "instances": [instance_dict(row) for row in touched],
                  "removed_instance_ids": sorted(removed), "client_keys": keys, "save_token": save_token(exam, live)}
        db.commit()
        return result
    except IntegrityError:
        db.rollback()
        if exam_id is None:
            existing = db.query(OpticalExam).execution_options(include_deleted=True).filter_by(company_id=company_id, creation_key=creation_key).first()
            if existing:
                return creation_replay(db, user, existing, fingerprint, data)
        raise
    except Exception:
        db.rollback()
        raise


def creation_replay(db, user, exam, fingerprint, data):
    assert_record_scope(db, user, exam)
    if exam.deleted_at is not None or exam.creation_request_hash != fingerprint:
        raise HTTPException(409, "exam_creation_conflict")
    exam = lock_exam(db, user, exam.id)
    rows = db.query(ExamLayoutInstance).filter_by(exam_id=exam.id).order_by(ExamLayoutInstance.id).all()
    keys = {str(row.id): row.id for row in rows}
    created = [item for item in data.get("instances", []) if not item.get("id")]
    if len(rows) < len(created):
        raise HTTPException(409, "exam_creation_conflict")
    keys.update({item["client_key"]: row.id for item, row in zip(created, rows)})
    return {"exam": exam_dict(exam), "instances": [instance_dict(row) for row in rows],
            "removed_instance_ids": [], "client_keys": keys, "save_token": save_token(exam, rows)}
