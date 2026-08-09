from collections import defaultdict
from datetime import date, datetime, timezone
from difflib import SequenceMatcher
from typing import Any, Iterable

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models import (
    CatalogDiscoveryCandidate,
    CatalogDiscoveryRun,
    CatalogOrderObservation,
    CatalogProduct,
    CatalogVariant,
    Clinic,
    ContactLensOrder,
    Order,
    User,
)
from services.inventory_service import (
    contact_variant_missing_fields,
    contact_component_snapshot,
    create_product,
    create_variant,
    normalized_product_key,
    normalized_variant_fingerprint,
    normalize_text,
    variant_display_name,
)


def _clean_dict(value: dict[str, Any]) -> dict[str, Any]:
    return {key: item for key, item in value.items() if item not in (None, "")}


def _validated_observation_source(
    db: Session,
    company_id: int,
    source: dict[str, Any],
) -> dict[str, Any]:
    try:
        order_id = int(source.get("order_id"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="Invalid discovery source order")
    kind = str(source.get("kind") or "")
    component = str(source.get("component") or "")
    if kind == "regular":
        order = (
            db.query(Order)
            .join(Clinic, Clinic.id == Order.clinic_id)
            .filter(Order.id == order_id, Clinic.company_id == company_id)
            .first()
        )
        if not order or not component.startswith("frame"):
            raise HTTPException(status_code=422, detail="Invalid discovery source")
        quantity = 1
    elif kind == "contact":
        order = (
            db.query(ContactLensOrder)
            .join(Clinic, Clinic.id == ContactLensOrder.clinic_id)
            .filter(ContactLensOrder.id == order_id, Clinic.company_id == company_id)
            .first()
        )
        if not order or component not in {"contact_right", "contact_left"}:
            raise HTTPException(status_code=422, detail="Invalid discovery source")
        snapshot = contact_component_snapshot(
            order,
            "right" if component == "contact_right" else "left",
        )
        try:
            quantity = max(1, int(snapshot.get("quantity") or 1))
        except (TypeError, ValueError):
            quantity = 1
    else:
        raise HTTPException(status_code=422, detail="Invalid discovery source kind")
    return {
        "kind": kind,
        "order_id": order.id,
        "component": component,
        "clinic_id": order.clinic_id,
        "date": order.order_date.isoformat() if order.order_date else None,
        "quantity": quantity,
    }


def _regular_candidates(order: Order) -> Iterable[dict[str, Any]]:
    data = order.order_data if isinstance(order.order_data, dict) else {}
    tabs = data.get("lens_frame_tabs")
    frames: list[tuple[str, dict[str, Any]]] = []
    if isinstance(tabs, list):
        for index, tab in enumerate(tabs):
            frame = tab.get("frame") if isinstance(tab, dict) else None
            if isinstance(frame, dict) and any(value not in (None, "") for value in frame.values()):
                frames.append(("frame" if index == 0 else f"frame_{index + 1}", frame))
    legacy_frame = data.get("frame")
    if not frames and isinstance(legacy_frame, dict):
        frames.append(("frame", legacy_frame))

    for component, frame in frames:
        product = _clean_dict({
            "brand": frame.get("manufacturer") or frame.get("brand"),
            "model": frame.get("model"),
            "product_type": frame.get("type"),
            "material": frame.get("material"),
            "preferred_supplier": frame.get("supplier") or frame.get("supplied_by"),
        })
        attributes = _clean_dict({
            "color": frame.get("color"),
            "eye_size": frame.get("width") or frame.get("size"),
            "bridge": frame.get("bridge"),
            "temple_length": frame.get("length"),
            "height": frame.get("height"),
        })
        if not product and not attributes:
            continue
        missing = [field for field in ("brand", "model") if not product.get(field)]
        missing.extend(field for field in ("color", "eye_size") if not attributes.get(field))
        yield {
            "category": "frame",
            "product": product,
            "attributes": attributes,
            "needs_details": bool(missing),
            "missing_fields": missing,
            "source": {
                "kind": "regular",
                "order_id": order.id,
                "component": component,
                "clinic_id": order.clinic_id,
                "date": order.order_date.isoformat() if order.order_date else None,
                "quantity": 1,
            },
        }


def _contact_candidate(order: ContactLensOrder, side: str) -> dict[str, Any] | None:
    prefix = "r" if side == "right" else "l"
    data = order.order_data if isinstance(order.order_data, dict) else {}
    details = data.get("contact-lens-details") if isinstance(data.get("contact-lens-details"), dict) else {}
    exam = data.get("contact-lens-exam") if isinstance(data.get("contact-lens-exam"), dict) else {}
    lens_type = details.get(f"{prefix}_type") or getattr(order, f"{prefix}_lens_type", None)
    model = details.get(f"{prefix}_model") or getattr(order, f"{prefix}_model", None)
    supplier = details.get(f"{prefix}_supplier") or getattr(order, f"{prefix}_supplier", None)
    material = details.get(f"{prefix}_material") or getattr(order, f"{prefix}_material", None)
    color = details.get(f"{prefix}_color") or getattr(order, f"{prefix}_color", None)
    quantity = details.get(f"{prefix}_quantity") or getattr(order, f"{prefix}_quantity", None) or 1
    if not any((lens_type, model, supplier, material, color, exam.get(f"{prefix}_sph"))):
        return None
    product = _clean_dict({
        # Older orders store supplier but not manufacturer. Do not silently
        # reinterpret the supplier as a manufacturer.
        "brand": details.get(f"{prefix}_manufacturer"),
        "model": model,
        "product_type": lens_type,
        "material": material,
        "preferred_supplier": supplier,
        "replacement_schedule": details.get(f"{prefix}_replacement_schedule"),
    })
    attributes = _clean_dict({
        "sph": exam.get(f"{prefix}_sph"),
        "bc": exam.get(f"{prefix}_bc"),
        "dia": exam.get(f"{prefix}_diam"),
        "pack_size": details.get(f"{prefix}_pack_size"),
        "cyl": exam.get(f"{prefix}_cyl"),
        "axis": exam.get(f"{prefix}_ax"),
        "add": exam.get(f"{prefix}_read_ad"),
        "design": details.get(f"{prefix}_design"),
        "color": color,
    })
    missing = contact_variant_missing_fields(product, attributes)
    return {
        "category": "contact_lens",
        "product": product,
        "attributes": attributes,
        "needs_details": bool(missing),
        "missing_fields": missing,
        "source": {
            "kind": "contact",
            "order_id": order.id,
            "component": f"contact_{side}",
            "clinic_id": order.clinic_id,
            "date": order.order_date.isoformat() if order.order_date else None,
            "quantity": max(1, int(quantity)) if str(quantity).isdigit() else 1,
        },
    }


def discover_from_orders(db: Session, company_id: int) -> dict[str, Any]:
    clinic_ids = [row[0] for row in db.query(Clinic.id).filter(Clinic.company_id == company_id).all()]
    regular_orders = db.query(Order).filter(Order.clinic_id.in_(clinic_ids)).all() if clinic_ids else []
    contact_orders = db.query(ContactLensOrder).filter(ContactLensOrder.clinic_id.in_(clinic_ids)).all() if clinic_ids else []

    existing = {
        row[0]
        for row in db.query(CatalogVariant.normalized_fingerprint)
        .filter(CatalogVariant.company_id == company_id)
        .all()
    }
    known_variants = (
        db.query(CatalogVariant, CatalogProduct)
        .join(CatalogProduct, CatalogProduct.id == CatalogVariant.product_id)
        .filter(CatalogVariant.company_id == company_id)
        .all()
    )
    grouped: dict[str, dict[str, Any]] = {}
    raw_candidates: list[dict[str, Any]] = []
    for order in regular_orders:
        raw_candidates.extend(_regular_candidates(order))
    for order in contact_orders:
        for side in ("right", "left"):
            candidate = _contact_candidate(order, side)
            if candidate:
                raw_candidates.append(candidate)

    for candidate in raw_candidates:
        fingerprint = normalized_variant_fingerprint(
            candidate["category"], candidate["product"], candidate["attributes"]
        )
        if fingerprint in existing:
            continue
        current = grouped.get(fingerprint)
        if current is None:
            current = {
                "normalized_fingerprint": fingerprint,
                "category": candidate["category"],
                "product": candidate["product"],
                "attributes": candidate["attributes"],
                "needs_details": candidate["needs_details"],
                "missing_fields": list(candidate["missing_fields"]),
                "occurrence_count": 0,
                "sources": [],
                "clinic_ids": set(),
                "dates": [],
                "suggested_variant": None,
            }
            grouped[fingerprint] = current
        current["occurrence_count"] += int(candidate["source"].get("quantity") or 1)
        current["sources"].append(candidate["source"])
        if candidate["source"].get("clinic_id"):
            current["clinic_ids"].add(candidate["source"]["clinic_id"])
        if candidate["source"].get("date"):
            current["dates"].append(candidate["source"]["date"])

    for candidate in grouped.values():
        candidate_key = normalized_product_key(candidate["product"])
        best_score = 0.0
        best = None
        for variant, product in known_variants:
            if product.category != candidate["category"]:
                continue
            score = SequenceMatcher(None, candidate_key, product.normalized_key).ratio()
            if score > best_score:
                best_score = score
                best = (variant, product)
        if best and best_score >= 0.72:
            variant, product = best
            candidate["suggested_variant"] = {
                "id": variant.id,
                "display_name": variant_display_name(product, variant),
                "similarity": round(best_score, 2),
            }
        candidate["clinic_ids"] = sorted(candidate["clinic_ids"])
        candidate["first_seen"] = min(candidate["dates"]) if candidate["dates"] else None
        candidate["last_seen"] = max(candidate["dates"]) if candidate["dates"] else None
        candidate.pop("dates", None)

    candidates = sorted(
        grouped.values(),
        key=lambda item: (-item["occurrence_count"], item["category"], item["normalized_fingerprint"]),
    )
    return {
        "candidates": candidates,
        "summary": {
            "orders_scanned": len(regular_orders) + len(contact_orders),
            "regular_orders": len(regular_orders),
            "contact_orders": len(contact_orders),
            "candidates": len(candidates),
            "needs_details": sum(candidate["needs_details"] for candidate in candidates),
            "already_cataloged": len(raw_candidates) - sum(len(candidate["sources"]) for candidate in candidates),
        },
    }


def confirm_discovery(
    db: Session,
    *,
    company_id: int,
    current_user: User,
    candidates: list[dict[str, Any]],
) -> dict[str, Any]:
    selected = [candidate for candidate in candidates if candidate.get("selected")]
    if not selected:
        raise HTTPException(status_code=422, detail="Select at least one candidate")
    run = CatalogDiscoveryRun(
        company_id=company_id,
        created_by_user_id=current_user.id,
        status="review",
        summary={"submitted": len(candidates), "selected": len(selected)},
    )
    db.add(run)
    db.flush()
    created_variants = 0
    observations = 0
    errors: list[dict[str, Any]] = []

    for index, candidate in enumerate(selected):
        category = str(candidate.get("category") or "")
        product_data = candidate.get("product") or {}
        attributes = candidate.get("attributes") or {}
        if category == "contact_lens":
            missing_fields = contact_variant_missing_fields(product_data, attributes)
        else:
            missing_fields = [
                field
                for field in ("brand", "model")
                if not normalize_text(product_data.get(field))
            ] + [
                field
                for field in ("color", "eye_size")
                if attributes.get(field) in (None, "")
            ]
        needs_details = bool(missing_fields)
        fingerprint = normalized_variant_fingerprint(category, product_data, attributes)
        candidate_row = CatalogDiscoveryCandidate(
            run_id=run.id,
            company_id=company_id,
            category=category,
            product_data=product_data,
            variant_attributes=attributes,
            normalized_fingerprint=fingerprint,
            occurrence_count=int(candidate.get("occurrence_count") or 0),
            source_summary={
                "sources": candidate.get("sources") or [],
                "clinic_ids": candidate.get("clinic_ids") or [],
                "first_seen": candidate.get("first_seen"),
                "last_seen": candidate.get("last_seen"),
                "missing_fields": missing_fields,
            },
            needs_details=needs_details,
            selected=True,
            suggested_variant_id=None,
        )
        db.add(candidate_row)
        try:
            validated_sources = [
                _validated_observation_source(db, company_id, source)
                for source in (candidate.get("sources") or [])
                if isinstance(source, dict)
            ]
            if len(validated_sources) != len(candidate.get("sources") or []):
                raise HTTPException(status_code=422, detail="Invalid discovery source")
            suggested_variant_id = (candidate.get("suggested_variant") or {}).get("id")
            if suggested_variant_id and not db.query(CatalogVariant.id).filter(
                CatalogVariant.id == suggested_variant_id,
                CatalogVariant.company_id == company_id,
            ).first():
                raise HTTPException(status_code=422, detail="Invalid suggested catalog variant")
            candidate_row.suggested_variant_id = suggested_variant_id or None
            candidate_row.source_summary = {
                **(candidate_row.source_summary or {}),
                "sources": validated_sources,
            }
            product = create_product(db, company_id=company_id, category=category, data=product_data)
            before = db.query(CatalogVariant.id).filter(
                CatalogVariant.company_id == company_id,
                CatalogVariant.normalized_fingerprint == fingerprint,
            ).scalar()
            variant = create_variant(
                db,
                company_id=company_id,
                product=product,
                data={"attributes": attributes, "is_stockable": not needs_details},
            )
            candidate_row.confirmed_variant_id = variant.id
            if before is None:
                created_variants += 1
            for source in validated_sources:
                source_kind = source.get("kind")
                source_id = source.get("order_id")
                component = str(source.get("component") or "")
                if source_kind == "regular":
                    exists = db.query(CatalogOrderObservation.id).filter(
                        CatalogOrderObservation.order_id == source_id,
                        CatalogOrderObservation.component == component,
                    ).first()
                else:
                    exists = db.query(CatalogOrderObservation.id).filter(
                        CatalogOrderObservation.contact_lens_order_id == source_id,
                        CatalogOrderObservation.component == component,
                    ).first()
                if exists:
                    continue
                observed_on = None
                if source.get("date"):
                    try:
                        observed_on = date.fromisoformat(source["date"])
                    except (TypeError, ValueError):
                        observed_on = None
                db.add(CatalogOrderObservation(
                    company_id=company_id,
                    clinic_id=int(source["clinic_id"]),
                    variant_id=variant.id,
                    order_id=int(source_id) if source_kind == "regular" else None,
                    contact_lens_order_id=int(source_id) if source_kind == "contact" else None,
                    component=component,
                    observed_on=observed_on,
                    quantity=max(1, int(source.get("quantity") or 1)),
                ))
                observations += 1
        except HTTPException as exc:
            errors.append({"index": index, "detail": exc.detail})

    if errors:
        db.rollback()
        raise HTTPException(status_code=422, detail={"message": "Some candidates need correction", "errors": errors})
    run.status = "confirmed"
    run.confirmed_at = datetime.now(timezone.utc)
    run.summary = {**(run.summary or {}), "created_variants": created_variants, "observations": observations}
    db.commit()
    return {
        "run_id": run.id,
        "created_variants": created_variants,
        "observations": observations,
        "selected": len(selected),
    }
