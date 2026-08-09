import hashlib
import json
import re
import unicodedata
from datetime import date, datetime, timezone
from typing import Any, Iterable, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models import (
    CatalogProduct,
    CatalogVariant,
    ContactLensOrder,
    InventoryBalance,
    InventoryMovement,
    Order,
    OrderInventoryAllocation,
    User,
)


INVENTORY_WRITE_LEVEL = 2
COST_VISIBILITY_LEVEL = 3
ACTIVE_ALLOCATION_STATES = {"reserved", "supplier_ordered"}
DELIVERED_STATUSES = {
    "delivered",
    "completed",
    "נמסר ללקוח",
    "נמסרה",
    "נסגרה",
}
CANCELLED_MARKERS = ("cancel", "בוטל", "מבוטל")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    text = unicodedata.normalize("NFKC", str(value)).strip().casefold()
    return re.sub(r"\s+", " ", text)


def normalized_product_key(data: dict[str, Any]) -> str:
    fields = (
        data.get("brand"),
        data.get("model"),
        data.get("product_type"),
        data.get("material"),
        data.get("replacement_schedule"),
    )
    return "|".join(normalize_text(value) for value in fields)


def _normalized_json(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            str(key): _normalized_json(item)
            for key, item in sorted(value.items())
            if item not in (None, "")
        }
    if isinstance(value, list):
        return [_normalized_json(item) for item in value]
    if isinstance(value, str):
        return normalize_text(value)
    return value


