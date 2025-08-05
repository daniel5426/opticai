from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import Order, Client, User, OrderEye, OrderLens, Frame, OrderDetails
from schemas import OrderCreate, OrderUpdate, Order as OrderSchema

router = APIRouter(prefix="/orders", tags=["orders"])

@router.post("/", response_model=OrderSchema)
def create_order(order: OrderCreate, db: Session = Depends(get_db)):
    db_order = Order(**order.dict())
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
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
    db.refresh(db_order)
    return db_order

@router.delete("/{order_id}")
def delete_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    db.delete(order)
    db.commit()
    return {"message": "Order deleted successfully"}

@router.get("/{order_id}/eyes", response_model=List[dict])
def get_order_eyes(order_id: int, db: Session = Depends(get_db)):
    order_eyes = db.query(OrderEye).filter(OrderEye.order_id == order_id).all()
    return [
        {
            "id": eye.id,
            "eye": eye.eye,
            "sph": eye.sph,
            "cyl": eye.cyl,
            "ax": eye.ax,
            "pris": eye.pris,
            "base": eye.base,
            "va": eye.va,
            "ad": eye.ad,
            "diam": eye.diam,
            "s_base": eye.s_base,
            "high": eye.high,
            "pd": eye.pd
        }
        for eye in order_eyes
    ]

@router.get("/{order_id}/lens", response_model=dict)
def get_order_lens(order_id: int, db: Session = Depends(get_db)):
    order_lens = db.query(OrderLens).filter(OrderLens.order_id == order_id).first()
    if not order_lens:
        return None
    
    return {
        "id": order_lens.id,
        "right_model": order_lens.right_model,
        "left_model": order_lens.left_model,
        "color": order_lens.color,
        "coating": order_lens.coating,
        "material": order_lens.material,
        "supplier": order_lens.supplier
    }

@router.get("/{order_id}/frame", response_model=dict)
def get_order_frame(order_id: int, db: Session = Depends(get_db)):
    frame = db.query(Frame).filter(Frame.order_id == order_id).first()
    if not frame:
        return None
    
    return {
        "id": frame.id,
        "color": frame.color,
        "supplier": frame.supplier,
        "model": frame.model,
        "manufacturer": frame.manufacturer,
        "supplied_by": frame.supplied_by,
        "bridge": frame.bridge,
        "width": frame.width,
        "height": frame.height,
        "length": frame.length
    }

@router.get("/{order_id}/details", response_model=dict)
def get_order_details(order_id: int, db: Session = Depends(get_db)):
    order_details = db.query(OrderDetails).filter(OrderDetails.order_id == order_id).first()
    if not order_details:
        return None
    
    return {
        "id": order_details.id,
        "branch": order_details.branch,
        "supplier_status": order_details.supplier_status,
        "bag_number": order_details.bag_number,
        "advisor": order_details.advisor,
        "delivered_by": order_details.delivered_by,
        "technician": order_details.technician,
        "delivered_at": order_details.delivered_at,
        "warranty_expiration": order_details.warranty_expiration,
        "delivery_location": order_details.delivery_location,
        "manufacturing_lab": order_details.manufacturing_lab,
        "order_status": order_details.order_status,
        "priority": order_details.priority,
        "promised_date": order_details.promised_date,
        "approval_date": order_details.approval_date,
        "notes": order_details.notes,
        "lens_order_notes": order_details.lens_order_notes
    } 