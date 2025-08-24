from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from database import get_db
from models import Order, Client, User, Billing, OrderLineItem, ContactLensOrder
from sqlalchemy import func
from schemas import OrderCreate, OrderUpdate, Order as OrderSchema, BillingCreate, BillingUpdate, Billing as BillingSchema, OrderLineItemCreate, OrderLineItemUpdate, OrderLineItem as OrderLineItemSchema, ContactLensOrderCreate, ContactLensOrderUpdate, ContactLensOrder as ContactLensOrderSchema

router = APIRouter(prefix="/orders", tags=["orders"])

@router.get("/paginated")
def get_orders_paginated(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    limit: int = Query(25, ge=1, le=100, description="Max items to return"),
    offset: int = Query(0, ge=0, description="Items to skip"),
    order: Optional[str] = Query("date_desc", description="Sort order: date_desc|date_asc|id_desc|id_asc"),
    db: Session = Depends(get_db)
):
    base = db.query(Order)
    if clinic_id:
        base = base.filter(Order.clinic_id == clinic_id)
    
    # Apply ordering
    if order == "date_desc":
        base = base.order_by(Order.order_date.desc().nulls_last())
    elif order == "date_asc":
        base = base.order_by(Order.order_date.asc().nulls_last())
    elif order == "id_asc":
        base = base.order_by(Order.id.asc())
    else:  # default to id_desc
        base = base.order_by(Order.id.desc())
    
    total = base.count()
    items = base.offset(offset).limit(limit).all()
    
    return {"items": items, "total": total}

@router.post("/", response_model=OrderSchema)
def create_order(order: OrderCreate, db: Session = Depends(get_db)):
    db_order = Order(**order.dict())
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    # bump client_updated_date
    try:
        if db_order.client_id:
            client = db.query(Client).filter(Client.id == db_order.client_id).first()
            if client:
                client.client_updated_date = func.now()
                db.commit()
    except Exception:
        pass
    return db_order

@router.get("/{order_id}", response_model=OrderSchema)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@router.get("/", response_model=List[OrderSchema])
def get_all_orders(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    db: Session = Depends(get_db)
):
    query = db.query(Order)
    if clinic_id:
        query = query.filter(Order.clinic_id == clinic_id)
    return query.all()

@router.get("/client/{client_id}", response_model=List[OrderSchema])
def get_orders_by_client(client_id: int, db: Session = Depends(get_db)):
    orders = db.query(Order).filter(Order.client_id == client_id).all()
    return orders

