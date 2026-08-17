"""Read-only, scoped access to raw rows captured during a migration."""

from typing import Any, Tuple, Type

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Client, ContactLensOrder, MigrationSourceLink, OpticalExam, Order, User
from security.scope import (
    assert_clinic_scope,
    get_scoped_client,
    get_scoped_contact_lens_order,
    get_scoped_order,
)


router = APIRouter(prefix="/migration-source-data", tags=["migration-source-data"])

_TARGETS: dict[str, Tuple[str, Type[Any]]] = {
    "client": ("Client", Client),
    "exam": ("OpticalExam", OpticalExam),
    "order": ("Order", Order),
    "contact_lens_order": ("ContactLensOrder", ContactLensOrder),
}


def _resolve_scoped_target(
    db: Session,
    current_user: User,
    record_type: str,
    record_id: int,
) -> tuple[str, Any]:
    if record_type == "client":
        return "Client", get_scoped_client(db, current_user, record_id)
    if record_type == "order":
        return "Order", get_scoped_order(db, current_user, record_id)
    if record_type == "contact_lens_order":
        return "ContactLensOrder", get_scoped_contact_lens_order(db, current_user, record_id)
    if record_type == "exam":
        exam = db.get(OpticalExam, record_id)
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found")
        assert_clinic_scope(db, current_user, exam.clinic_id)
        return "OpticalExam", exam
    if record_type not in _TARGETS:
        raise HTTPException(status_code=422, detail="Unsupported record type")
    raise HTTPException(status_code=422, detail="Unsupported record type")


def _raw_links(db: Session, *, target_model: str, target_id: int, clinic_id: int) -> list[MigrationSourceLink]:
    links = (
        db.query(MigrationSourceLink)
        .filter(MigrationSourceLink.target_model == target_model)
        .filter(MigrationSourceLink.target_id == target_id)
        .filter(MigrationSourceLink.clinic_id == clinic_id)
        .filter(MigrationSourceLink.raw_payload.is_not(None))
        .order_by(MigrationSourceLink.raw_captured_at.desc(), MigrationSourceLink.id.desc())
        .all()
    )
    return [link for link in links if isinstance(link.raw_payload, dict)]


@router.get("/{record_type}/{record_id}/summary")
def get_migration_source_data_summary(
    record_type: str,
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_model, target = _resolve_scoped_target(db, current_user, record_type, record_id)
    links = _raw_links(db, target_model=target_model, target_id=target.id, clinic_id=target.clinic_id)
    source_systems = sorted({link.source_system for link in links})
    return {
        "available": bool(links),
        "source_systems": source_systems,
        "row_count": len(links),
        "latest_raw_captured_at": links[0].raw_captured_at.isoformat() if links and links[0].raw_captured_at else None,
    }


@router.get("/{record_type}/{record_id}")
def get_migration_source_data(
    record_type: str,
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_model, target = _resolve_scoped_target(db, current_user, record_type, record_id)
    links = _raw_links(db, target_model=target_model, target_id=target.id, clinic_id=target.clinic_id)
    if not links:
        raise HTTPException(status_code=404, detail="No imported source data is available")
    return {
        "rows": [
            {
                "source_system": link.source_system,
                "source_table": link.source_table,
                "raw_row_ref": link.raw_row_ref,
                "migration_job_id": link.migration_job_id,
                "raw_payload": link.raw_payload,
                "raw_payload_sha256": link.raw_payload_sha256,
                "raw_captured_at": link.raw_captured_at.isoformat() if link.raw_captured_at else None,
            }
            for link in links
        ]
    }
