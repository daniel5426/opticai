from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import Billing, Order, OrderLineItem, ContactLensOrder
from schemas import (
    BillingCreate,
    BillingUpdate,
    Billing as BillingSchema,
    OrderLineItem as OrderLineItemSchema,
    OrderLineItemCreate,
    OrderLineItemUpdate,
)

router = APIRouter(prefix="/billing", tags=["billing"])

@router.post("/", response_model=BillingSchema)
def create_billing(billing: BillingCreate, db: Session = Depends(get_db)):
    line_items = billing.line_items or []
    billing_data = billing.dict(exclude={"line_items"})
    db_billing = Billing(**billing_data)
    db.add(db_billing)
    db.commit()
    db.refresh(db_billing)

    for item in line_items:
        db_item = OrderLineItem(**{**item.dict(), "billings_id": db_billing.id})
        db.add(db_item)
    if line_items:
        db.commit()
    return db_billing

@router.get("/{billing_id}", response_model=BillingSchema)
def get_billing(billing_id: int, db: Session = Depends(get_db)):
    billing = db.query(Billing).filter(Billing.id == billing_id).first()
    if not billing:
        raise HTTPException(status_code=404, detail="Billing not found")
    return billing

@router.get("/", response_model=List[BillingSchema])
def get_all_billing(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    db: Session = Depends(get_db)
):
    query = db.query(Billing)
    if clinic_id:
        # This would need to be joined with orders to filter by clinic_id
        # For now, returning all billing records
        pass
    return query.all()

@router.get("/order/{order_id}", response_model=BillingSchema)
def get_billing_by_order(order_id: int, db: Session = Depends(get_db)):
    billing = db.query(Billing).filter(Billing.order_id == order_id).first()
    if not billing:
        raise HTTPException(status_code=404, detail="Billing not found for order")
    return billing

@router.get("/contact-lens/{contact_lens_id}", response_model=BillingSchema)
def get_billing_by_contact_lens(contact_lens_id: int, db: Session = Depends(get_db)):
    billing = db.query(Billing).filter(Billing.contact_lens_id == contact_lens_id).first()
    if not billing:
        raise HTTPException(status_code=404, detail="Billing not found for contact lens order")
    return billing


@router.put("/{billing_id}", response_model=BillingSchema)
def update_billing(billing_id: int, billing: BillingUpdate, db: Session = Depends(get_db)):
    db_billing = db.query(Billing).filter(Billing.id == billing_id).first()
    if not db_billing:
        raise HTTPException(status_code=404, detail="Billing not found")
    
    payload = billing.dict(exclude_unset=True)
    line_items = payload.pop("line_items", None)
    for field, value in payload.items():
        setattr(db_billing, field, value)
    db.commit()
    db.refresh(db_billing)

    if line_items is not None:
        existing_items = {li.id: li for li in db.query(OrderLineItem).filter(OrderLineItem.billings_id == db_billing.id).all()}
        updated_ids = set()
        for item in line_items:
            if getattr(item, "id", None):
                li = existing_items.get(item.id)
                if not li:
                    continue
                for field, value in item.dict(exclude_unset=True).items():
                    if field == "id":
                        continue
                    setattr(li, field, value)
                updated_ids.add(item.id)
            else:
                db_item = OrderLineItem(**{**item.dict(), "billings_id": db_billing.id})
                db.add(db_item)
        for eid, li in existing_items.items():
            if eid not in updated_ids and len(line_items) > 0:
                pass
        db.commit()
    return db_billing

@router.delete("/{billing_id}")
def delete_billing(billing_id: int, db: Session = Depends(get_db)):
    billing = db.query(Billing).filter(Billing.id == billing_id).first()
    if not billing:
        raise HTTPException(status_code=404, detail="Billing not found")
    
    db.delete(billing)
    db.commit()
    return {"message": "Billing deleted successfully"}

@router.get("/{billing_id}/line-items", response_model=List[OrderLineItemSchema])
def get_billing_line_items(billing_id: int, db: Session = Depends(get_db)):
    return db.query(OrderLineItem).filter(OrderLineItem.billings_id == billing_id).all()

@router.get("/client/{client_id}", response_model=List[BillingSchema])
def get_billings_by_client(client_id: int, db: Session = Depends(get_db)):
    return db.query(Billing).join(Order, Billing.order_id == Order.id).filter(Order.client_id == client_id).all()

# Dedicated endpoints for order line items to match api client
ol_router = APIRouter(prefix="/order-line-items", tags=["order-line-items"])

@ol_router.get("/billing/{billing_id}", response_model=List[OrderLineItemSchema])
def get_order_line_items_by_billing(billing_id: int, db: Session = Depends(get_db)):
    return db.query(OrderLineItem).filter(OrderLineItem.billings_id == billing_id).all()

@ol_router.post("/", response_model=OrderLineItemSchema)
def create_order_line_item(item: OrderLineItemCreate, db: Session = Depends(get_db)):
    db_item = OrderLineItem(**item.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@ol_router.put("/{item_id}", response_model=OrderLineItemSchema)
def update_order_line_item(item_id: int, item: OrderLineItemUpdate, db: Session = Depends(get_db)):
    db_item = db.query(OrderLineItem).filter(OrderLineItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Order line item not found")
    for field, value in item.dict(exclude_unset=True).items():
        setattr(db_item, field, value)
    db.commit()
    db.refresh(db_item)
    return db_item

@ol_router.delete("/{item_id}")
def delete_order_line_item(item_id: int, db: Session = Depends(get_db)):
    db_item = db.query(OrderLineItem).filter(OrderLineItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Order line item not found")
    db.delete(db_item)
    db.commit()
    return {"message": "Order line item deleted successfully"}