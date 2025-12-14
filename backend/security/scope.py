from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models import Clinic, User


def require_company_id(current_user: User) -> int:
    if current_user.company_id is None:
        raise HTTPException(status_code=403, detail="Access denied")
    return current_user.company_id


def assert_company_scope(current_user: User, company_id: int) -> None:
    if company_id != require_company_id(current_user):
        raise HTTPException(status_code=403, detail="Access denied")


def assert_clinic_belongs_to_company(db: Session, clinic_id: int, company_id: int) -> None:
    row = (
        db.query(Clinic.id)
        .filter(Clinic.id == clinic_id)
        .filter(Clinic.company_id == company_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=403, detail="Access denied")


def normalize_clinic_id_for_company(
    db: Session,
    current_user: User,
    clinic_id: Optional[int],
) -> int:
    company_id = require_company_id(current_user)
    if clinic_id is None:
        if current_user.clinic_id is None:
            raise HTTPException(status_code=400, detail="clinic_id is required")
        clinic_id = current_user.clinic_id
    assert_clinic_belongs_to_company(db, clinic_id, company_id)
    return clinic_id


def resolve_company_id(db: Session, current_user: User) -> int:
    return require_company_id(current_user)

