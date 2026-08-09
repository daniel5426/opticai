from __future__ import annotations

from dataclasses import fields, is_dataclass
from datetime import date, datetime, timezone
import hashlib
import json
from pathlib import Path
import sys
from typing import Any, Dict, Iterable, Mapping, Optional, Sequence, Tuple, Type

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

CURRENT_FILE = Path(__file__).resolve()
for path in (CURRENT_FILE.parents[4], CURRENT_FILE.parents[3]):
    path_str = str(path)
    if path_str not in sys.path:
        sys.path.append(path_str)

try:
    from models import (
        Appointment,
        Client,
        ContactLensOrder,
        ExamLayoutInstance,
        Family,
        File,
        MedicalLog,
        MigrationSourceLink,
        OpticalExam,
        Order,
        User,
        WorkShift,
    )
except ModuleNotFoundError:
    from backend.models import (
        Appointment,
        Client,
        ContactLensOrder,
        ExamLayoutInstance,
        Family,
        File,
        MedicalLog,
        MigrationSourceLink,
        OpticalExam,
        Order,
        User,
        WorkShift,
    )

from .records import SourceRef


OPTITECH_SOURCE_SYSTEM = "optitech"
OPTITECH_MAPPING_VERSION = 2
PHASE2_TARGET_MODELS: Dict[str, Type[Any]] = {
    "Client": Client,
    "Family": Family,
    "User": User,
}
TARGET_MODELS: Dict[str, Type[Any]] = {
    **PHASE2_TARGET_MODELS,
    "OpticalExam": OpticalExam,
    "ExamLayoutInstance": ExamLayoutInstance,
    "Order": Order,
    "ContactLensOrder": ContactLensOrder,
    "File": File,
    "MedicalLog": MedicalLog,
    "Appointment": Appointment,
    "WorkShift": WorkShift,
}
RAW_SNAPSHOT_TARGET_MODELS: Tuple[str, ...] = (
    "Client",
    "OpticalExam",
    "Order",
    "ContactLensOrder",
)


