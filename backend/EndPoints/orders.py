from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import date
from database import get_db
from models import Order, Client, User, Billing, OrderLineItem, ContactLensOrder
from sqlalchemy import Date, func
from schemas import OrderCreate, OrderUpdate, Order as OrderSchema, BillingCreate, BillingUpdate, Billing as BillingSchema, OrderLineItemCreate, OrderLineItemUpdate, OrderLineItem as OrderLineItemSchema, ContactLensOrderCreate, ContactLensOrderUpdate, ContactLensOrder as ContactLensOrderSchema
from utils.date_search import DateSearchHelper
from auth import get_current_user
from models import Clinic
from security.scope import (
    apply_clinic_user_scope,
    assert_clinic_belongs_to_company,
    get_allowed_clinic_ids,
    get_scoped_billing,
    get_scoped_client,
    get_scoped_contact_lens_order,
    get_scoped_order,
    normalize_client_id,
    resolve_company_id,
)

router = APIRouter(prefix="/orders", tags=["orders"])


def _attach_billing_summaries(db: Session, orders: list, *, contact: bool = False) -> None:
    order_ids = [order.id for order in orders if order.id]
    if not order_ids:
        return

    billing_query = db.query(Billing)
    if contact:
        billings = billing_query.filter(Billing.contact_lens_id.in_(order_ids)).all()
        billing_by_order_id = {billing.contact_lens_id: billing for billing in billings}
    else:
        billings = billing_query.filter(Billing.order_id.in_(order_ids)).all()
        billing_by_order_id = {billing.order_id: billing for billing in billings}

    for order in orders:
        billing = billing_by_order_id.get(order.id)
        setattr(order, "billing_id", billing.id if billing else None)
        setattr(order, "billing_total_after_discount", billing.total_after_discount if billing else None)
        setattr(order, "billing_prepayment_amount", billing.prepayment_amount if billing else None)

