from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import Billing, Order, ContactLens, OrderLineItem
from schemas import BillingCreate, BillingUpdate, Billing as BillingSchema

router = APIRouter(prefix="/billing", tags=["billing"])

@router.post("/", response_model=BillingSchema)
def create_billing(billing: BillingCreate, db: Session = Depends(get_db)):
    db_billing = Billing(**billing.dict())
    db.add(db_billing)
    db.commit()
    db.refresh(db_billing)
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
        raise HTTPException(status_code=404, detail="Billing not found for contact lens")
    return billing

@router.put("/{billing_id}", response_model=BillingSchema)
def update_billing(billing_id: int, billing: BillingUpdate, db: Session = Depends(get_db)):
    db_billing = db.query(Billing).filter(Billing.id == billing_id).first()
    if not db_billing:
        raise HTTPException(status_code=404, detail="Billing not found")
    
    for field, value in billing.dict(exclude_unset=True).items():
        setattr(db_billing, field, value)
    
    db.commit()
    db.refresh(db_billing)
    return db_billing

@router.delete("/{billing_id}")
def delete_billing(billing_id: int, db: Session = Depends(get_db)):
    billing = db.query(Billing).filter(Billing.id == billing_id).first()
    if not billing:
        raise HTTPException(status_code=404, detail="Billing not found")
    
    db.delete(billing)
    db.commit()
    return {"message": "Billing deleted successfully"}

@router.get("/{billing_id}/line-items", response_model=List[dict])
def get_billing_line_items(billing_id: int, db: Session = Depends(get_db)):
    line_items = db.query(OrderLineItem).filter(OrderLineItem.billings_id == billing_id).all()
    return [
        {
            "id": item.id,
            "sku": item.sku,
            "description": item.description,
            "supplied_by": item.supplied_by,
            "supplied": item.supplied,
            "price": item.price,
            "quantity": item.quantity,
            "discount": item.discount,
            "line_total": item.line_total
        }
        for item in line_items
    ] 