def to_jsonable(value: Any) -> Any:
    if isinstance(value, SourceRef):
        # Raw source data is deliberately retained only in raw_payload, never in
        # the existing normalized/mapping diagnostics payload.
        return value.as_dict()
    if is_dataclass(value):
        # Do not call asdict(): it recursively strips SourceRef's type before
        # the branch above can exclude its raw snapshot from diagnostics.
        return {
            item.name: to_jsonable(getattr(value, item.name))
            for item in fields(value)
        }
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, Mapping):
        return {str(key): to_jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [to_jsonable(item) for item in value]
    return value


def raw_payload_hash(raw_payload: Mapping[str, Any]) -> str:
    canonical = json.dumps(
        to_jsonable(raw_payload),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def build_trace_payload(
    normalized_seed: Any,
    target_payload: Mapping[str, Any],
    unmapped_fields: Mapping[str, Any],
) -> Dict[str, Any]:
    return to_jsonable(
        {
            "mapping_version": OPTITECH_MAPPING_VERSION,
            "source_ref": getattr(normalized_seed, "source_ref", None),
            "normalized_seed": normalized_seed,
            "target_payload": dict(target_payload),
            "unmapped_fields": dict(unmapped_fields),
        }
    )


def can_resume_source_link(
    link: Optional[MigrationSourceLink],
    migration_job_id: Optional[str],
) -> bool:
    if link is None:
        return True
    payload = link.payload if isinstance(link.payload, dict) else {}
    return (
        payload.get("mapping_version") == OPTITECH_MAPPING_VERSION
        and migration_job_id is not None
        and link.migration_job_id == migration_job_id
    )


def load_trace_links(
    db: Session,
    *,
    clinic_id: int,
    target_model: str,
    source_table: Optional[str] = None,
    source_system: str = OPTITECH_SOURCE_SYSTEM,
) -> Dict[str, MigrationSourceLink]:
    query = (
        db.query(MigrationSourceLink)
        .filter(MigrationSourceLink.source_system == source_system)
        .filter(MigrationSourceLink.clinic_id == clinic_id)
        .filter(MigrationSourceLink.target_model == target_model)
    )
    if source_table is not None:
        query = query.filter(MigrationSourceLink.source_table == source_table)
    links = query.all()
    return {link.raw_row_ref: link for link in links}


def load_target_rows(
    db: Session,
    *,
    target_model: str,
    target_ids: Iterable[int],
) -> Dict[int, Any]:
    target_by_id: Dict[int, Any] = {}
    model_class = TARGET_MODELS[target_model]
    unique_target_ids = sorted({target_id for target_id in target_ids if target_id is not None})
    if not unique_target_ids:
        return target_by_id
    rows = db.query(model_class).filter(model_class.id.in_(unique_target_ids)).all()
    return {row.id: row for row in rows}


def load_trace_index(
    db: Session,
    *,
    clinic_id: int,
    target_model: str,
    source_system: str = OPTITECH_SOURCE_SYSTEM,
) -> Tuple[Dict[str, MigrationSourceLink], Dict[int, Any]]:
    links_by_raw_ref = load_trace_links(
        db,
        clinic_id=clinic_id,
        target_model=target_model,
        source_system=source_system,
    )
    target_ids = [link.target_id for link in links_by_raw_ref.values() if link.target_id is not None]
    target_by_id: Dict[int, Any] = {}
    if target_ids:
        target_by_id = load_target_rows(db, target_model=target_model, target_ids=target_ids)
    return links_by_raw_ref, target_by_id


def load_phase2_client_identity_map(
    db: Session,
    *,
    clinic_id: int,
    source_system: str = OPTITECH_SOURCE_SYSTEM,
) -> Dict[int, int]:
    rows = db.execute(
        select(MigrationSourceLink.source_per_id, MigrationSourceLink.target_id)
        .where(MigrationSourceLink.source_system == source_system)
        .where(MigrationSourceLink.clinic_id == clinic_id)
        .where(MigrationSourceLink.target_model == "Client")
        .where(MigrationSourceLink.source_per_id.is_not(None))
    ).all()
    existing_targets = load_target_rows(
        db,
        target_model="Client",
        target_ids=[target_id for _, target_id in rows],
    )
    return {
        int(source_per_id): target_id
        for source_per_id, target_id in rows
        if source_per_id is not None and target_id in existing_targets
    }


def load_phase2_user_identity_map(
    db: Session,
    *,
    clinic_id: int,
    source_system: str = OPTITECH_SOURCE_SYSTEM,
) -> Dict[int, int]:
    rows = db.execute(
        select(MigrationSourceLink.source_user_id, MigrationSourceLink.target_id)
        .where(MigrationSourceLink.source_system == source_system)
        .where(MigrationSourceLink.clinic_id == clinic_id)
        .where(MigrationSourceLink.target_model == "User")
        .where(MigrationSourceLink.source_user_id.is_not(None))
    ).all()
    existing_targets = load_target_rows(
        db,
        target_model="User",
        target_ids=[target_id for _, target_id in rows],
    )
    return {
        int(source_user_id): target_id
        for source_user_id, target_id in rows
        if source_user_id is not None and target_id in existing_targets
    }


def get_reverse_link(
    db: Session,
    *,
    target_model: str,
    target_id: int,
    source_system: str = OPTITECH_SOURCE_SYSTEM,
) -> Optional[MigrationSourceLink]:
    return (
        db.query(MigrationSourceLink)
        .filter(MigrationSourceLink.source_system == source_system)
        .filter(MigrationSourceLink.target_model == target_model)
        .filter(MigrationSourceLink.target_id == target_id)
        .first()
    )


def upsert_source_link(
    db: Session,
    *,
    source_ref: SourceRef,
    source_per_id: Optional[int],
    source_user_id: Optional[int],
    target_model: str,
    target_id: int,
    clinic_id: int,
    company_id: int,
    payload: Mapping[str, Any],
    migration_job_id: Optional[str] = None,
    source_system: str = OPTITECH_SOURCE_SYSTEM,
    existing_link: Optional[MigrationSourceLink] = None,
) -> MigrationSourceLink:
    link = existing_link
    if link is None:
        link = MigrationSourceLink(
            source_system=source_system,
            source_table=source_ref.table_name,
            raw_row_ref=source_ref.raw_row_ref or "",
            source_primary_key_parts=to_jsonable(source_ref.as_dict()["primary_key_parts"]),
            source_per_id=source_per_id,
            source_user_id=source_user_id,
            target_model=target_model,
            target_id=target_id,
            clinic_id=clinic_id,
            company_id=company_id,
            payload=to_jsonable(payload),
            migration_job_id=migration_job_id,
            raw_payload=to_jsonable(source_ref.raw_payload)
            if migration_job_id and target_model in RAW_SNAPSHOT_TARGET_MODELS
            else None,
            raw_payload_sha256=raw_payload_hash(source_ref.raw_payload)
            if migration_job_id and target_model in RAW_SNAPSHOT_TARGET_MODELS
            else None,
            raw_captured_at=datetime.now(timezone.utc)
            if migration_job_id and target_model in RAW_SNAPSHOT_TARGET_MODELS
            else None,
        )
        db.add(link)
    else:
        link.source_table = source_ref.table_name
        link.source_primary_key_parts = to_jsonable(source_ref.as_dict()["primary_key_parts"])
        link.source_per_id = source_per_id
        link.source_user_id = source_user_id
        link.target_id = target_id
        link.company_id = company_id
        link.payload = to_jsonable(payload)
        if migration_job_id:
            link.migration_job_id = migration_job_id
        if migration_job_id and target_model in RAW_SNAPSHOT_TARGET_MODELS:
            link.raw_payload = to_jsonable(source_ref.raw_payload)
            link.raw_payload_sha256 = raw_payload_hash(source_ref.raw_payload)
            link.raw_captured_at = datetime.now(timezone.utc)
    return link


def clear_stale_raw_snapshots(
    db: Session,
    *,
    clinic_id: int,
    migration_job_id: str,
    source_system: str = OPTITECH_SOURCE_SYSTEM,
) -> int:
    """Keep only snapshots written by the successfully completed import job."""
    return (
        db.query(MigrationSourceLink)
        .filter(MigrationSourceLink.source_system == source_system)
        .filter(MigrationSourceLink.clinic_id == clinic_id)
        .filter(MigrationSourceLink.target_model.in_(RAW_SNAPSHOT_TARGET_MODELS))
        .filter(MigrationSourceLink.raw_payload.is_not(None))
        .filter(
            or_(
                MigrationSourceLink.migration_job_id.is_(None),
                MigrationSourceLink.migration_job_id != migration_job_id,
            )
        )
        .update(
            {
                MigrationSourceLink.migration_job_id: None,
                MigrationSourceLink.raw_payload: None,
                MigrationSourceLink.raw_payload_sha256: None,
                MigrationSourceLink.raw_captured_at: None,
            },
            synchronize_session=False,
        )
    )


def cleanup_phase2_rows(
    db: Session,
    *,
    clinic_id: int,
    source_system: str = OPTITECH_SOURCE_SYSTEM,
) -> Dict[str, int]:
    links = (
        db.query(MigrationSourceLink)
        .filter(MigrationSourceLink.source_system == source_system)
        .filter(MigrationSourceLink.clinic_id == clinic_id)
        .filter(MigrationSourceLink.target_model.in_(tuple(PHASE2_TARGET_MODELS.keys())))
        .all()
    )
    ids_by_model: Dict[str, list[int]] = {name: [] for name in PHASE2_TARGET_MODELS}
    for link in links:
        ids_by_model.setdefault(link.target_model, []).append(link.target_id)

    deleted_counts: Dict[str, int] = {
        "clients_deleted": 0,
        "families_deleted": 0,
        "users_deleted": 0,
        "trace_links_deleted": 0,
    }
    deletion_order: Sequence[Tuple[str, str]] = (
        ("Client", "clients_deleted"),
        ("Family", "families_deleted"),
        ("User", "users_deleted"),
    )
    for model_name, count_key in deletion_order:
        model_ids = sorted({item for item in ids_by_model.get(model_name, []) if item is not None})
        if not model_ids:
            continue
        model_class = PHASE2_TARGET_MODELS[model_name]
        query = db.query(model_class).filter(model_class.id.in_(model_ids))
        deleted_counts[count_key] = query.count()
        query.delete(synchronize_session=False)
        db.flush()

    if links:
        link_ids = [link.id for link in links]
        deleted_counts["trace_links_deleted"] = (
            db.query(MigrationSourceLink)
            .filter(MigrationSourceLink.id.in_(link_ids))
            .delete(synchronize_session=False)
        )
        db.flush()
    return deleted_counts
