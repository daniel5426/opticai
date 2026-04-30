from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import Billing, Order, OrderLineItem, ContactLensOrder, User
from auth import get_current_user
from security.scope import (
    get_allowed_clinic_ids,
    get_scoped_billing,
    get_scoped_client,
    get_scoped_contact_lens_order,
    get_scoped_order,
    get_scoped_order_line_item,
)
from schemas import (
    BillingCreate,
    BillingUpdate,
    Billing as BillingSchema,
    OrderLineItem as OrderLineItemSchema,
    OrderLineItemCreate,
    OrderLineItemUpdate,
)

router = APIRouter(prefix="/billing", tags=["billing"])


def _scope_billing_payload(db: Session, current_user: User, payload: dict) -> None:
    if payload.get("order_id"):
        get_scoped_order(db, current_user, payload["order_id"])
    if payload.get("contact_lens_id"):
        get_scoped_contact_lens_order(db, current_user, payload["contact_lens_id"])
    if not payload.get("order_id") and not payload.get("contact_lens_id"):
        raise HTTPException(status_code=422, detail="order_id or contact_lens_id is required")


def _billing_query_for_allowed_clinics(db: Session, allowed_clinic_ids: list[int]):
    return (
        db.query(Billing)
        .outerjoin(Order, Billing.order_id == Order.id)
        .outerjoin(ContactLensOrder, Billing.contact_lens_id == ContactLensOrder.id)
        .filter(
            or_(
                Order.clinic_id.in_(allowed_clinic_ids),
                ContactLensOrder.clinic_id.in_(allowed_clinic_ids),
            )
        )
    )


@router.post("/", response_model=BillingSchema)
def create_billing(
    billing: BillingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    line_items = billing.line_items or []
    billing_data = billing.dict(exclude={"line_items"})
    _scope_billing_payload(db, current_user, billing_data)

    db_billing = Billing(**billing_data)
    db.add(db_billing)
    db.commit()
    db.refresh(db_billing)

    for item in line_items:
        item_data = item.dict()
        item_data["billings_id"] = db_billing.id
        db.add(OrderLineItem(**item_data))
    if line_items:
        db.commit()
    return db_billing


@router.get("/", response_model=List[BillingSchema])
def get_all_billing(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    allowed_clinic_ids = get_allowed_clinic_ids(db, current_user, clinic_id)
    if not allowed_clinic_ids:
        return []
    return _billing_query_for_allowed_clinics(db, allowed_clinic_ids).all()


@router.get("/order/{order_id}", response_model=BillingSchema)
def get_billing_by_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_scoped_order(db, current_user, order_id)
    billing = db.query(Billing).filter(Billing.order_id == order_id).first()
    if not billing:
        raise HTTPException(status_code=404, detail="Billing not found for order")
    return billing


@router.get("/contact-lens/{contact_lens_id}", response_model=BillingSchema)
def get_billing_by_contact_lens(
    contact_lens_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_scoped_contact_lens_order(db, current_user, contact_lens_id)
    billing = db.query(Billing).filter(Billing.contact_lens_id == contact_lens_id).first()
    if not billing:
        raise HTTPException(status_code=404, detail="Billing not found for contact lens order")
    return billing


@router.get("/client/{client_id}", response_model=List[BillingSchema])
def get_billings_by_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_scoped_client(db, current_user, client_id)
    return (
        db.query(Billing)
        .outerjoin(Order, Billing.order_id == Order.id)
        .outerjoin(ContactLensOrder, Billing.contact_lens_id == ContactLensOrder.id)
        .filter(or_(Order.client_id == client_id, ContactLensOrder.client_id == client_id))
        .all()
    )


@router.get("/{billing_id}", response_model=BillingSchema)
def get_billing(
    billing_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_scoped_billing(db, current_user, billing_id)


@router.put("/{billing_id}", response_model=BillingSchema)
def update_billing(
    billing_id: int,
    billing: BillingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_billing = get_scoped_billing(db, current_user, billing_id)
    payload = billing.dict(exclude_unset=True)
    line_items = payload.pop("line_items", None)

    if "order_id" in payload or "contact_lens_id" in payload:
        candidate = {
            "order_id": payload.get("order_id", db_billing.order_id),
            "contact_lens_id": payload.get("contact_lens_id", db_billing.contact_lens_id),
        }
        _scope_billing_payload(db, current_user, candidate)

    for field, value in payload.items():
        setattr(db_billing, field, value)
    db.commit()
    db.refresh(db_billing)

    if line_items is not None:
        existing_items = {
            li.id: li
            for li in db.query(OrderLineItem).filter(OrderLineItem.billings_id == db_billing.id).all()
        }
        for item in line_items:
            if getattr(item, "id", None):
                li = existing_items.get(item.id)
                if not li:
                    continue
                for field, value in item.dict(exclude_unset=True).items():
                    if field in {"id", "billings_id"}:
                        continue
                    setattr(li, field, value)
            else:
                item_data = item.dict(exclude_unset=True)
                item_data["billings_id"] = db_billing.id
                db.add(OrderLineItem(**item_data))
        db.commit()
    return db_billing


@router.delete("/{billing_id}")
def delete_billing(
    billing_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    billing = get_scoped_billing(db, current_user, billing_id)
    db.delete(billing)
    db.commit()
    return {"message": "Billing deleted successfully"}


@router.get("/{billing_id}/line-items", response_model=List[OrderLineItemSchema])
def get_billing_line_items(
    billing_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_scoped_billing(db, current_user, billing_id)
    return db.query(OrderLineItem).filter(OrderLineItem.billings_id == billing_id).all()


ol_router = APIRouter(prefix="/order-line-items", tags=["order-line-items"])


@ol_router.get("/billing/{billing_id}", response_model=List[OrderLineItemSchema])
def get_order_line_items_by_billing(
    billing_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_scoped_billing(db, current_user, billing_id)
    return db.query(OrderLineItem).filter(OrderLineItem.billings_id == billing_id).all()


@ol_router.post("/", response_model=OrderLineItemSchema)
def create_order_line_item(
    item: OrderLineItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_scoped_billing(db, current_user, item.billings_id)
    db_item = OrderLineItem(**item.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


@ol_router.put("/{item_id}", response_model=OrderLineItemSchema)
def update_order_line_item(
    item_id: int,
    item: OrderLineItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_item = get_scoped_order_line_item(db, current_user, item_id)
    payload = item.dict(exclude_unset=True)
    if "billings_id" in payload:
        get_scoped_billing(db, current_user, payload["billings_id"])
    for field, value in payload.items():
        setattr(db_item, field, value)
    db.commit()
    db.refresh(db_item)
    return db_item


@ol_router.delete("/{item_id}")
def delete_order_line_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_item = get_scoped_order_line_item(db, current_user, item_id)
    db.delete(db_item)
    db.commit()
    return {"message": "Order line item deleted successfully"}
