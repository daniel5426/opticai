from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from database import get_db
from models import Order, Client, User
from sqlalchemy import func
from schemas import OrderCreate, OrderUpdate, Order as OrderSchema

router = APIRouter(prefix="/orders", tags=["orders"])

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

 