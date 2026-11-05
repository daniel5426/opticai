from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator
from sqlalchemy.orm import Session

from auth import get_current_user
from schemas import validate_currency_code
from database import get_db
from models import DiscountDefinition, User
from security.scope import assert_clinic_scope

router = APIRouter(prefix="/discounts", tags=["discounts"])


class DiscountInput(BaseModel):
    description: str = Field(min_length=1, max_length=200)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2, allow_inf_nan=False)
    currency: str

    @field_validator("description")
    @classmethod
    def description_required(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Description is required")
        return value

    @field_validator("currency")
    @classmethod
    def currency_valid(cls, value):
        return validate_currency_code(value)


class DiscountResponse(DiscountInput):
    id: int
    clinic_id: int

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("amount")
    def serialize_amount(self, value: Decimal) -> float:
        return float(value)


def require_edit(user):
    if (user.role_level or 1) < 2:
        raise HTTPException(403, "Access denied")


def scoped_discount(db, user, clinic_id, discount_id):
    assert_clinic_scope(db, user, clinic_id)
    discount = db.query(DiscountDefinition).filter_by(id=discount_id, clinic_id=clinic_id).first()
    if not discount:
        raise HTTPException(404, "Discount not found")
    return discount


@router.get("", response_model=list[DiscountResponse])
def list_discounts(clinic_id: int = Query(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    assert_clinic_scope(db, current_user, clinic_id)
    return db.query(DiscountDefinition).filter_by(clinic_id=clinic_id).order_by(DiscountDefinition.description, DiscountDefinition.id).all()


@router.post("", response_model=DiscountResponse)
def create_discount(payload: DiscountInput, clinic_id: int = Query(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_edit(current_user)
    assert_clinic_scope(db, current_user, clinic_id)
    discount = DiscountDefinition(clinic_id=clinic_id, **payload.model_dump())
    db.add(discount)
    db.commit()
    db.refresh(discount)
    return discount


@router.put("/{discount_id}", response_model=DiscountResponse)
def update_discount(discount_id: int, payload: DiscountInput, clinic_id: int = Query(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_edit(current_user)
    discount = scoped_discount(db, current_user, clinic_id, discount_id)
    for field, value in payload.model_dump().items():
        setattr(discount, field, value)
    db.commit()
    db.refresh(discount)
    return discount


@router.delete("/{discount_id}")
def delete_discount(discount_id: int, clinic_id: int = Query(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_edit(current_user)
    discount = scoped_discount(db, current_user, clinic_id, discount_id)
    db.delete(discount)
    db.commit()
    return {"deleted": True}