@router.get("/paginated")
def get_orders_paginated(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    limit: int = Query(25, ge=1, le=100, description="Max items to return"),
    offset: int = Query(0, ge=0, description="Items to skip"),
    order: Optional[str] = Query("date_desc", description="Sort order: date_desc|date_asc|id_desc|id_asc"),
    search: Optional[str] = Query(None, description="Search by type/examiner/client name/VA/PD/date"),
    kind: Optional[str] = Query(None, description="Filter by kind: all|regular|contact"),
    status: Optional[str] = Query(None, description="Filter by order status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from sqlalchemy import or_, func, String, literal
    from sqlalchemy import union_all, select

    like = f"%{search.strip()}%" if search else None
    
    allowed_clinic_ids = get_allowed_clinic_ids(db, current_user, clinic_id)

    order_filters = [Order.clinic_id.in_(allowed_clinic_ids)]
    if like:
        date_search_conditions = DateSearchHelper.build_date_search_conditions(
            Order.order_date, search
        )
        
        order_filters.append(
            or_(
                Order.type.ilike(like),
                func.concat(Client.first_name, ' ', Client.last_name).ilike(like),
                User.full_name.ilike(like),
                User.username.ilike(like),
                *date_search_conditions,
            )
        )
        
    if status and status != "all":
        order_filters.append(
            func.json_extract_path_text(Order.order_data, 'details', 'order_status') == status
        )

    cl_filters = [ContactLensOrder.clinic_id.in_(allowed_clinic_ids)]
    if like:
        date_search_conditions_cl = DateSearchHelper.build_date_search_conditions(
            ContactLensOrder.order_date, search
        )
        
        cl_filters.append(
            or_(
                ContactLensOrder.type.ilike(like),
                func.concat(Client.first_name, ' ', Client.last_name).ilike(like),
                User.full_name.ilike(like),
                User.username.ilike(like),
                *date_search_conditions_cl,
            )
        )
        
    if status and status != "all":
        cl_filters.append(ContactLensOrder.order_status == status)

    orders_from = (
        Order.__table__
        .outerjoin(User.__table__, Order.user_id == User.id)
        .outerjoin(Client.__table__, Order.client_id == Client.id)
        .outerjoin(Billing.__table__, Billing.order_id == Order.id)
    )
    orders_select = select(
        Order.id.label('id'),
        Order.client_id.label('client_id'),
        Order.clinic_id.label('clinic_id'),
        Order.order_date.label('order_date'),
        Order.type.label('type'),
        Order.user_id.label('user_id'),
        func.json_extract_path_text(Order.order_data, 'details', 'order_status').label('order_status'),
        literal(None).label('comb_va'),
        literal(None).label('comb_pd'),
        literal(False).label('__contact'),
        func.coalesce(User.full_name, User.username).label('username'),
        (func.concat(Client.first_name, ' ', Client.last_name)).label('clientName'),
        Billing.id.label('billing_id'),
        Billing.total_after_discount.label('billing_total_after_discount'),
        Billing.prepayment_amount.label('billing_prepayment_amount'),
    ).select_from(orders_from)
    if order_filters:
        orders_select = orders_select.where(*order_filters)

    cl_from = (
        ContactLensOrder.__table__
        .outerjoin(User.__table__, ContactLensOrder.user_id == User.id)
        .outerjoin(Client.__table__, ContactLensOrder.client_id == Client.id)
        .outerjoin(Billing.__table__, Billing.contact_lens_id == ContactLensOrder.id)
    )
    cl_select = select(
        ContactLensOrder.id.label('id'),
        ContactLensOrder.client_id.label('client_id'),
        ContactLensOrder.clinic_id.label('clinic_id'),
        ContactLensOrder.order_date.label('order_date'),
        ContactLensOrder.type.label('type'),
        ContactLensOrder.user_id.label('user_id'),
        ContactLensOrder.order_status.label('order_status'),
        literal(None).label('comb_va'),
        literal(None).label('comb_pd'),
        literal(True).label('__contact'),
        func.coalesce(User.full_name, User.username).label('username'),
        (func.concat(Client.first_name, ' ', Client.last_name)).label('clientName'),
        Billing.id.label('billing_id'),
        Billing.total_after_discount.label('billing_total_after_discount'),
        Billing.prepayment_amount.label('billing_prepayment_amount'),
    ).select_from(cl_from)
    if cl_filters:
        cl_select = cl_select.where(*cl_filters)

    normalized_kind = (kind or "all").strip().lower()
    if normalized_kind == "regular":
        merged_subq = orders_select.subquery()
    elif normalized_kind == "contact":
        merged_subq = cl_select.subquery()
    else:
        merged_subq = union_all(orders_select, cl_select).subquery()

    # Total count
    total = db.execute(select(func.count()).select_from(merged_subq)).scalar() or 0

    order_columns = {
        "date": merged_subq.c.order_date,
        "order_date": merged_subq.c.order_date,
        "id": merged_subq.c.id,
        "type": merged_subq.c.type,
        "kind": merged_subq.c["__contact"],
        "client": merged_subq.c["clientName"],
        "examiner": merged_subq.c.username,
        "payment_status": merged_subq.c.billing_prepayment_amount,
        "status": merged_subq.c.order_status,
    }
    order_key, _, order_direction = (order or "date_desc").rpartition("_")
    order_column = order_columns.get(order_key, merged_subq.c.order_date)
    if order_direction == "asc":
        order_by_clause = order_column.asc().nulls_last()
        tie_breaker = merged_subq.c.id.asc()
    else:
        order_by_clause = order_column.desc().nulls_last()
        tie_breaker = merged_subq.c.id.desc()

    stmt = select(merged_subq).order_by(order_by_clause, tie_breaker).offset(offset).limit(limit)
    rows = db.execute(stmt).mappings().all()
    items = [dict(r) for r in rows]

    return {"items": items, "total": int(total)}

@router.post("/", response_model=OrderSchema)
def create_order(
    order: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payload = _prepare_model_payload(db, current_user, Order, order.dict())
    db_order = Order(**payload)
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
def get_order(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return get_scoped_order(db, current_user, order_id)

@router.get("/", response_model=List[OrderSchema])
def get_all_orders(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    allowed_clinic_ids = get_allowed_clinic_ids(db, current_user, clinic_id)
    query = db.query(Order).filter(Order.clinic_id.in_(allowed_clinic_ids))
    orders = query.all()
    for order in orders:
        details = ((order.order_data or {}).get("details") or {}) if isinstance(order.order_data, dict) else {}
        setattr(order, "order_status", details.get("order_status"))
    _attach_billing_summaries(db, orders)
    return orders

@router.get("/client/{client_id}", response_model=List[OrderSchema])
def get_orders_by_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_scoped_client(db, current_user, client_id)
    orders = (
        db.query(Order)
        .filter(Order.client_id == client_id)
        .order_by(Order.order_date.desc().nulls_last(), Order.id.desc())
        .all()
    )
    for order in orders:
        details = ((order.order_data or {}).get("details") or {}) if isinstance(order.order_data, dict) else {}
        setattr(order, "order_status", details.get("order_status"))
    _attach_billing_summaries(db, orders)
    return orders

@router.put("/{order_id}", response_model=OrderSchema)
def update_order(
    order_id: int,
    order: OrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_order = get_scoped_order(db, current_user, order_id)
    update_fields = _prepare_update_payload(db, current_user, db_order, Order, order.dict(exclude_unset=True))
    for field, value in update_fields.items():
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
def delete_order(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    order = get_scoped_order(db, current_user, order_id)
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
def get_order_data(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    order = get_scoped_order(db, current_user, order_id)
    return order.order_data or {}

@router.post("/{order_id}/data")
async def save_order_data(
    order_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = get_scoped_order(db, current_user, order_id)
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
def get_order_component_data(
    order_id: int,
    component_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = get_scoped_order(db, current_user, order_id)
    data = order.order_data or {}
    return data.get(component_type)

@router.post("/{order_id}/data/component/{component_type}")
async def save_order_component_data(
    order_id: int,
    component_type: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = get_scoped_order(db, current_user, order_id)
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

def filter_model_data(model, data: Dict[str, Any]) -> Dict[str, Any]:
    """Filter dictionary keys to only include those that are valid columns for the given SQLAlchemy model."""
    columns = {c.name for c in model.__table__.columns}
    return {k: v for k, v in data.items() if k in columns}


def _prepare_model_payload(db: Session, current_user: User, model, data: Dict[str, Any]) -> Dict[str, Any]:
    payload = filter_model_data(model, data)
    if "user_id" in {c.name for c in model.__table__.columns} and "user_id" not in payload:
        payload["user_id"] = None
    for column in model.__table__.columns:
        if column.name not in payload or payload[column.name] in (None, ""):
            continue
        if isinstance(column.type, Date) and not isinstance(payload[column.name], date):
            try:
                payload[column.name] = date.fromisoformat(payload[column.name])
            except (TypeError, ValueError):
                raise HTTPException(status_code=422, detail=f"Invalid date for {column.name}")
    payload = apply_clinic_user_scope(db, current_user, payload)
    if "supply_in_clinic_id" in payload:
        if payload["supply_in_clinic_id"] == "":
            payload["supply_in_clinic_id"] = None
        elif payload["supply_in_clinic_id"] is not None:
            try:
                payload["supply_in_clinic_id"] = int(payload["supply_in_clinic_id"])
            except (TypeError, ValueError):
                raise HTTPException(status_code=422, detail="Invalid supply_in_clinic_id")
            assert_clinic_belongs_to_company(
                db,
                payload["supply_in_clinic_id"],
                resolve_company_id(db, current_user),
            )
    return payload


def _prepare_update_payload(db: Session, current_user: User, db_obj, model, data: Dict[str, Any]) -> Dict[str, Any]:
    update = filter_model_data(model, data)
    if not update:
        return update
    candidate = {c.name: getattr(db_obj, c.name) for c in model.__table__.columns}
    candidate.update(update)
    scoped_candidate = _prepare_model_payload(db, current_user, model, candidate)
    return {k: scoped_candidate[k] for k in update if k in scoped_candidate}

# Combined create/update with billing and line items
@router.post("/upsert-full")
def upsert_order_full(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order_data = payload.get("order")
    billing_data = payload.get("billing")
    line_items = payload.get("line_items", [])

    if not isinstance(order_data, dict):
        raise HTTPException(status_code=422, detail="order payload missing or invalid")

    order_id = order_data.get("id")
    filtered_order_data = _prepare_model_payload(db, current_user, Order, order_data)
    
    if order_id:
        db_order = get_scoped_order(db, current_user, order_id)
        filtered_order_data = _prepare_update_payload(db, current_user, db_order, Order, order_data)
        for k, v in filtered_order_data.items():
            if k == "id":
                continue
            setattr(db_order, k, v)
        db.commit()
        db.refresh(db_order)
    else:
        db_order = Order(**filtered_order_data)
        db.add(db_order)
        db.commit()
        db.refresh(db_order)

    billing_result = None
    if isinstance(billing_data, dict):
        filtered_billing_data = filter_model_data(Billing, billing_data)
        db_billing = None
        
        # Try to find existing billing
        if billing_data.get("id"):
            db_billing = get_scoped_billing(db, current_user, billing_data["id"])
        else:
            db_billing = db.query(Billing).filter(Billing.order_id == db_order.id).first()
            
        if db_billing:
            # Update existing billing
            for k, v in filtered_billing_data.items():
                if k == "id" or k == "order_id" or k == "contact_lens_id" or k == "line_items":
                    continue
                setattr(db_billing, k, v)
            db.commit()
            db.refresh(db_billing)
        else:
            # Create new billing
            to_create = {**filtered_billing_data, "order_id": db_order.id}
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
                
                filtered_item_data = filter_model_data(OrderLineItem, item)
                
                if item.get("id"):
                    li = existing.get(item["id"])
                    if not li:
                        continue
                    for k, v in filtered_item_data.items():
                        if k == "id":
                            continue
                        setattr(li, k, v)
                    sent_ids.add(item["id"])
                else:
                    db_item = OrderLineItem(**{**filtered_item_data, "billings_id": db_billing.id})
                    db.add(db_item)
            # delete items not present in payload
            for existing_id, li in existing.items():
                if existing_id not in sent_ids:
                    db.delete(li)
            db.commit()
            print(f"Saved {len(line_items)} line items for order {db_order.id}")


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
def create_contact_lens_order(
    order: ContactLensOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payload = _prepare_model_payload(db, current_user, ContactLensOrder, order.dict())
    db_order = ContactLensOrder(**payload)
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
def get_contact_lens_order(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return get_scoped_contact_lens_order(db, current_user, order_id)

@cl_router.get("/", response_model=List[ContactLensOrderSchema])
def get_all_contact_lens_orders(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    allowed_clinic_ids = get_allowed_clinic_ids(db, current_user, clinic_id)
    query = db.query(ContactLensOrder).filter(ContactLensOrder.clinic_id.in_(allowed_clinic_ids))
    orders = query.all()
    _attach_billing_summaries(db, orders, contact=True)
    return orders

@cl_router.get("/client/{client_id}", response_model=List[ContactLensOrderSchema])
def get_contact_lens_orders_by_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_scoped_client(db, current_user, client_id)
    orders = (
        db.query(ContactLensOrder)
        .filter(ContactLensOrder.client_id == client_id)
        .order_by(ContactLensOrder.order_date.desc().nulls_last(), ContactLensOrder.id.desc())
        .all()
    )
    _attach_billing_summaries(db, orders, contact=True)
    return orders

@cl_router.put("/{order_id}", response_model=ContactLensOrderSchema)
def update_contact_lens_order(
    order_id: int,
    order: ContactLensOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_order = get_scoped_contact_lens_order(db, current_user, order_id)
    update_fields = _prepare_update_payload(db, current_user, db_order, ContactLensOrder, order.dict(exclude_unset=True))
    for field, value in update_fields.items():
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
def delete_contact_lens_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = get_scoped_contact_lens_order(db, current_user, order_id)
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
def upsert_contact_lens_order_full(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order_data = payload.get("order")
    billing_data = payload.get("billing")
    line_items = payload.get("line_items", [])

    if not isinstance(order_data, dict):
        raise HTTPException(status_code=422, detail="order payload missing or invalid")

    order_id = order_data.get("id")
    filtered_order_data = _prepare_model_payload(db, current_user, ContactLensOrder, order_data)

    if order_id:
        db_order = get_scoped_contact_lens_order(db, current_user, order_id)
        filtered_order_data = _prepare_update_payload(db, current_user, db_order, ContactLensOrder, order_data)
        for k, v in filtered_order_data.items():
            if k == "id":
                continue
            setattr(db_order, k, v)
        db.commit()
        db.refresh(db_order)
    else:
        db_order = ContactLensOrder(**filtered_order_data)
        db.add(db_order)
        db.commit()
        db.refresh(db_order)

    billing_result = None
    if isinstance(billing_data, dict):
        filtered_billing_data = filter_model_data(Billing, billing_data)
        db_billing = None
        
        # Try to find existing billing
        if billing_data.get("id"):
            db_billing = get_scoped_billing(db, current_user, billing_data["id"])
        else:
            db_billing = db.query(Billing).filter(Billing.contact_lens_id == db_order.id).first()
            
        if db_billing:
            # Update existing billing
            for k, v in filtered_billing_data.items():
                if k == "id" or k == "order_id" or k == "contact_lens_id" or k == "line_items":
                    continue
                setattr(db_billing, k, v)
            db.commit()
            db.refresh(db_billing)
        else:
            # Create new billing
            to_create = {**filtered_billing_data, "contact_lens_id": db_order.id}
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
                
                filtered_item_data = filter_model_data(OrderLineItem, item)
                
                if item.get("id"):
                    li = existing.get(item["id"]) 
                    if not li:
                        continue
                    for k, v in filtered_item_data.items():
                        if k == "id":
                            continue
                        setattr(li, k, v)
                    sent_ids.add(item["id"])
                else:
                    db_item = OrderLineItem(**{**filtered_item_data, "billings_id": db_billing.id})
                    db.add(db_item)
            # delete items not present in payload
            for existing_id, li in existing.items():
                if existing_id not in sent_ids:
                    db.delete(li)
            db.commit()
            print(f"Saved {len(line_items)} line items for contact lens order {db_order.id}")


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
 
