import csv
import io
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import (
    CatalogOrderObservation,
    CatalogProduct,
    CatalogVariant,
    Clinic,
    ContactLensOrder,
    InventoryBalance,
    InventoryCompanySettings,
    InventoryMovement,
    Order,
    OrderInventoryAllocation,
    User,
)
from security.scope import normalize_clinic_id_for_company, resolve_company_id
from services.inventory_service import (
    _validate_price,
    allocation_dict,
    apply_balance_change,
    balance_dict,
    can_view_cost,
    create_product,
    create_variant,
    get_company_variant,
    get_or_create_balance,
    movement_dict,
    normalized_product_key,
    normalized_variant_fingerprint,
    product_dict,
    require_inventory_write,
    validate_product_data,
    validate_variant_attributes,
    variant_dict,
)
from services.inventory_discovery_service import confirm_discovery, discover_from_orders
from services.analytics_service import add_to_series, empty_series, metric_payload, resolve_analytics_window


router = APIRouter(prefix="/inventory", tags=["inventory"])


def _inventory_demand_events(observations, movements, minimum_date: date) -> list[dict[str, Any]]:
    """Prefer confirmed observations and retain only unmatched/manual consume movements."""
    observation_keys = {
        (observation.order_id, observation.contact_lens_order_id, observation.component)
        for observation in observations
    }
    events = [
        {
            "variant_id": observation.variant_id,
            "date": observation.observed_on,
            "quantity": max(0, int(observation.quantity or 0)),
            "source": "observation",
        }
        for observation in observations
        if observation.observed_on and observation.observed_on >= minimum_date
    ]
    for movement in movements:
        metadata = movement.movement_metadata or {}
        event_key = (
            movement.order_id,
            movement.contact_lens_order_id,
            str(metadata.get("component") or ""),
        )
        has_order_source = movement.order_id is not None or movement.contact_lens_order_id is not None
        if has_order_source and event_key in observation_keys:
            continue
        events.append(
            {
                "variant_id": movement.variant_id,
                "date": movement.created_at.date(),
                "quantity": abs(int(movement.on_hand_delta or 0)),
                "source": "movement",
            }
        )
    return events


def _company_product(db: Session, company_id: int, product_id: int) -> CatalogProduct:
    product = db.query(CatalogProduct).filter(
        CatalogProduct.id == product_id,
        CatalogProduct.company_id == company_id,
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Catalog product not found")
    return product


def _commit_or_conflict(db: Session, detail: str = "Catalog item already exists") -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=detail)


def _guard_cost_write(current_user: User, payload: dict[str, Any]) -> None:
    if payload.get("default_cost") not in (None, "") and not can_view_cost(current_user):
        raise HTTPException(status_code=403, detail="Only managers can manage inventory cost")


def _variant_rows(
    db: Session,
    *,
    company_id: int,
    clinic_id: int,
    category: str | None = None,
    search: str | None = None,
    include_archived: bool = False,
    stockable_only: bool = False,
    limit: int = 500,
):
    query = (
        db.query(CatalogVariant, CatalogProduct, InventoryBalance)
        .join(CatalogProduct, CatalogProduct.id == CatalogVariant.product_id)
        .outerjoin(
            InventoryBalance,
            (InventoryBalance.variant_id == CatalogVariant.id)
            & (InventoryBalance.clinic_id == clinic_id),
        )
        .filter(CatalogVariant.company_id == company_id, CatalogProduct.company_id == company_id)
    )
    if category:
        query = query.filter(CatalogProduct.category == category)
    if not include_archived:
        query = query.filter(CatalogProduct.archived_at.is_(None), CatalogVariant.archived_at.is_(None))
    if stockable_only:
        query = query.filter(CatalogVariant.is_stockable.is_(True))
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                CatalogProduct.brand.ilike(pattern),
                CatalogProduct.model.ilike(pattern),
                CatalogProduct.product_type.ilike(pattern),
                CatalogProduct.material.ilike(pattern),
                CatalogVariant.sku.ilike(pattern),
                CatalogVariant.barcode.ilike(pattern),
            )
        )
    return query.order_by(CatalogProduct.brand, CatalogProduct.model, CatalogVariant.id).limit(limit).all()