@router.put("/{order_id}", response_model=OrderSchema)
def update_order(order_id: int, order: OrderUpdate, db: Session = Depends(get_db)):
    db_order = db.query(Order).filter(Order.id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    for field, value in order.dict(exclude_unset=True).items():
        setattr(db_order, field, value)
    
    db.commit()
    # bump client_updated_date
    try:
        if db_order.client_id:
            client = db.query(Client).filter(Client.id == db_order.client_id).first()
            if client:
                client.client_updated_date = func.now()
                db.commit()
    except Exception:
        pass
    db.refresh(db_order)
    return db_order

@router.delete("/{order_id}")
def delete_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    client_id = order.client_id
    db.delete(order)
    db.commit()
    # bump client_updated_date
    try:
        if client_id:
            client = db.query(Client).filter(Client.id == client_id).first()
            if client:
                client.client_updated_date = func.now()
                db.commit()
    except Exception:
        pass
    return {"message": "Order deleted successfully"}

# Order unified data endpoints
@router.get("/{order_id}/data")
def get_order_data(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order.order_data or {}

@router.post("/{order_id}/data")
async def save_order_data(order_id: int, request: Request, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    try:
        data = await request.json()
        if not isinstance(data, dict):
            raise ValueError("Body must be a JSON object")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid JSON: {str(e)}")
    order.order_data = data
    db.commit()
    # bump client_updated_date
    try:
        if order.client_id:
            client = db.query(Client).filter(Client.id == order.client_id).first()
            if client:
                client.client_updated_date = func.now()
                db.commit()
    except Exception:
        pass
    db.refresh(order)
    return {"success": True}

@router.get("/{order_id}/data/component/{component_type}")
def get_order_component_data(order_id: int, component_type: str, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    data = order.order_data or {}
    return data.get(component_type)

@router.post("/{order_id}/data/component/{component_type}")
async def save_order_component_data(order_id: int, component_type: str, request: Request, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    try:
        component_data = await request.json()
        if not isinstance(component_data, dict):
            raise ValueError("Body must be a JSON object")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid JSON: {str(e)}")
    data = order.order_data or {}
    data[component_type] = component_data
    order.order_data = data
    db.commit()
    # bump client_updated_date
    try:
        if order.client_id:
            client = db.query(Client).filter(Client.id == order.client_id).first()
            if client:
                client.client_updated_date = func.now()
                db.commit()
    except Exception:
        pass
    db.refresh(order)
    return {"success": True}

# Combined create/update with billing and line items
@router.post("/upsert-full")
def upsert_order_full(payload: Dict[str, Any], db: Session = Depends(get_db)):
    order_data = payload.get("order")
    billing_data = payload.get("billing")
    line_items = payload.get("line_items", [])

    if not isinstance(order_data, dict):
        raise HTTPException(status_code=422, detail="order payload missing or invalid")

    order_id = order_data.get("id")
    if order_id:
        db_order = db.query(Order).filter(Order.id == order_id).first()
        if not db_order:
            raise HTTPException(status_code=404, detail="Order not found")
        for k, v in {**order_data}.items():
            if k == "id":
                continue
            setattr(db_order, k, v)
        db.commit()
        db.refresh(db_order)
    else:
        db_order = Order(**order_data)
        db.add(db_order)
        db.commit()
        db.refresh(db_order)

    billing_result = None
    if isinstance(billing_data, dict):
        if billing_data.get("id"):
            db_billing = db.query(Billing).filter(Billing.id == billing_data["id"]).first()
            if not db_billing:
                raise HTTPException(status_code=404, detail="Billing not found")
            for k, v in {**billing_data}.items():
                if k == "id" or k == "line_items":
                    continue
                setattr(db_billing, k, v)
            db.commit()
            db.refresh(db_billing)
        else:
            to_create = {**billing_data, "order_id": db_order.id}
            db_billing = Billing(**to_create)
            db.add(db_billing)
            db.commit()
            db.refresh(db_billing)
        billing_result = db_billing

        if isinstance(line_items, list):
            existing = {li.id: li for li in db.query(OrderLineItem).filter(OrderLineItem.billings_id == db_billing.id).all()}
            sent_ids = set()
            for item in line_items:
                if not isinstance(item, dict):
                    continue
                if item.get("id"):
                    li = existing.get(item["id"])
                    if not li:
                        continue
                    for k, v in item.items():
                        if k == "id":
                            continue
                        setattr(li, k, v)
                    sent_ids.add(item["id"])
                else:
                    db_item = OrderLineItem(**{**item, "billings_id": db_billing.id})
                    db.add(db_item)
            # delete items not present in payload
            for existing_id, li in existing.items():
                if existing_id not in sent_ids:
                    db.delete(li)
            db.commit()

    try:
        if db_order.client_id:
            client = db.query(Client).filter(Client.id == db_order.client_id).first()
            if client:
                client.client_updated_date = func.now()
                db.commit()
    except Exception:
        pass

    response: Dict[str, Any] = {"order": db_order}
    if billing_result:
        response["billing"] = billing_result
        # include line items in response
        items = db.query(OrderLineItem).filter(OrderLineItem.billings_id == billing_result.id).all()
        response["line_items"] = items
    return response
 
# Contact Lens Orders endpoints and unified upsert
cl_router = APIRouter(prefix="/contact-lens-orders", tags=["contact-lens-orders"])

@cl_router.post("/", response_model=ContactLensOrderSchema)
def create_contact_lens_order(order: ContactLensOrderCreate, db: Session = Depends(get_db)):
    db_order = ContactLensOrder(**order.dict())
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    try:
        if db_order.client_id:
            client = db.query(Client).filter(Client.id == db_order.client_id).first()
            if client:
                client.client_updated_date = func.now()
                db.commit()
    except Exception:
        pass
    return db_order

@cl_router.get("/{order_id}", response_model=ContactLensOrderSchema)
def get_contact_lens_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(ContactLensOrder).filter(ContactLensOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Contact lens order not found")
    return order

@cl_router.get("/", response_model=List[ContactLensOrderSchema])
def get_all_contact_lens_orders(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    db: Session = Depends(get_db)
):
    query = db.query(ContactLensOrder)
    if clinic_id:
        query = query.filter(ContactLensOrder.clinic_id == clinic_id)
    return query.all()

@cl_router.get("/client/{client_id}", response_model=List[ContactLensOrderSchema])
def get_contact_lens_orders_by_client(client_id: int, db: Session = Depends(get_db)):
    return db.query(ContactLensOrder).filter(ContactLensOrder.client_id == client_id).all()

@cl_router.put("/{order_id}", response_model=ContactLensOrderSchema)
def update_contact_lens_order(order_id: int, order: ContactLensOrderUpdate, db: Session = Depends(get_db)):
    db_order = db.query(ContactLensOrder).filter(ContactLensOrder.id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Contact lens order not found")
    for field, value in order.dict(exclude_unset=True).items():
        setattr(db_order, field, value)
    db.commit()
    try:
        if db_order.client_id:
            client = db.query(Client).filter(Client.id == db_order.client_id).first()
            if client:
                client.client_updated_date = func.now()
                db.commit()
    except Exception:
        pass
    db.refresh(db_order)
    return db_order

@cl_router.delete("/{order_id}")
def delete_contact_lens_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(ContactLensOrder).filter(ContactLensOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Contact lens order not found")
    client_id = order.client_id
    db.delete(order)
    db.commit()
    try:
        if client_id:
            client = db.query(Client).filter(Client.id == client_id).first()
            if client:
                client.client_updated_date = func.now()
                db.commit()
    except Exception:
        pass
    return {"message": "Contact lens order deleted successfully"}

@cl_router.post("/upsert-full")
def upsert_contact_lens_order_full(payload: Dict[str, Any], db: Session = Depends(get_db)):
    order_data = payload.get("order")
    billing_data = payload.get("billing")
    line_items = payload.get("line_items", [])

    if not isinstance(order_data, dict):
        raise HTTPException(status_code=422, detail="order payload missing or invalid")

    order_id = order_data.get("id")
    if order_id:
        db_order = db.query(ContactLensOrder).filter(ContactLensOrder.id == order_id).first()
        if not db_order:
            raise HTTPException(status_code=404, detail="Contact lens order not found")
        for k, v in {**order_data}.items():
            if k == "id":
                continue
            setattr(db_order, k, v)
        db.commit()
        db.refresh(db_order)
    else:
        db_order = ContactLensOrder(**order_data)
        db.add(db_order)
        db.commit()
        db.refresh(db_order)

    billing_result = None
    if isinstance(billing_data, dict):
        if billing_data.get("id"):
            db_billing = db.query(Billing).filter(Billing.id == billing_data["id"]).first()
            if not db_billing:
                raise HTTPException(status_code=404, detail="Billing not found")
            for k, v in {**billing_data}.items():
                if k == "id" or k == "line_items":
                    continue
                setattr(db_billing, k, v)
            db.commit()
            db.refresh(db_billing)
        else:
            to_create = {**billing_data, "contact_lens_id": db_order.id}
            db_billing = Billing(**to_create)
            db.add(db_billing)
            db.commit()
            db.refresh(db_billing)
        billing_result = db_billing

        if isinstance(line_items, list):
            existing = {li.id: li for li in db.query(OrderLineItem).filter(OrderLineItem.billings_id == db_billing.id).all()}
            sent_ids = set()
            for item in line_items:
                if not isinstance(item, dict):
                    continue
                if item.get("id"):
                    li = existing.get(item["id"]) 
                    if not li:
                        continue
                    for k, v in item.items():
                        if k == "id":
                            continue
                        setattr(li, k, v)
                    sent_ids.add(item["id"])
                else:
                    db_item = OrderLineItem(**{**item, "billings_id": db_billing.id})
                    db.add(db_item)
            for existing_id, li in existing.items():
                if existing_id not in sent_ids:
                    db.delete(li)
            db.commit()

    try:
        if db_order.client_id:
            client = db.query(Client).filter(Client.id == db_order.client_id).first()
            if client:
                client.client_updated_date = func.now()
                db.commit()
    except Exception:
        pass

    response: Dict[str, Any] = {"order": db_order}
    if billing_result:
        response["billing"] = billing_result
        items = db.query(OrderLineItem).filter(OrderLineItem.billings_id == billing_result.id).all()
        response["line_items"] = items
    return response
 