def _json_safe(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    return value


def normalized_variant_fingerprint(
    category: str,
    product_data: dict[str, Any],
    attributes: dict[str, Any],
) -> str:
    payload = {
        "category": category,
        "product": normalized_product_key(product_data),
        "attributes": _normalized_json(attributes),
    }
    return hashlib.sha256(
        json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()


def snapshot_fingerprint(value: dict[str, Any]) -> str:
    return hashlib.sha256(
        json.dumps(_normalized_json(value), ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()


def require_inventory_write(current_user: User) -> None:
    if (current_user.role_level or 1) < INVENTORY_WRITE_LEVEL:
        raise HTTPException(status_code=403, detail="Inventory is read-only for viewer users")


def can_view_cost(current_user: User) -> bool:
    return (current_user.role_level or 1) >= COST_VISIBILITY_LEVEL


def validate_product_data(category: str, data: dict[str, Any]) -> dict[str, Any]:
    if category not in {"frame", "contact_lens"}:
        raise HTTPException(status_code=422, detail="category must be frame or contact_lens")
    cleaned = {
        "brand": str(data.get("brand") or "").strip() or None,
        "model": str(data.get("model") or "").strip(),
        "product_type": str(data.get("product_type") or "").strip() or None,
        "material": str(data.get("material") or "").strip() or None,
        "preferred_supplier": str(data.get("preferred_supplier") or "").strip() or None,
        "replacement_schedule": str(data.get("replacement_schedule") or "").strip() or None,
    }
    if not cleaned["model"]:
        raise HTTPException(status_code=422, detail="Product model is required")
    if not cleaned["brand"]:
        raise HTTPException(status_code=422, detail="Brand or manufacturer is required")
    if category == "frame":
        cleaned["replacement_schedule"] = None
    return cleaned


def contact_variant_missing_fields(product: CatalogProduct | dict[str, Any], attributes: dict[str, Any]) -> list[str]:
    missing: list[str] = []
    product_brand = product.brand if isinstance(product, CatalogProduct) else product.get("brand")
    product_model = product.model if isinstance(product, CatalogProduct) else product.get("model")
    if not normalize_text(product_brand):
        missing.append("manufacturer")
    if not normalize_text(product_model):
        missing.append("model")
    for field in ("sph", "bc", "dia", "pack_size"):
        if attributes.get(field) in (None, ""):
            missing.append(field)

    lens_type = normalize_text(
        product.product_type if isinstance(product, CatalogProduct) else product.get("product_type")
    )
    is_toric = any(marker in lens_type for marker in ("toric", "טורי", "צילינדר")) or any(
        attributes.get(field) not in (None, "") for field in ("cyl", "axis")
    )
    if is_toric:
        for field in ("cyl", "axis"):
            if attributes.get(field) in (None, ""):
                missing.append(field)

    is_multifocal = any(marker in lens_type for marker in ("multifocal", "מולטיפוק", "רב מוקדי")) or any(
        attributes.get(field) not in (None, "") for field in ("add", "design")
    )
    if is_multifocal and attributes.get("add") in (None, ""):
        missing.append("add")
    return missing


def validate_variant_attributes(
    category: str,
    product: CatalogProduct | dict[str, Any],
    attributes: dict[str, Any],
    *,
    requested_stockable: bool,
) -> tuple[dict[str, Any], bool, list[str]]:
    cleaned = {
        str(key): value.strip() if isinstance(value, str) else value
        for key, value in (attributes or {}).items()
        if value not in (None, "")
    }
    missing: list[str] = []
    if category == "frame":
        for field in ("color", "eye_size"):
            if cleaned.get(field) in (None, ""):
                missing.append(field)
    else:
        missing = contact_variant_missing_fields(product, cleaned)

    if requested_stockable and missing:
        raise HTTPException(
            status_code=422,
            detail={"message": "Variant is missing required stock fields", "missing_fields": missing},
        )
    return cleaned, not missing, missing


def _validate_price(value: Any, field: str) -> Optional[float]:
    if value in (None, ""):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail=f"{field} must be numeric")
    if number < 0:
        raise HTTPException(status_code=422, detail=f"{field} cannot be negative")
    return number


def create_product(
    db: Session,
    *,
    company_id: int,
    category: str,
    data: dict[str, Any],
) -> CatalogProduct:
    cleaned = validate_product_data(category, data)
    normalized_key = f"{category}|{normalized_product_key(cleaned)}"
    existing = (
        db.query(CatalogProduct)
        .filter(CatalogProduct.company_id == company_id)
        .filter(CatalogProduct.category == category)
        .filter(CatalogProduct.normalized_key == normalized_key)
        .first()
    )
    if existing:
        if existing.archived_at is not None:
            existing.archived_at = None
        return existing
    product = CatalogProduct(
        company_id=company_id,
        category=category,
        normalized_key=normalized_key,
        **cleaned,
    )
    db.add(product)
    db.flush()
    return product


def create_variant(
    db: Session,
    *,
    company_id: int,
    product: CatalogProduct,
    data: dict[str, Any],
) -> CatalogVariant:
    if product.company_id != company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    requested_stockable = bool(data.get("is_stockable", True))
    attributes, complete, _ = validate_variant_attributes(
        product.category,
        product,
        data.get("attributes") or {},
        requested_stockable=requested_stockable,
    )
    product_data = {
        "brand": product.brand,
        "model": product.model,
        "product_type": product.product_type,
        "material": product.material,
        "preferred_supplier": product.preferred_supplier,
        "replacement_schedule": product.replacement_schedule,
    }
    fingerprint = normalized_variant_fingerprint(product.category, product_data, attributes)
    existing = (
        db.query(CatalogVariant)
        .filter(CatalogVariant.company_id == company_id)
        .filter(CatalogVariant.normalized_fingerprint == fingerprint)
        .first()
    )
    if existing:
        if existing.archived_at is not None:
            existing.archived_at = None
        return existing

    sku = str(data.get("sku") or "").strip() or None
    barcode = str(data.get("barcode") or "").strip() or None
    for field, value in (("sku", sku), ("barcode", barcode)):
        if value and db.query(CatalogVariant.id).filter(
            CatalogVariant.company_id == company_id,
            getattr(CatalogVariant, field) == value,
        ).first():
            raise HTTPException(status_code=409, detail=f"{field} already exists")

    variant = CatalogVariant(
        company_id=company_id,
        product_id=product.id,
        attributes=attributes,
        normalized_fingerprint=fingerprint,
        sku=sku,
        barcode=barcode,
        default_cost=_validate_price(data.get("default_cost"), "default_cost"),
        default_retail=_validate_price(data.get("default_retail"), "default_retail"),
        currency="ILS",
        is_stockable=bool(requested_stockable and complete),
    )
    db.add(variant)
    db.flush()
    return variant


def product_dict(product: CatalogProduct) -> dict[str, Any]:
    return {
        "id": product.id,
        "company_id": product.company_id,
        "category": product.category,
        "brand": product.brand,
        "model": product.model,
        "product_type": product.product_type,
        "material": product.material,
        "preferred_supplier": product.preferred_supplier,
        "replacement_schedule": product.replacement_schedule,
        "archived_at": product.archived_at,
        "created_at": product.created_at,
        "updated_at": product.updated_at,
    }


def variant_display_name(product: CatalogProduct, variant: CatalogVariant) -> str:
    identity = " ".join(part for part in (product.brand, product.model) if part)
    attributes = variant.attributes or {}
    if product.category == "frame":
        detail = " / ".join(
            str(value)
            for value in (attributes.get("color"), attributes.get("eye_size"))
            if value not in (None, "")
        )
    else:
        detail = " / ".join(
            str(value)
            for value in (
                attributes.get("sph"),
                attributes.get("cyl"),
                attributes.get("axis"),
                f"{attributes.get('pack_size')} pack" if attributes.get("pack_size") else None,
            )
            if value not in (None, "")
        )
    return f"{identity}{' — ' + detail if detail else ''}".strip()


def variant_dict(
    variant: CatalogVariant,
    product: CatalogProduct,
    *,
    balance: InventoryBalance | None = None,
    include_cost: bool = False,
) -> dict[str, Any]:
    payload = {
        "id": variant.id,
        "company_id": variant.company_id,
        "product_id": variant.product_id,
        "product": product_dict(product),
        "display_name": variant_display_name(product, variant),
        "attributes": variant.attributes or {},
        "sku": variant.sku,
        "barcode": variant.barcode,
        "default_retail": variant.default_retail,
        "currency": variant.currency,
        "is_stockable": variant.is_stockable,
        "archived_at": variant.archived_at,
        "created_at": variant.created_at,
        "updated_at": variant.updated_at,
    }
    if include_cost:
        payload["default_cost"] = variant.default_cost
    if balance is not None:
        payload["balance"] = balance_dict(balance)
    return payload


def balance_dict(balance: InventoryBalance) -> dict[str, Any]:
    return {
        "id": balance.id,
        "clinic_id": balance.clinic_id,
        "variant_id": balance.variant_id,
        "on_hand": balance.on_hand,
        "reserved": balance.reserved,
        "available": balance.on_hand - balance.reserved,
        "reorder_point": balance.reorder_point,
        "target_quantity": balance.target_quantity,
        "version": balance.version,
        "updated_at": balance.updated_at,
    }


def get_company_variant(db: Session, company_id: int, variant_id: int) -> CatalogVariant:
    variant = (
        db.query(CatalogVariant)
        .filter(CatalogVariant.id == variant_id, CatalogVariant.company_id == company_id)
        .first()
    )
    if not variant:
        raise HTTPException(status_code=404, detail="Catalog variant not found")
    return variant


def get_or_create_balance(
    db: Session,
    *,
    company_id: int,
    clinic_id: int,
    variant_id: int,
    lock: bool = False,
) -> InventoryBalance:
    query = db.query(InventoryBalance).filter(
        InventoryBalance.company_id == company_id,
        InventoryBalance.clinic_id == clinic_id,
        InventoryBalance.variant_id == variant_id,
    )
    if lock:
        query = query.with_for_update()
    balance = query.first()
    if balance:
        return balance
    balance = InventoryBalance(
        company_id=company_id,
        clinic_id=clinic_id,
        variant_id=variant_id,
        on_hand=0,
        reserved=0,
        reorder_point=0,
        target_quantity=0,
        version=1,
    )
    db.add(balance)
    db.flush()
    return balance


def apply_balance_change(
    db: Session,
    *,
    company_id: int,
    clinic_id: int,
    variant_id: int,
    on_hand_delta: int,
    reserved_delta: int,
    movement_type: str,
    reason: str,
    actor_user_id: int | None,
    order_id: int | None = None,
    contact_lens_order_id: int | None = None,
    idempotency_key: str | None = None,
    metadata: dict[str, Any] | None = None,
    expected_version: int | None = None,
) -> InventoryBalance:
    if not reason or not reason.strip():
        raise HTTPException(status_code=422, detail="A stock movement reason is required")
    if on_hand_delta == 0 and reserved_delta == 0:
        raise HTTPException(status_code=422, detail="Stock movement must change a quantity")
    if idempotency_key:
        existing = db.query(InventoryMovement).filter(
            InventoryMovement.company_id == company_id,
            InventoryMovement.idempotency_key == idempotency_key,
        ).first()
        if existing:
            return db.query(InventoryBalance).filter(InventoryBalance.id == existing.balance_id).one()

    variant = get_company_variant(db, company_id, variant_id)
    if not variant.is_stockable:
        raise HTTPException(status_code=409, detail="Complete this variant before changing stock")

    balance = get_or_create_balance(
        db,
        company_id=company_id,
        clinic_id=clinic_id,
        variant_id=variant_id,
        lock=True,
    )
    if expected_version is not None and balance.version != expected_version:
        raise HTTPException(status_code=409, detail="Stock changed since it was loaded; refresh and try again")
    next_on_hand = balance.on_hand + int(on_hand_delta)
    next_reserved = balance.reserved + int(reserved_delta)
    if next_on_hand < 0 or next_reserved < 0 or next_reserved > next_on_hand:
        raise HTTPException(status_code=409, detail="Insufficient available stock")

    before = balance_dict(balance)
    balance.on_hand = next_on_hand
    balance.reserved = next_reserved
    balance.version += 1
    db.add(
        InventoryMovement(
            company_id=company_id,
            clinic_id=clinic_id,
            variant_id=variant_id,
            balance_id=balance.id,
            movement_type=movement_type,
            on_hand_delta=int(on_hand_delta),
            reserved_delta=int(reserved_delta),
            reason=reason.strip(),
            actor_user_id=actor_user_id,
            order_id=order_id,
            contact_lens_order_id=contact_lens_order_id,
            idempotency_key=idempotency_key,
            movement_metadata={
                **(metadata or {}),
                "before": _json_safe(before),
                "after": {
                    "on_hand": next_on_hand,
                    "reserved": next_reserved,
                    "available": next_on_hand - next_reserved,
                    "version": balance.version,
                },
            },
        )
    )
    db.flush()
    return balance


def movement_dict(
    movement: InventoryMovement,
    *,
    variant: CatalogVariant | None = None,
    product: CatalogProduct | None = None,
) -> dict[str, Any]:
    payload = {
        "id": movement.id,
        "clinic_id": movement.clinic_id,
        "variant_id": movement.variant_id,
        "movement_type": movement.movement_type,
        "on_hand_delta": movement.on_hand_delta,
        "reserved_delta": movement.reserved_delta,
        "reason": movement.reason,
        "actor_user_id": movement.actor_user_id,
        "order_id": movement.order_id,
        "contact_lens_order_id": movement.contact_lens_order_id,
        "metadata": movement.movement_metadata or {},
        "created_at": movement.created_at,
    }
    if variant and product:
        payload["variant"] = variant_dict(variant, product)
    return payload


def regular_component_snapshot(order: Order) -> dict[str, Any]:
    order_data = order.order_data if isinstance(order.order_data, dict) else {}
    tabs = order_data.get("lens_frame_tabs")
    if isinstance(tabs, list) and tabs:
        frame = tabs[0].get("frame") if isinstance(tabs[0], dict) else {}
    else:
        frame = order_data.get("frame") or {}
    if not isinstance(frame, dict):
        frame = {}
    return {
        field: frame.get(field)
        for field in (
            "manufacturer",
            "model",
            "supplier",
            "color",
            "width",
            "bridge",
            "height",
            "length",
            "supplied_by",
        )
    }


def contact_component_snapshot(order: ContactLensOrder, side: str) -> dict[str, Any]:
    order_data = order.order_data if isinstance(order.order_data, dict) else {}
    details = order_data.get("contact-lens-details") or {}
    exam = order_data.get("contact-lens-exam") or {}
    if not isinstance(details, dict):
        details = {}
    if not isinstance(exam, dict):
        exam = {}
    prefix = "r" if side == "right" else "l"
    return {
        "lens_type": details.get(f"{prefix}_type") or getattr(order, f"{prefix}_lens_type", None),
        "model": details.get(f"{prefix}_model") or getattr(order, f"{prefix}_model", None),
        "supplier": details.get(f"{prefix}_supplier") or getattr(order, f"{prefix}_supplier", None),
        "material": details.get(f"{prefix}_material") or getattr(order, f"{prefix}_material", None),
        "color": details.get(f"{prefix}_color") or getattr(order, f"{prefix}_color", None),
        "quantity": details.get(f"{prefix}_quantity") or getattr(order, f"{prefix}_quantity", None),
        "bc": exam.get(f"{prefix}_bc"),
        "dia": exam.get(f"{prefix}_diam"),
        "sph": exam.get(f"{prefix}_sph"),
        "cyl": exam.get(f"{prefix}_cyl"),
        "axis": exam.get(f"{prefix}_ax"),
        "add": exam.get(f"{prefix}_read_ad"),
    }


def order_status(order: Order | ContactLensOrder, *, contact: bool) -> str:
    if contact:
        return normalize_text(getattr(order, "order_status", None))
    data = order.order_data if isinstance(order.order_data, dict) else {}
    details = data.get("details") if isinstance(data.get("details"), dict) else {}
    return normalize_text(details.get("order_status"))


def is_delivered(order: Order | ContactLensOrder, *, contact: bool) -> bool:
    return order_status(order, contact=contact) in {normalize_text(value) for value in DELIVERED_STATUSES}


def is_cancelled(order: Order | ContactLensOrder, *, contact: bool) -> bool:
    status = order_status(order, contact=contact)
    return any(marker in status for marker in CANCELLED_MARKERS)


def _allocation_query(db: Session, order: Order | ContactLensOrder, *, contact: bool):
    query = db.query(OrderInventoryAllocation)
    if contact:
        return query.filter(OrderInventoryAllocation.contact_lens_order_id == order.id)
    return query.filter(OrderInventoryAllocation.order_id == order.id)


def allocation_dict(
    allocation: OrderInventoryAllocation,
    *,
    variant: CatalogVariant | None = None,
    product: CatalogProduct | None = None,
) -> dict[str, Any]:
    payload = {
        "id": allocation.id,
        "clinic_id": allocation.clinic_id,
        "variant_id": allocation.variant_id,
        "component": allocation.component,
        "quantity": allocation.quantity,
        "fulfillment_source": allocation.fulfillment_source,
        "lifecycle_state": allocation.lifecycle_state,
        "created_at": allocation.created_at,
        "updated_at": allocation.updated_at,
        "consumed_at": allocation.consumed_at,
        "released_at": allocation.released_at,
    }
    if variant and product:
        payload["variant"] = variant_dict(variant, product)
    return payload


def _release_allocation(
    db: Session,
    allocation: OrderInventoryAllocation,
    *,
    actor_user_id: int,
    state: str,
    reason: str,
) -> None:
    if allocation.lifecycle_state == "reserved":
        apply_balance_change(
            db,
            company_id=allocation.company_id,
            clinic_id=allocation.clinic_id,
            variant_id=allocation.variant_id,
            on_hand_delta=0,
            reserved_delta=-allocation.quantity,
            movement_type="release",
            reason=reason,
            actor_user_id=actor_user_id,
            order_id=allocation.order_id,
            contact_lens_order_id=allocation.contact_lens_order_id,
            metadata={"allocation_id": allocation.id, "component": allocation.component},
        )
    allocation.lifecycle_state = state
    allocation.released_at = utcnow()


def _consume_allocation(db: Session, allocation: OrderInventoryAllocation, *, actor_user_id: int) -> None:
    if allocation.lifecycle_state == "reserved":
        apply_balance_change(
            db,
            company_id=allocation.company_id,
            clinic_id=allocation.clinic_id,
            variant_id=allocation.variant_id,
            on_hand_delta=-allocation.quantity,
            reserved_delta=-allocation.quantity,
            movement_type="consume",
            reason="Order delivered",
            actor_user_id=actor_user_id,
            order_id=allocation.order_id,
            contact_lens_order_id=allocation.contact_lens_order_id,
            metadata={"allocation_id": allocation.id, "component": allocation.component},
        )
    if allocation.lifecycle_state in ACTIVE_ALLOCATION_STATES:
        allocation.lifecycle_state = "consumed"
        allocation.consumed_at = utcnow()


def _component_snapshot(order: Order | ContactLensOrder, component: str, *, contact: bool) -> str:
    if contact:
        side = "right" if component == "contact_right" else "left"
        return snapshot_fingerprint(contact_component_snapshot(order, side))
    return snapshot_fingerprint(regular_component_snapshot(order))


def _reserve_allocation(
    db: Session,
    allocation: OrderInventoryAllocation,
    *,
    actor_user_id: int,
) -> None:
    apply_balance_change(
        db,
        company_id=allocation.company_id,
        clinic_id=allocation.clinic_id,
        variant_id=allocation.variant_id,
        on_hand_delta=0,
        reserved_delta=allocation.quantity,
        movement_type="reserve",
        reason="Reserved for order",
        actor_user_id=actor_user_id,
        order_id=allocation.order_id,
        contact_lens_order_id=allocation.contact_lens_order_id,
        metadata={"allocation_id": allocation.id, "component": allocation.component},
    )
    allocation.lifecycle_state = "reserved"


def reconcile_order_allocations(
    db: Session,
    *,
    order: Order | ContactLensOrder,
    current_user: User,
    company_id: int,
    selections_present: bool,
    selections: Iterable[dict[str, Any]] | None,
    contact: bool,
) -> list[OrderInventoryAllocation]:
    allowed_components = {"contact_right", "contact_left"} if contact else {"frame"}
    existing_rows = _allocation_query(db, order, contact=contact).with_for_update().all()
    existing = {row.component: row for row in existing_rows}

    if selections_present:
        selection_map: dict[str, dict[str, Any]] = {}
        for raw in selections or []:
            if not isinstance(raw, dict):
                raise HTTPException(status_code=422, detail="Invalid inventory selection")
            component = str(raw.get("component") or "")
            if component not in allowed_components or component in selection_map:
                raise HTTPException(status_code=422, detail="Invalid inventory component")
            selection_map[component] = raw

        for component in allowed_components:
            current = existing.get(component)
            selection = selection_map.get(component)
            if selection is None:
                if current and current.lifecycle_state in ACTIVE_ALLOCATION_STATES:
                    _release_allocation(
                        db,
                        current,
                        actor_user_id=current_user.id,
                        state="detached",
                        reason="Order product changed to manual or customer-owned",
                    )
                continue

            try:
                variant_id = int(selection.get("variant_id"))
                quantity = int(selection.get("quantity") or 1)
            except (TypeError, ValueError):
                raise HTTPException(status_code=422, detail="Invalid inventory variant or quantity")
            if quantity <= 0:
                raise HTTPException(status_code=422, detail="Inventory quantity must be positive")
            source = str(selection.get("fulfillment_source") or "inventory")
            if source not in {"inventory", "supplier_ordered"}:
                raise HTTPException(status_code=422, detail="Invalid fulfillment source")

            variant = get_company_variant(db, company_id, variant_id)
            if current and current.lifecycle_state == "consumed":
                if current.variant_id != variant_id or current.quantity != quantity:
                    raise HTTPException(
                        status_code=409,
                        detail="Delivered inventory cannot be changed; use an audited stock adjustment",
                    )
                continue
            product = db.query(CatalogProduct).filter(CatalogProduct.id == variant.product_id).one()
            expected_category = "contact_lens" if contact else "frame"
            if product.category != expected_category or variant.archived_at is not None or product.archived_at is not None:
                raise HTTPException(status_code=409, detail="Catalog variant is not available")
            if not variant.is_stockable:
                raise HTTPException(status_code=409, detail="Complete this variant before using it in an order")

            current_snapshot = _component_snapshot(order, component, contact=contact)
            unchanged = (
                current
                and current.lifecycle_state in ACTIVE_ALLOCATION_STATES
                and current.variant_id == variant_id
                and current.fulfillment_source == source
            )
            if unchanged:
                if source == "inventory" and current.quantity != quantity:
                    delta = quantity - current.quantity
                    apply_balance_change(
                        db,
                        company_id=company_id,
                        clinic_id=order.clinic_id,
                        variant_id=variant_id,
                        on_hand_delta=0,
                        reserved_delta=delta,
                        movement_type="reservation_change",
                        reason="Order quantity changed",
                        actor_user_id=current_user.id,
                        order_id=None if contact else order.id,
                        contact_lens_order_id=order.id if contact else None,
                        metadata={"allocation_id": current.id, "component": component},
                    )
                current.quantity = quantity
                current.snapshot_fingerprint = current_snapshot
                continue

            if current and current.lifecycle_state in ACTIVE_ALLOCATION_STATES:
                _release_allocation(
                    db,
                    current,
                    actor_user_id=current_user.id,
                    state="released",
                    reason="Order inventory selection changed",
                )

            if current is None:
                current = OrderInventoryAllocation(
                    company_id=company_id,
                    clinic_id=order.clinic_id,
                    order_id=None if contact else order.id,
                    contact_lens_order_id=order.id if contact else None,
                    component=component,
                )
                db.add(current)
            current.variant_id = variant_id
            current.quantity = quantity
            current.fulfillment_source = source
            current.lifecycle_state = "supplier_ordered" if source == "supplier_ordered" else "reserved"
            current.snapshot_fingerprint = current_snapshot
            current.released_at = None
            current.consumed_at = None
            db.flush()
            if source == "inventory":
                _reserve_allocation(db, current, actor_user_id=current_user.id)
    else:
        for allocation in existing_rows:
            if allocation.lifecycle_state not in ACTIVE_ALLOCATION_STATES:
                continue
            current_snapshot = _component_snapshot(order, allocation.component, contact=contact)
            if allocation.snapshot_fingerprint and current_snapshot != allocation.snapshot_fingerprint:
                _release_allocation(
                    db,
                    allocation,
                    actor_user_id=current_user.id,
                    state="detached",
                    reason="Legacy client changed the inventory-backed product",
                )

    active_rows = _allocation_query(db, order, contact=contact).all()
    if is_cancelled(order, contact=contact):
        for allocation in active_rows:
            if allocation.lifecycle_state in ACTIVE_ALLOCATION_STATES:
                _release_allocation(
                    db,
                    allocation,
                    actor_user_id=current_user.id,
                    state="released",
                    reason="Order cancelled",
                )
    elif is_delivered(order, contact=contact):
        for allocation in active_rows:
            _consume_allocation(db, allocation, actor_user_id=current_user.id)

    db.flush()
    return _allocation_query(db, order, contact=contact).all()


def release_order_allocations_for_delete(
    db: Session,
    *,
    order: Order | ContactLensOrder,
    current_user: User,
    contact: bool,
) -> None:
    for allocation in _allocation_query(db, order, contact=contact).with_for_update().all():
        if allocation.lifecycle_state in ACTIVE_ALLOCATION_STATES:
            _release_allocation(
                db,
                allocation,
                actor_user_id=current_user.id,
                state="released",
                reason="Undelivered order deleted",
            )
    db.flush()