@router.get("/variants")
def list_variants(
    clinic_id: Optional[int] = Query(None),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    barcode: Optional[str] = Query(None),
    include_archived: bool = Query(False),
    stockable_only: bool = Query(False),
    limit: int = Query(500, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    company_id = resolve_company_id(db, current_user)
    scoped_clinic_id = normalize_clinic_id_for_company(db, current_user, clinic_id)
    effective_search = barcode.strip() if barcode else search
    rows = _variant_rows(
        db,
        company_id=company_id,
        clinic_id=scoped_clinic_id,
        category=category,
        search=effective_search,
        include_archived=include_archived,
        stockable_only=stockable_only,
        limit=limit,
    )
    if barcode:
        rows = [row for row in rows if row[0].barcode == barcode.strip()]
    items = [
        variant_dict(
            variant,
            product,
            balance=balance or InventoryBalance(
                clinic_id=scoped_clinic_id,
                variant_id=variant.id,
                on_hand=0,
                reserved=0,
                reorder_point=0,
                target_quantity=0,
                version=1,
            ),
            include_cost=can_view_cost(current_user),
        )
        for variant, product, balance in rows
    ]
    return {"items": items, "total": len(items), "clinic_id": scoped_clinic_id}


@router.get("/summary")
def inventory_summary(
    clinic_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    company_id = resolve_company_id(db, current_user)
    scoped_clinic_id = normalize_clinic_id_for_company(db, current_user, clinic_id)
    rows = _variant_rows(
        db,
        company_id=company_id,
        clinic_id=scoped_clinic_id,
        stockable_only=True,
        limit=1000,
    )
    summary = {
        "variant_count": len(rows),
        "on_hand": 0,
        "reserved": 0,
        "available": 0,
        "low_stock": 0,
        "out_of_stock": 0,
    }
    total_cost = 0.0
    total_retail = 0.0
    for variant, _, balance in rows:
        if not balance:
            continue
        available = balance.on_hand - balance.reserved
        summary["on_hand"] += balance.on_hand
        summary["reserved"] += balance.reserved
        summary["available"] += available
        if available <= 0:
            summary["out_of_stock"] += 1
        elif balance.reorder_point > 0 and available <= balance.reorder_point:
            summary["low_stock"] += 1
        total_cost += balance.on_hand * float(variant.default_cost or 0)
        total_retail += balance.on_hand * float(variant.default_retail or 0)
    if can_view_cost(current_user):
        summary["stock_cost"] = round(total_cost, 2)
        summary["stock_retail_value"] = round(total_retail, 2)
    return summary


@router.post("/catalog")
def create_catalog_entry(
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_inventory_write(current_user)
    company_id = resolve_company_id(db, current_user)
    category = str(payload.get("category") or "")
    _guard_cost_write(current_user, payload.get("variant") or {})
    product = create_product(db, company_id=company_id, category=category, data=payload.get("product") or {})
    variant = create_variant(db, company_id=company_id, product=product, data=payload.get("variant") or {})
    clinic_id = payload.get("clinic_id")
    balance = None
    if clinic_id is not None:
        scoped_clinic_id = normalize_clinic_id_for_company(db, current_user, int(clinic_id))
        balance = get_or_create_balance(
            db,
            company_id=company_id,
            clinic_id=scoped_clinic_id,
            variant_id=variant.id,
        )
    _commit_or_conflict(db)
    db.refresh(product)
    db.refresh(variant)
    if balance:
        db.refresh(balance)
    return variant_dict(variant, product, balance=balance, include_cost=can_view_cost(current_user))


@router.post("/products/{product_id}/variants")
def add_variant(
    product_id: int,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_inventory_write(current_user)
    company_id = resolve_company_id(db, current_user)
    product = _company_product(db, company_id, product_id)
    _guard_cost_write(current_user, payload)
    if product.archived_at is not None:
        raise HTTPException(status_code=409, detail="Restore the product before adding a variant")
    variant = create_variant(db, company_id=company_id, product=product, data=payload)
    _commit_or_conflict(db)
    db.refresh(variant)
    return variant_dict(variant, product, include_cost=can_view_cost(current_user))


@router.put("/products/{product_id}")
def update_product(
    product_id: int,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_inventory_write(current_user)
    company_id = resolve_company_id(db, current_user)
    product = _company_product(db, company_id, product_id)
    cleaned = validate_product_data(product.category, {**product_dict(product), **payload})
    next_key = f"{product.category}|{normalized_product_key(cleaned)}"
    duplicate = db.query(CatalogProduct.id).filter(
        CatalogProduct.company_id == company_id,
        CatalogProduct.category == product.category,
        CatalogProduct.normalized_key == next_key,
        CatalogProduct.id != product.id,
    ).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="Catalog product already exists")
    for field, value in cleaned.items():
        setattr(product, field, value)
    product.normalized_key = next_key
    fingerprints: set[str] = set()
    product_data = {**cleaned}
    for variant in db.query(CatalogVariant).filter(CatalogVariant.product_id == product.id).all():
        fingerprint = normalized_variant_fingerprint(product.category, product_data, variant.attributes or {})
        if fingerprint in fingerprints or db.query(CatalogVariant.id).filter(
            CatalogVariant.company_id == company_id,
            CatalogVariant.normalized_fingerprint == fingerprint,
            CatalogVariant.id != variant.id,
        ).first():
            raise HTTPException(status_code=409, detail="Product edit would create a duplicate variant")
        fingerprints.add(fingerprint)
        variant.normalized_fingerprint = fingerprint
    _commit_or_conflict(db)
    db.refresh(product)
    return product_dict(product)


@router.put("/variants/{variant_id}")
def update_variant(
    variant_id: int,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_inventory_write(current_user)
    company_id = resolve_company_id(db, current_user)
    variant = get_company_variant(db, company_id, variant_id)
    product = _company_product(db, company_id, variant.product_id)
    _guard_cost_write(current_user, payload)
    requested_stockable = bool(payload.get("is_stockable", variant.is_stockable))
    attributes, complete, _ = validate_variant_attributes(
        product.category,
        product,
        payload.get("attributes", variant.attributes or {}),
        requested_stockable=requested_stockable,
    )
    product_data = product_dict(product)
    fingerprint = normalized_variant_fingerprint(product.category, product_data, attributes)
    if db.query(CatalogVariant.id).filter(
        CatalogVariant.company_id == company_id,
        CatalogVariant.normalized_fingerprint == fingerprint,
        CatalogVariant.id != variant.id,
    ).first():
        raise HTTPException(status_code=409, detail="Catalog variant already exists")
    for field in ("sku", "barcode"):
        if field in payload:
            value = str(payload.get(field) or "").strip() or None
            if value and db.query(CatalogVariant.id).filter(
                CatalogVariant.company_id == company_id,
                getattr(CatalogVariant, field) == value,
                CatalogVariant.id != variant.id,
            ).first():
                raise HTTPException(status_code=409, detail=f"{field} already exists")
            setattr(variant, field, value)
    variant.attributes = attributes
    variant.normalized_fingerprint = fingerprint
    variant.is_stockable = requested_stockable and complete
    if "default_cost" in payload:
        variant.default_cost = _validate_price(payload.get("default_cost"), "default_cost")
    if "default_retail" in payload:
        variant.default_retail = _validate_price(payload.get("default_retail"), "default_retail")
    _commit_or_conflict(db)
    db.refresh(variant)
    return variant_dict(variant, product, include_cost=can_view_cost(current_user))


@router.put("/catalog/{variant_id}")
def update_catalog_entry(
    variant_id: int,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a product and its selected variant in one transaction."""
    require_inventory_write(current_user)
    company_id = resolve_company_id(db, current_user)
    variant = get_company_variant(db, company_id, variant_id)
    product = _company_product(db, company_id, variant.product_id)
    product_payload = payload.get("product") or {}
    variant_payload = payload.get("variant") or {}
    if not isinstance(product_payload, dict) or not isinstance(variant_payload, dict):
        raise HTTPException(status_code=422, detail="Invalid catalog update")
    _guard_cost_write(current_user, variant_payload)

    cleaned_product = validate_product_data(
        product.category,
        {**product_dict(product), **product_payload},
    )
    next_key = f"{product.category}|{normalized_product_key(cleaned_product)}"
    if db.query(CatalogProduct.id).filter(
        CatalogProduct.company_id == company_id,
        CatalogProduct.category == product.category,
        CatalogProduct.normalized_key == next_key,
        CatalogProduct.id != product.id,
    ).first():
        raise HTTPException(status_code=409, detail="Catalog product already exists")

    requested_stockable = bool(
        variant_payload.get("is_stockable", variant.is_stockable)
    )
    selected_attributes, selected_complete, _ = validate_variant_attributes(
        product.category,
        cleaned_product,
        variant_payload.get("attributes", variant.attributes or {}),
        requested_stockable=requested_stockable,
    )
    product_variants = (
        db.query(CatalogVariant)
        .filter(CatalogVariant.product_id == product.id)
        .all()
    )
    fingerprints: dict[int, str] = {}
    seen: set[str] = set()
    for candidate in product_variants:
        attributes = (
            selected_attributes if candidate.id == variant.id else candidate.attributes or {}
        )
        fingerprint = normalized_variant_fingerprint(
            product.category,
            cleaned_product,
            attributes,
        )
        if fingerprint in seen or db.query(CatalogVariant.id).filter(
            CatalogVariant.company_id == company_id,
            CatalogVariant.product_id != product.id,
            CatalogVariant.normalized_fingerprint == fingerprint,
        ).first():
            raise HTTPException(
                status_code=409,
                detail="Catalog update would create a duplicate variant",
            )
        seen.add(fingerprint)
        fingerprints[candidate.id] = fingerprint

    for field in ("sku", "barcode"):
        if field not in variant_payload:
            continue
        value = str(variant_payload.get(field) or "").strip() or None
        if value and db.query(CatalogVariant.id).filter(
            CatalogVariant.company_id == company_id,
            getattr(CatalogVariant, field) == value,
            CatalogVariant.id != variant.id,
        ).first():
            raise HTTPException(status_code=409, detail=f"{field} already exists")
        setattr(variant, field, value)

    for field, value in cleaned_product.items():
        setattr(product, field, value)
    product.normalized_key = next_key
    for candidate in product_variants:
        candidate.normalized_fingerprint = fingerprints[candidate.id]
    variant.attributes = selected_attributes
    variant.is_stockable = requested_stockable and selected_complete
    if "default_cost" in variant_payload:
        variant.default_cost = _validate_price(
            variant_payload.get("default_cost"),
            "default_cost",
        )
    if "default_retail" in variant_payload:
        variant.default_retail = _validate_price(
            variant_payload.get("default_retail"),
            "default_retail",
        )
    _commit_or_conflict(db)
    db.refresh(product)
    db.refresh(variant)
    return variant_dict(
        variant,
        product,
        include_cost=can_view_cost(current_user),
    )


@router.post("/products/{product_id}/archive")
def archive_product(
    product_id: int,
    restore: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_inventory_write(current_user)
    company_id = resolve_company_id(db, current_user)
    product = _company_product(db, company_id, product_id)
    product_variants = db.query(CatalogVariant).filter(
        CatalogVariant.product_id == product.id
    ).all()
    variant_ids = [variant.id for variant in product_variants]
    if not restore and variant_ids:
        has_stock = db.query(InventoryBalance.id).filter(
            InventoryBalance.variant_id.in_(variant_ids),
            (InventoryBalance.on_hand > 0) | (InventoryBalance.reserved > 0),
        ).first()
        has_allocations = db.query(OrderInventoryAllocation.id).filter(
            OrderInventoryAllocation.variant_id.in_(variant_ids),
            OrderInventoryAllocation.lifecycle_state.in_(("reserved", "supplier_ordered")),
        ).first()
        if has_stock or has_allocations:
            raise HTTPException(
                status_code=409,
                detail="Remove stock and resolve active orders before archiving this product",
            )
    product.archived_at = None if restore else datetime.now(timezone.utc)
    for variant in product_variants:
        variant.archived_at = None if restore else product.archived_at
    db.commit()
    return product_dict(product)


@router.post("/variants/{variant_id}/archive")
def archive_variant(
    variant_id: int,
    restore: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_inventory_write(current_user)
    company_id = resolve_company_id(db, current_user)
    variant = get_company_variant(db, company_id, variant_id)
    if not restore:
        has_stock = db.query(InventoryBalance.id).filter(
            InventoryBalance.variant_id == variant.id,
            (InventoryBalance.on_hand > 0) | (InventoryBalance.reserved > 0),
        ).first()
        has_allocations = db.query(OrderInventoryAllocation.id).filter(
            OrderInventoryAllocation.variant_id == variant.id,
            OrderInventoryAllocation.lifecycle_state.in_(("reserved", "supplier_ordered")),
        ).first()
        if has_stock or has_allocations:
            raise HTTPException(
                status_code=409,
                detail="Remove stock and resolve active orders before archiving this variant",
            )
    variant.archived_at = None if restore else datetime.now(timezone.utc)
    db.commit()
    product = _company_product(db, company_id, variant.product_id)
    return variant_dict(variant, product, include_cost=can_view_cost(current_user))


@router.post("/balances/{variant_id}/adjust")
def adjust_balance(
    variant_id: int,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_inventory_write(current_user)
    company_id = resolve_company_id(db, current_user)
    clinic_id = normalize_clinic_id_for_company(db, current_user, payload.get("clinic_id"))
    try:
        delta = int(payload.get("on_hand_delta"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="on_hand_delta must be an integer")
    balance = apply_balance_change(
        db,
        company_id=company_id,
        clinic_id=clinic_id,
        variant_id=variant_id,
        on_hand_delta=delta,
        reserved_delta=0,
        movement_type=str(payload.get("movement_type") or "adjustment"),
        reason=str(payload.get("reason") or ""),
        actor_user_id=current_user.id,
        idempotency_key=str(payload.get("idempotency_key") or "").strip() or None,
        expected_version=payload.get("expected_version"),
    )
    try:
        reorder_point = int(payload.get("reorder_point", balance.reorder_point))
        target_quantity = int(payload.get("target_quantity", balance.target_quantity))
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="Invalid reorder policy")
    if reorder_point < 0 or target_quantity < 0 or (
        target_quantity and target_quantity < reorder_point
    ):
        raise HTTPException(status_code=422, detail="Invalid reorder policy")
    balance.reorder_point = reorder_point
    balance.target_quantity = target_quantity
    db.commit()
    db.refresh(balance)
    return balance_dict(balance)


@router.put("/balances/{variant_id}/policy")
def update_balance_policy(
    variant_id: int,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_inventory_write(current_user)
    company_id = resolve_company_id(db, current_user)
    clinic_id = normalize_clinic_id_for_company(db, current_user, payload.get("clinic_id"))
    get_company_variant(db, company_id, variant_id)
    balance = get_or_create_balance(
        db,
        company_id=company_id,
        clinic_id=clinic_id,
        variant_id=variant_id,
        lock=True,
    )
    try:
        reorder_point = int(payload.get("reorder_point", balance.reorder_point))
        target_quantity = int(payload.get("target_quantity", balance.target_quantity))
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="Invalid reorder policy")
    if reorder_point < 0 or target_quantity < 0 or (target_quantity and target_quantity < reorder_point):
        raise HTTPException(status_code=422, detail="Invalid reorder policy")
    balance.reorder_point = reorder_point
    balance.target_quantity = target_quantity
    balance.version += 1
    db.commit()
    db.refresh(balance)
    return balance_dict(balance)


@router.post("/counts")
def physical_count(
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_inventory_write(current_user)
    company_id = resolve_company_id(db, current_user)
    clinic_id = normalize_clinic_id_for_company(db, current_user, payload.get("clinic_id"))
    reason = str(payload.get("reason") or "Physical stock count").strip()
    items = payload.get("items")
    if not isinstance(items, list) or not items:
        raise HTTPException(status_code=422, detail="Count items are required")
    results = []
    seen_variant_ids: set[int] = set()
    for index, item in enumerate(items):
        try:
            variant_id = int(item.get("variant_id"))
            counted = int(item.get("counted_quantity"))
        except (AttributeError, TypeError, ValueError):
            raise HTTPException(status_code=422, detail=f"Invalid count row {index + 1}")
        if counted < 0:
            raise HTTPException(status_code=422, detail="Counted quantity cannot be negative")
        if variant_id in seen_variant_ids:
            raise HTTPException(status_code=422, detail="Duplicate variant in count")
        seen_variant_ids.add(variant_id)
        get_company_variant(db, company_id, variant_id)
        balance = get_or_create_balance(
            db,
            company_id=company_id,
            clinic_id=clinic_id,
            variant_id=variant_id,
            lock=True,
        )
        if counted < balance.reserved:
            raise HTTPException(status_code=409, detail="Count cannot be below reserved quantity")
        delta = counted - balance.on_hand
        if delta:
            balance = apply_balance_change(
                db,
                company_id=company_id,
                clinic_id=clinic_id,
                variant_id=variant_id,
                on_hand_delta=delta,
                reserved_delta=0,
                movement_type="physical_count",
                reason=reason,
                actor_user_id=current_user.id,
                idempotency_key=f"{payload.get('idempotency_key')}:{variant_id}" if payload.get("idempotency_key") else None,
                metadata={"counted_quantity": counted},
            )
        results.append(balance_dict(balance))
    db.commit()
    return {"items": results, "counted": len(results)}


@router.get("/movements")
def list_movements(
    clinic_id: Optional[int] = Query(None),
    variant_id: Optional[int] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    company_id = resolve_company_id(db, current_user)
    scoped_clinic_id = normalize_clinic_id_for_company(db, current_user, clinic_id)
    query = (
        db.query(InventoryMovement, CatalogVariant, CatalogProduct)
        .join(CatalogVariant, CatalogVariant.id == InventoryMovement.variant_id)
        .join(CatalogProduct, CatalogProduct.id == CatalogVariant.product_id)
        .filter(
            InventoryMovement.company_id == company_id,
            InventoryMovement.clinic_id == scoped_clinic_id,
        )
    )
    if variant_id is not None:
        query = query.filter(InventoryMovement.variant_id == variant_id)
    rows = query.order_by(InventoryMovement.created_at.desc(), InventoryMovement.id.desc()).limit(limit).all()
    return {"items": [movement_dict(movement, variant=variant, product=product) for movement, variant, product in rows]}


@router.get("/orders/{order_kind}/{order_id}/allocations")
def get_order_allocations(
    order_kind: str,
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    company_id = resolve_company_id(db, current_user)
    if order_kind == "contact":
        order = db.query(ContactLensOrder).filter(ContactLensOrder.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        normalize_clinic_id_for_company(db, current_user, order.clinic_id)
        query = db.query(OrderInventoryAllocation).filter(OrderInventoryAllocation.contact_lens_order_id == order.id)
    elif order_kind == "regular":
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        normalize_clinic_id_for_company(db, current_user, order.clinic_id)
        query = db.query(OrderInventoryAllocation).filter(OrderInventoryAllocation.order_id == order.id)
    else:
        raise HTTPException(status_code=422, detail="Invalid order kind")
    rows = (
        query.join(CatalogVariant, CatalogVariant.id == OrderInventoryAllocation.variant_id)
        .join(CatalogProduct, CatalogProduct.id == CatalogVariant.product_id)
        .filter(OrderInventoryAllocation.company_id == company_id)
        .with_entities(OrderInventoryAllocation, CatalogVariant, CatalogProduct)
        .all()
    )
    items = []
    for allocation, variant, product in rows:
        balance = db.query(InventoryBalance).filter(
            InventoryBalance.clinic_id == allocation.clinic_id,
            InventoryBalance.variant_id == variant.id,
        ).first()
        item = allocation_dict(allocation)
        item["variant"] = variant_dict(
            variant,
            product,
            balance=balance,
            include_cost=can_view_cost(current_user),
        )
        items.append(item)
    return {"items": items}


@router.get("/settings")
def get_inventory_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    company_id = resolve_company_id(db, current_user)
    settings = db.query(InventoryCompanySettings).filter(InventoryCompanySettings.company_id == company_id).first()
    existing_order_count = (
        db.query(Order.id)
        .join(Clinic, Clinic.id == Order.clinic_id)
        .filter(Clinic.company_id == company_id)
        .count()
        + db.query(ContactLensOrder.id)
        .join(Clinic, Clinic.id == ContactLensOrder.clinic_id)
        .filter(Clinic.company_id == company_id)
        .count()
    )
    return {
        "default_reorder_point": settings.default_reorder_point if settings else 0,
        "default_target_quantity": settings.default_target_quantity if settings else 0,
        "discovery_intro_acknowledged": bool(settings and settings.discovery_intro_acknowledged_at),
        "should_offer_discovery": bool(existing_order_count and not (settings and settings.discovery_intro_acknowledged_at)),
        "existing_order_count": existing_order_count,
    }


@router.post("/settings/acknowledge-discovery")
def acknowledge_discovery(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_inventory_write(current_user)
    company_id = resolve_company_id(db, current_user)
    settings = db.query(InventoryCompanySettings).filter(InventoryCompanySettings.company_id == company_id).first()
    if not settings:
        settings = InventoryCompanySettings(company_id=company_id)
        db.add(settings)
    settings.discovery_intro_acknowledged_at = datetime.now(timezone.utc)
    db.commit()
    return {"acknowledged": True}


@router.post("/discovery/preview")
def preview_discovery(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_inventory_write(current_user)
    company_id = resolve_company_id(db, current_user)
    # Deliberately read-only: persisted candidates and catalog rows are created
    # only by the confirmation endpoint.
    return discover_from_orders(db, company_id)


@router.post("/discovery/confirm")
def confirm_discovery_candidates(
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_inventory_write(current_user)
    company_id = resolve_company_id(db, current_user)
    candidates = payload.get("candidates")
    if not isinstance(candidates, list):
        raise HTTPException(status_code=422, detail="Discovery candidates are required")
    return confirm_discovery(
        db,
        company_id=company_id,
        current_user=current_user,
        candidates=candidates,
    )


def _csv_row_to_payload(row: dict[str, Any]) -> dict[str, Any]:
    category_raw = str(row.get("category") or row.get("type") or "").strip().casefold()
    category = "contact_lens" if category_raw in {"contact", "contact_lens", "contacts", "עדשות מגע"} else "frame" if category_raw in {"frame", "frames", "מסגרת"} else category_raw
    product = {
        "brand": row.get("brand") or row.get("manufacturer"),
        "model": row.get("model"),
        "product_type": row.get("product_type") or row.get("lens_type") or row.get("frame_type"),
        "material": row.get("material"),
        "preferred_supplier": row.get("preferred_supplier") or row.get("supplier"),
        "replacement_schedule": row.get("replacement_schedule"),
    }
    attribute_fields = (
        "color", "eye_size", "bridge", "temple_length", "height",
        "sph", "bc", "dia", "pack_size", "cyl", "axis", "add", "design",
    )
    attributes = {field: row.get(field) for field in attribute_fields if row.get(field) not in (None, "")}
    for numeric_field in ("eye_size", "bridge", "temple_length", "height", "pack_size", "axis"):
        if numeric_field in attributes:
            try:
                attributes[numeric_field] = int(float(attributes[numeric_field]))
            except (TypeError, ValueError):
                pass
    variant = {
        "attributes": attributes,
        "sku": row.get("sku"),
        "barcode": row.get("barcode"),
        "default_cost": row.get("default_cost") or row.get("cost"),
        "default_retail": row.get("default_retail") or row.get("retail"),
        "is_stockable": str(row.get("is_stockable") or "true").strip().casefold() not in {"false", "0", "no"},
    }
    return {
        "category": category,
        "product": product,
        "variant": variant,
        "on_hand": row.get("on_hand") or 0,
        "reorder_point": row.get("reorder_point") or 0,
        "target_quantity": row.get("target_quantity") or 0,
    }


@router.post("/import/preview")
def preview_import(
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    company_id = resolve_company_id(db, current_user)
    csv_text = payload.get("csv_text")
    if not isinstance(csv_text, str) or not csv_text.strip():
        raise HTTPException(status_code=422, detail="CSV content is required")
    try:
        reader = csv.DictReader(io.StringIO(csv_text.lstrip("\ufeff")))
        source_rows = list(reader)
    except csv.Error as exc:
        raise HTTPException(status_code=422, detail=f"Invalid CSV: {exc}")
    if not source_rows:
        raise HTTPException(status_code=422, detail="CSV has no data rows")

    results = []
    seen: set[str] = set()
    seen_skus: set[str] = set()
    seen_barcodes: set[str] = set()
    for index, source in enumerate(source_rows, start=2):
        mapped = _csv_row_to_payload(source)
        errors: list[str] = []
        fingerprint = ""
        try:
            cleaned_product = validate_product_data(mapped["category"], mapped["product"])
            attributes, complete, missing = validate_variant_attributes(
                mapped["category"],
                cleaned_product,
                mapped["variant"]["attributes"],
                requested_stockable=bool(mapped["variant"]["is_stockable"]),
            )
            mapped["product"] = cleaned_product
            mapped["variant"]["attributes"] = attributes
            mapped["variant"]["is_stockable"] = complete and bool(mapped["variant"]["is_stockable"])
            mapped["variant"]["default_cost"] = _validate_price(
                mapped["variant"].get("default_cost"),
                "default_cost",
            )
            mapped["variant"]["default_retail"] = _validate_price(
                mapped["variant"].get("default_retail"),
                "default_retail",
            )
            fingerprint = normalized_variant_fingerprint(mapped["category"], cleaned_product, attributes)
            if fingerprint in seen:
                errors.append("Duplicate row in file")
            seen.add(fingerprint)
            if db.query(CatalogVariant.id).filter(
                CatalogVariant.company_id == company_id,
                CatalogVariant.normalized_fingerprint == fingerprint,
            ).first():
                errors.append("Variant already exists")
            for field, seen_values in (
                ("sku", seen_skus),
                ("barcode", seen_barcodes),
            ):
                value = str(mapped["variant"].get(field) or "").strip()
                if not value:
                    continue
                if value in seen_values:
                    errors.append(f"Duplicate {field} in file")
                seen_values.add(value)
                if db.query(CatalogVariant.id).filter(
                    CatalogVariant.company_id == company_id,
                    getattr(CatalogVariant, field) == value,
                ).first():
                    errors.append(f"{field} already exists")
            if missing:
                errors.append("Missing: " + ", ".join(missing))
            for quantity_field in ("on_hand", "reorder_point", "target_quantity"):
                try:
                    mapped[quantity_field] = int(float(mapped[quantity_field] or 0))
                    if mapped[quantity_field] < 0:
                        errors.append(f"{quantity_field} cannot be negative")
                except (TypeError, ValueError):
                    errors.append(f"{quantity_field} must be an integer")
        except HTTPException as exc:
            detail = exc.detail.get("message") if isinstance(exc.detail, dict) else exc.detail
            errors.append(str(detail))
        results.append({
            "row_number": index,
            "status": "valid" if not errors else "invalid",
            "errors": errors,
            "fingerprint": fingerprint,
            "data": mapped,
        })
    return {
        "rows": results,
        "total": len(results),
        "valid": sum(row["status"] == "valid" for row in results),
        "invalid": sum(row["status"] != "valid" for row in results),
    }


@router.post("/import/commit")
def commit_import(
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_inventory_write(current_user)
    company_id = resolve_company_id(db, current_user)
    clinic_id = normalize_clinic_id_for_company(db, current_user, payload.get("clinic_id"))
    rows = payload.get("rows")
    if not isinstance(rows, list) or not rows:
        raise HTTPException(status_code=422, detail="Validated import rows are required")
    created = 0
    skipped = 0
    for index, row in enumerate(rows):
        data = row.get("data") if isinstance(row, dict) else None
        if not isinstance(data, dict) or row.get("status") != "valid":
            skipped += 1
            continue
        _guard_cost_write(current_user, data.get("variant") or {})
        product = create_product(db, company_id=company_id, category=data["category"], data=data["product"])
        before_id = db.query(CatalogVariant.id).filter(
            CatalogVariant.company_id == company_id,
            CatalogVariant.normalized_fingerprint == row.get("fingerprint"),
        ).scalar()
        variant = create_variant(db, company_id=company_id, product=product, data=data["variant"])
        if before_id:
            skipped += 1
            continue
        balance = get_or_create_balance(
            db,
            company_id=company_id,
            clinic_id=clinic_id,
            variant_id=variant.id,
        )
        balance.reorder_point = int(data.get("reorder_point") or 0)
        balance.target_quantity = int(data.get("target_quantity") or 0)
        on_hand = int(data.get("on_hand") or 0)
        if on_hand:
            apply_balance_change(
                db,
                company_id=company_id,
                clinic_id=clinic_id,
                variant_id=variant.id,
                on_hand_delta=on_hand,
                reserved_delta=0,
                movement_type="import",
                reason="Opening stock imported from CSV",
                actor_user_id=current_user.id,
                idempotency_key=f"import:{payload.get('import_id') or 'manual'}:{index}:{variant.id}",
            )
        created += 1
    _commit_or_conflict(db, "Import contains a duplicate SKU, barcode, or variant")
    return {"created": created, "skipped": skipped}


@router.get("/export", response_class=PlainTextResponse)
def export_inventory(
    clinic_id: Optional[int] = Query(None),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    company_id = resolve_company_id(db, current_user)
    scoped_clinic_id = normalize_clinic_id_for_company(db, current_user, clinic_id)
    rows = _variant_rows(
        db,
        company_id=company_id,
        clinic_id=scoped_clinic_id,
        category=category,
        search=search,
        include_archived=True,
        limit=1000,
    )
    output = io.StringIO()
    attribute_fields = [
        "color",
        "eye_size",
        "bridge",
        "temple_length",
        "height",
        "sph",
        "bc",
        "dia",
        "pack_size",
        "cyl",
        "axis",
        "add",
        "design",
    ]
    fields = [
        "category", "brand", "model", "product_type", "material", "preferred_supplier",
        "replacement_schedule", "sku", "barcode", *attribute_fields, "default_retail",
        "on_hand", "reserved", "available", "reorder_point", "target_quantity", "archived",
    ]
    if can_view_cost(current_user):
        fields.insert(fields.index("default_retail"), "default_cost")
    writer = csv.DictWriter(output, fieldnames=fields)
    writer.writeheader()
    for variant, product, balance in rows:
        balance = balance or InventoryBalance(on_hand=0, reserved=0, reorder_point=0, target_quantity=0)
        row = {
            "category": product.category,
            "brand": product.brand,
            "model": product.model,
            "product_type": product.product_type,
            "material": product.material,
            "preferred_supplier": product.preferred_supplier,
            "replacement_schedule": product.replacement_schedule,
            "sku": variant.sku,
            "barcode": variant.barcode,
            "default_retail": variant.default_retail,
            "on_hand": balance.on_hand,
            "reserved": balance.reserved,
            "available": balance.on_hand - balance.reserved,
            "reorder_point": balance.reorder_point,
            "target_quantity": balance.target_quantity,
            "archived": bool(product.archived_at or variant.archived_at),
        }
        row.update(
            {
                field: (variant.attributes or {}).get(field)
                for field in attribute_fields
            }
        )
        if can_view_cost(current_user):
            row["default_cost"] = variant.default_cost
        writer.writerow(row)
    return PlainTextResponse(
        content="\ufeff" + output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="inventory-{date.today().isoformat()}.csv"'},
    )


@router.get("/insights")
def inventory_insights(
    clinic_id: Optional[int] = Query(None),
    days: int = Query(90, ge=30, le=365),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    bucket: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    company_id = resolve_company_id(db, current_user)
    scoped_clinic_id = normalize_clinic_id_for_company(db, current_user, clinic_id)
    window = resolve_analytics_window(start_date, end_date, bucket, default_days=days)
    rows = _variant_rows(
        db,
        company_id=company_id,
        clinic_id=scoped_clinic_id,
        stockable_only=True,
        limit=1000,
    )
    range_start = datetime.combine(window.previous_start, datetime.min.time()).replace(tzinfo=timezone.utc)
    range_end = datetime.combine(window.end_date + timedelta(days=1), datetime.min.time()).replace(tzinfo=timezone.utc)
    consumed = (
        db.query(InventoryMovement)
        .filter(
            InventoryMovement.company_id == company_id,
            InventoryMovement.clinic_id == scoped_clinic_id,
            InventoryMovement.movement_type == "consume",
            InventoryMovement.created_at >= range_start,
            InventoryMovement.created_at < range_end,
        )
        .all()
    )
    observations = (
        db.query(CatalogOrderObservation)
        .filter(
            CatalogOrderObservation.company_id == company_id,
            CatalogOrderObservation.clinic_id == scoped_clinic_id,
            CatalogOrderObservation.observed_on <= window.end_date,
        )
        .all()
    )
    events = _inventory_demand_events(observations, consumed, window.previous_start)

    demand: dict[int, int] = defaultdict(int)
    previous_demand: dict[int, int] = defaultdict(int)
    category_by_variant = {variant.id: product.category for variant, product, _ in rows}
    demand_series = empty_series(window, ("consumed", "frame", "contact_lens"))
    for event in events:
        event_date = event["date"]
        if window.start_date <= event_date <= window.end_date:
            demand[event["variant_id"]] += event["quantity"]
            add_to_series(demand_series, window, event_date, "consumed", event["quantity"])
            category = category_by_variant.get(event["variant_id"])
            if category in {"frame", "contact_lens"}:
                add_to_series(demand_series, window, event_date, category, event["quantity"])
        elif window.previous_start <= event_date <= window.previous_end:
            previous_demand[event["variant_id"]] += event["quantity"]

    allocations = (
        db.query(OrderInventoryAllocation)
        .filter(
            OrderInventoryAllocation.company_id == company_id,
            OrderInventoryAllocation.clinic_id == scoped_clinic_id,
            OrderInventoryAllocation.created_at >= range_start,
            OrderInventoryAllocation.created_at < range_end,
        )
        .all()
    )
    current_allocations = [row for row in allocations if window.start_date <= row.created_at.date() <= window.end_date]
    previous_allocations = [row for row in allocations if window.previous_start <= row.created_at.date() <= window.previous_end]

    def inventory_ratio(allocation_rows: list[OrderInventoryAllocation]) -> float:
        total = sum(max(0, int(row.quantity or 0)) for row in allocation_rows)
        from_inventory = sum(
            max(0, int(row.quantity or 0)) for row in allocation_rows if row.fulfillment_source == "inventory"
        )
        return round((from_inventory / total * 100), 1) if total else 0

    items = []
    for variant, product, balance in rows:
        balance = balance or InventoryBalance(on_hand=0, reserved=0, reorder_point=0, target_quantity=0)
        units = demand.get(variant.id, 0)
        velocity = units / window.days
        available = balance.on_hand - balance.reserved
        days_cover = round(available / velocity, 1) if velocity > 0 else None
        if available <= 0 and units > 0:
            risk = "out_of_stock"
        elif days_cover is not None and days_cover <= 14:
            risk = "high"
        elif balance.reorder_point and available <= balance.reorder_point:
            risk = "medium"
        else:
            risk = "low"
        reorder_quantity = (
            max(0, balance.target_quantity - available)
            if balance.target_quantity > 0 and available <= balance.reorder_point
            else 0
        )
        confidence = "high" if units >= 12 else "medium" if units >= 4 else "low"
        item = {
            "variant": variant_dict(variant, product, balance=balance, include_cost=can_view_cost(current_user)),
            "units_demanded": units,
            "daily_velocity": round(velocity, 3),
            "days_cover": days_cover,
            "stockout_risk": risk,
            "reorder_quantity": reorder_quantity,
            "confidence": confidence,
        }
        items.append(item)
    top_consumed = sorted(
        (item for item in items if item["units_demanded"] > 0),
        key=lambda item: item["units_demanded"],
        reverse=True,
    )[:10]
    reorder = [item for item in items if item["reorder_quantity"] > 0]
    slow_moving = [item for item in items if item["units_demanded"] == 0 and item["variant"]["balance"]["on_hand"] > 0][:20]
    current_consumed = sum(demand.values())
    previous_consumed = sum(previous_demand.values())
    out_of_stock = sum(1 for item in items if item["variant"]["balance"]["available"] <= 0)
    slow_value = sum(
        float(item["variant"].get("default_cost") or 0) * int(item["variant"]["balance"]["on_hand"] or 0)
        for item in slow_moving
    )
    fulfillment_series = [
        {
            "source": "מלאי קיים" if source == "inventory" else "הזמנת ספק",
            "quantity": sum(int(row.quantity or 0) for row in current_allocations if row.fulfillment_source == source),
        }
        for source in ("inventory", "supplier_ordered")
    ]
    metrics = [
        metric_payload("consumed", "יחידות שנצרכו", current_consumed, previous_consumed, demand_series, series_field="consumed"),
        metric_payload(
            "inventory_fulfillment",
            "אספקה מהמלאי",
            inventory_ratio(current_allocations),
            inventory_ratio(previous_allocations),
            [],
            series_field="inventory_fulfillment",
        ),
        metric_payload("reorder", "דורשים הזמנה", len(reorder), 0, [], series_field="reorder", snapshot=True, context="לפי המלאי הנוכחי"),
        metric_payload("out_of_stock", "אזלו מהמלאי", out_of_stock, 0, [], series_field="out_of_stock", snapshot=True, context="לפי המלאי הנוכחי"),
        metric_payload(
            "slow_stock",
            "מלאי ללא תנועה",
            slow_value if can_view_cost(current_user) else len(slow_moving),
            0,
            [],
            series_field="slow_stock",
            snapshot=True,
            context="שווי עלות" if can_view_cost(current_user) else "מספר פריטים",
        ),
    ]
    observed_dates = [event["date"] for event in events]
    confidence = "high" if current_consumed >= 24 else "medium" if current_consumed >= 8 else "low"
    return {
        "period_days": window.days,
        "range": {
            "start_date": window.start_date,
            "end_date": window.end_date,
            "previous_start": window.previous_start,
            "previous_end": window.previous_end,
            "bucket": window.bucket,
        },
        "metrics": metrics,
        "demand_series": demand_series,
        "fulfillment_mix": fulfillment_series,
        "top_consumed": top_consumed,
        "reorder_suggestions": reorder,
        "slow_moving": slow_moving,
        "seasonality_available": False,
        "data_quality": {
            "confidence": confidence,
            "first_observation": min(observed_dates).isoformat() if observed_dates else None,
            "observations": sum(event["source"] == "observation" for event in events),
            "movements": sum(event["source"] == "movement" for event in events),
            "deduplicated": True,
        },
        "method": "Confirmed order observations, with unmatched consumption movements as fallback",
    }
