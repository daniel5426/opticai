from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from difflib import SequenceMatcher
import os
from typing import Any, Iterable

from fastapi import HTTPException
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from models import (
    CatalogDiscoveryCandidate,
    CatalogDiscoveryRun,
    CatalogDiscoverySource,
    CatalogOrderObservation,
    CatalogProduct,
    CatalogVariant,
    Clinic,
    Company,
    ContactLensOrder,
    Order,
    User,
)


DISCOVERY_BATCH_SIZE = max(100, int(os.environ.get("CATALOG_DISCOVERY_BATCH_SIZE", "1000")))
DISCOVERY_LEASE_SECONDS = max(30, int(os.environ.get("CATALOG_DISCOVERY_LEASE_SECONDS", "120")))
DISCOVERY_PAGE_SIZE_MAX = 100
DISCOVERY_ACTIVE_STATUSES = {"queued", "running", "confirm_queued", "confirming"}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)
from services.inventory_service import (
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
    lens_type = details.get(f"{prefix}_type") or getattr(order, f"{prefix}_lens_type", None)
    model = details.get(f"{prefix}_model") or getattr(order, f"{prefix}_model", None)
    supplier = details.get(f"{prefix}_supplier") or getattr(order, f"{prefix}_supplier", None)
    material = details.get(f"{prefix}_material") or getattr(order, f"{prefix}_material", None)
    color = details.get(f"{prefix}_color") or getattr(order, f"{prefix}_color", None)
    quantity = details.get(f"{prefix}_quantity") or getattr(order, f"{prefix}_quantity", None) or 1
    if not any((lens_type, model, supplier, material, color)):
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
        "color": color,
    })
    missing = ["model"] if not normalize_text(product.get("model")) else []
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
            attributes = _clean_dict({"color": attributes.get("color")})
            missing_fields = ["model"] if not normalize_text(product_data.get("model")) else []
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
                data={
                    "attributes": attributes,
                    "is_stockable": category == "frame" and not needs_details,
                },
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


# Durable discovery runs ----------------------------------------------------
#
# The legacy preview endpoint above remains for small, older desktop clients.
# New clients never receive the order-source payload: the worker persists it
# locally and confirmation uses candidate IDs only.


def _candidate_missing_fields(
    category: str,
    product: dict[str, Any],
    attributes: dict[str, Any],
) -> list[str]:
    if category == "contact_lens":
        return ["model"] if not normalize_text(product.get("model")) else []
    return [
        field
        for field in ("brand", "model")
        if not normalize_text(product.get(field))
    ] + [
        field
        for field in ("color", "eye_size")
        if attributes.get(field) in (None, "")
    ]


def discovery_candidate_dict(candidate: CatalogDiscoveryCandidate) -> dict[str, Any]:
    summary = candidate.source_summary or {}
    return {
        "id": candidate.id,
        "normalized_fingerprint": candidate.normalized_fingerprint,
        "category": candidate.category,
        "product": candidate.product_data or {},
        "attributes": candidate.variant_attributes or {},
        "needs_details": candidate.needs_details,
        "missing_fields": summary.get("missing_fields") or [],
        "occurrence_count": candidate.occurrence_count,
        "clinic_ids": summary.get("clinic_ids") or [],
        "first_seen": summary.get("first_seen"),
        "last_seen": summary.get("last_seen"),
        "suggested_variant": None,
        "selected": candidate.selected,
    }


def discovery_run_dict(run: CatalogDiscoveryRun) -> dict[str, Any]:
    return {
        "id": run.id,
        "status": run.status,
        "step": run.step,
        "progress": run.progress,
        "total_orders": run.total_orders,
        "scanned_orders": run.scanned_orders,
        "candidate_count": run.candidate_count,
        "selected_count": run.selected_count,
        "summary": run.summary or {},
        "error": run.error,
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "finished_at": run.finished_at.isoformat() if run.finished_at else None,
        "confirmed_at": run.confirmed_at.isoformat() if run.confirmed_at else None,
    }


def _company_clinic_ids(db: Session, company_id: int) -> list[int]:
    return [
        row[0]
        for row in db.query(Clinic.id).filter(Clinic.company_id == company_id).all()
    ]


def create_discovery_run(
    db: Session,
    *,
    company_id: int,
    current_user: User,
) -> CatalogDiscoveryRun:
    # Serialise run creation for one company. A second click should resume the
    # active run, never schedule another full historical scan.
    db.query(Company.id).filter(Company.id == company_id).with_for_update().first()
    active = db.query(CatalogDiscoveryRun).filter(
        CatalogDiscoveryRun.company_id == company_id,
        CatalogDiscoveryRun.status.in_(DISCOVERY_ACTIVE_STATUSES),
    ).order_by(CatalogDiscoveryRun.created_at.desc()).first()
    if active:
        return active

    clinic_ids = _company_clinic_ids(db, company_id)
    regular_orders = (
        db.query(func.count(Order.id)).filter(Order.clinic_id.in_(clinic_ids)).scalar()
        if clinic_ids
        else 0
    )
    contact_orders = (
        db.query(func.count(ContactLensOrder.id)).filter(ContactLensOrder.clinic_id.in_(clinic_ids)).scalar()
        if clinic_ids
        else 0
    )
    regular_max_id = (
        db.query(func.max(Order.id)).filter(Order.clinic_id.in_(clinic_ids)).scalar()
        if clinic_ids
        else 0
    )
    contact_max_id = (
        db.query(func.max(ContactLensOrder.id)).filter(ContactLensOrder.clinic_id.in_(clinic_ids)).scalar()
        if clinic_ids
        else 0
    )
    total_orders = int(regular_orders or 0) + int(contact_orders or 0)
    run = CatalogDiscoveryRun(
        company_id=company_id,
        created_by_user_id=current_user.id,
        status="queued",
        step="Waiting for discovery worker",
        progress=1,
        total_orders=total_orders,
        summary={
            "regular_orders": int(regular_orders or 0),
            "contact_orders": int(contact_orders or 0),
        },
        checkpoint={
            "phase": "regular",
            "regular_last_id": 0,
            "regular_max_id": int(regular_max_id or 0),
            "contact_last_id": 0,
            "contact_max_id": int(contact_max_id or 0),
        },
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def latest_discovery_run(db: Session, company_id: int) -> CatalogDiscoveryRun | None:
    return db.query(CatalogDiscoveryRun).filter(
        CatalogDiscoveryRun.company_id == company_id,
    ).order_by(CatalogDiscoveryRun.created_at.desc()).first()


def get_discovery_run(db: Session, company_id: int, run_id: int) -> CatalogDiscoveryRun:
    run = db.query(CatalogDiscoveryRun).filter(
        CatalogDiscoveryRun.id == run_id,
        CatalogDiscoveryRun.company_id == company_id,
    ).first()
    if not run:
        raise HTTPException(status_code=404, detail="Discovery run not found")
    return run


def list_discovery_candidates(
    db: Session,
    *,
    company_id: int,
    run_id: int,
    page: int,
    limit: int,
) -> dict[str, Any]:
    run = get_discovery_run(db, company_id, run_id)
    bounded_page = max(1, page)
    bounded_limit = min(DISCOVERY_PAGE_SIZE_MAX, max(1, limit))
    query = db.query(CatalogDiscoveryCandidate).filter(
        CatalogDiscoveryCandidate.run_id == run.id,
        CatalogDiscoveryCandidate.company_id == company_id,
    )
    total = query.count()
    rows = query.order_by(
        CatalogDiscoveryCandidate.occurrence_count.desc(),
        CatalogDiscoveryCandidate.id.asc(),
    ).offset((bounded_page - 1) * bounded_limit).limit(bounded_limit).all()
    return {
        "items": [discovery_candidate_dict(candidate) for candidate in rows],
        "page": bounded_page,
        "limit": bounded_limit,
        "total": total,
        "run": discovery_run_dict(run),
    }


def update_discovery_candidate(
    db: Session,
    *,
    company_id: int,
    run_id: int,
    candidate_id: int,
    payload: dict[str, Any],
) -> CatalogDiscoveryCandidate:
    run = get_discovery_run(db, company_id, run_id)
    if run.status != "ready":
        raise HTTPException(status_code=409, detail="Discovery candidates can only be edited when the scan is ready")
    candidate = db.query(CatalogDiscoveryCandidate).filter(
        CatalogDiscoveryCandidate.id == candidate_id,
        CatalogDiscoveryCandidate.run_id == run.id,
        CatalogDiscoveryCandidate.company_id == company_id,
    ).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Discovery candidate not found")
    if isinstance(payload.get("product"), dict):
        candidate.product_data = {
            **(candidate.product_data or {}),
            **_clean_dict(payload["product"]),
        }
    if isinstance(payload.get("attributes"), dict):
        candidate.variant_attributes = {
            **(candidate.variant_attributes or {}),
            **_clean_dict(payload["attributes"]),
        }
    if isinstance(payload.get("selected"), bool):
        candidate.selected = payload["selected"]
    missing_fields = _candidate_missing_fields(
        candidate.category,
        candidate.product_data or {},
        candidate.variant_attributes or {},
    )
    candidate.needs_details = bool(missing_fields)
    candidate.source_summary = {
        **(candidate.source_summary or {}),
        "missing_fields": missing_fields,
    }
    run.selected_count = db.query(func.count(CatalogDiscoveryCandidate.id)).filter(
        CatalogDiscoveryCandidate.run_id == run.id,
        CatalogDiscoveryCandidate.selected.is_(True),
    ).scalar() or 0
    db.commit()
    db.refresh(candidate)
    return candidate


def set_discovery_candidates_selection(
    db: Session,
    *,
    company_id: int,
    run_id: int,
    candidate_ids: list[int],
    selected: bool,
) -> dict[str, Any]:
    run = get_discovery_run(db, company_id, run_id)
    if run.status != "ready":
        raise HTTPException(status_code=409, detail="Discovery candidates can only be selected when the scan is ready")
    ids = sorted({int(candidate_id) for candidate_id in candidate_ids if int(candidate_id) > 0})
    if ids:
        db.query(CatalogDiscoveryCandidate).filter(
            CatalogDiscoveryCandidate.run_id == run.id,
            CatalogDiscoveryCandidate.company_id == company_id,
            CatalogDiscoveryCandidate.id.in_(ids),
        ).update({CatalogDiscoveryCandidate.selected: selected}, synchronize_session=False)
    run.selected_count = db.query(func.count(CatalogDiscoveryCandidate.id)).filter(
        CatalogDiscoveryCandidate.run_id == run.id,
        CatalogDiscoveryCandidate.selected.is_(True),
    ).scalar() or 0
    db.commit()
    return {"selected_count": run.selected_count}


def queue_discovery_confirmation(
    db: Session,
    *,
    company_id: int,
    run_id: int,
    mode: str,
) -> CatalogDiscoveryRun:
    run = get_discovery_run(db, company_id, run_id)
    if run.status != "ready":
        raise HTTPException(status_code=409, detail="Discovery scan is not ready")
    candidates = db.query(CatalogDiscoveryCandidate).filter(
        CatalogDiscoveryCandidate.run_id == run.id,
        CatalogDiscoveryCandidate.company_id == company_id,
    )
    if mode == "all_ready":
        candidates.filter(CatalogDiscoveryCandidate.needs_details.is_(True)).update(
            {CatalogDiscoveryCandidate.selected: False}, synchronize_session=False
        )
        candidates.filter(CatalogDiscoveryCandidate.needs_details.is_(False)).update(
            {CatalogDiscoveryCandidate.selected: True}, synchronize_session=False
        )
    elif mode != "selected":
        raise HTTPException(status_code=422, detail="Invalid discovery confirmation mode")
    incomplete = candidates.filter(
        CatalogDiscoveryCandidate.selected.is_(True),
        CatalogDiscoveryCandidate.needs_details.is_(True),
    ).count()
    if incomplete:
        raise HTTPException(status_code=422, detail="Complete required candidate details before creating items")
    selected_count = candidates.filter(CatalogDiscoveryCandidate.selected.is_(True)).count()
    if not selected_count:
        raise HTTPException(status_code=422, detail="Select at least one complete item")
    run.status = "confirm_queued"
    run.step = "Waiting to create catalog items"
    run.progress = 0
    run.selected_count = selected_count
    run.checkpoint = {"phase": "confirm", "last_candidate_id": 0}
    run.error = None
    db.commit()
    db.refresh(run)
    return run


def claim_next_discovery_job(db: Session, worker_id: str) -> CatalogDiscoveryRun | None:
    now = _utcnow()
    claimable = or_(
        CatalogDiscoveryRun.status.in_(("queued", "confirm_queued")),
        and_(
            CatalogDiscoveryRun.status.in_(("running", "confirming")),
            or_(
                CatalogDiscoveryRun.lease_until.is_(None),
                CatalogDiscoveryRun.lease_until < now,
            ),
        ),
    )
    query = db.query(CatalogDiscoveryRun).filter(claimable).order_by(CatalogDiscoveryRun.created_at.asc())
    try:
        run = query.with_for_update(skip_locked=True).first()
    except Exception:
        db.rollback()
        run = query.first()
    if not run:
        return None
    confirming = run.status in {"confirm_queued", "confirming"}
    run.status = "confirming" if confirming else "running"
    run.step = "Creating catalog items" if confirming else "Scanning existing orders"
    run.locked_by = worker_id
    run.lease_until = now.replace(microsecond=0) + timedelta(seconds=DISCOVERY_LEASE_SECONDS)
    run.heartbeat_at = now
    run.attempt_count = (run.attempt_count or 0) + 1
    run.started_at = run.started_at or now
    db.commit()
    db.refresh(run)
    return run


def _refresh_discovery_lease(run: CatalogDiscoveryRun) -> None:
    now = _utcnow()
    run.heartbeat_at = now
    run.lease_until = now + timedelta(seconds=DISCOVERY_LEASE_SECONDS)


def _persist_scan_batch(
    db: Session,
    *,
    run: CatalogDiscoveryRun,
    candidates: Iterable[dict[str, Any]],
) -> None:
    grouped: dict[str, dict[str, Any]] = {}
    for candidate in candidates:
        fingerprint = normalized_variant_fingerprint(
            candidate["category"], candidate["product"], candidate["attributes"]
        )
        current = grouped.get(fingerprint)
        if current is None:
            current = {"candidate": candidate, "sources": []}
            grouped[fingerprint] = current
        current["sources"].append(candidate["source"])
    if not grouped:
        return

    fingerprints = list(grouped)
    cataloged = {
        row[0]
        for row in db.query(CatalogVariant.normalized_fingerprint).filter(
            CatalogVariant.company_id == run.company_id,
            CatalogVariant.normalized_fingerprint.in_(fingerprints),
        ).all()
    }
    for fingerprint in cataloged:
        grouped.pop(fingerprint, None)
    if not grouped:
        return

    existing = {
        row.normalized_fingerprint: row
        for row in db.query(CatalogDiscoveryCandidate).filter(
            CatalogDiscoveryCandidate.run_id == run.id,
            CatalogDiscoveryCandidate.normalized_fingerprint.in_(list(grouped)),
        ).all()
    }
    new_rows: list[CatalogDiscoveryCandidate] = []
    for fingerprint, entry in grouped.items():
        candidate = entry["candidate"]
        row = existing.get(fingerprint)
        if row is None:
            row = CatalogDiscoveryCandidate(
                run_id=run.id,
                company_id=run.company_id,
                category=candidate["category"],
                product_data=candidate["product"],
                variant_attributes=candidate["attributes"],
                normalized_fingerprint=fingerprint,
                occurrence_count=0,
                source_summary={
                    "clinic_ids": [],
                    "first_seen": None,
                    "last_seen": None,
                    "missing_fields": candidate["missing_fields"],
                },
                needs_details=candidate["needs_details"],
                selected=False,
            )
            db.add(row)
            existing[fingerprint] = row
            new_rows.append(row)
    db.flush()

    sources: list[dict[str, Any]] = []
    for fingerprint, entry in grouped.items():
        row = existing[fingerprint]
        source_rows = entry["sources"]
        summary = dict(row.source_summary or {})
        clinic_ids = {int(value) for value in summary.get("clinic_ids") or []}
        dates = [source.get("date") for source in source_rows if source.get("date")]
        first_seen = min([value for value in [summary.get("first_seen"), *dates] if value], default=None)
        last_seen = max([value for value in [summary.get("last_seen"), *dates] if value], default=None)
        row.occurrence_count += sum(max(1, int(source.get("quantity") or 1)) for source in source_rows)
        row.source_summary = {
            **summary,
            "clinic_ids": sorted(clinic_ids | {int(source["clinic_id"]) for source in source_rows}),
            "first_seen": first_seen,
            "last_seen": last_seen,
        }
        for source in source_rows:
            observed_on = None
            if source.get("date"):
                try:
                    observed_on = date.fromisoformat(str(source["date"]))
                except ValueError:
                    pass
            sources.append({
                "candidate_id": row.id,
                "company_id": run.company_id,
                "clinic_id": int(source["clinic_id"]),
                "order_id": int(source["order_id"]) if source["kind"] == "regular" else None,
                "contact_lens_order_id": int(source["order_id"]) if source["kind"] == "contact" else None,
                "component": str(source["component"]),
                "observed_on": observed_on,
                "quantity": max(1, int(source.get("quantity") or 1)),
            })
    if sources:
        db.bulk_insert_mappings(CatalogDiscoverySource, sources)
    run.candidate_count += len(new_rows)


def _commit_scan_progress(
    db: Session,
    run: CatalogDiscoveryRun,
    *,
    checkpoint: dict[str, Any],
    scanned: int,
) -> None:
    run.checkpoint = checkpoint
    run.scanned_orders += scanned
    run.progress = min(95, 5 + int(90 * run.scanned_orders / max(1, run.total_orders)))
    run.step = f"Scanning existing orders ({run.scanned_orders:,}/{run.total_orders:,})"
    _refresh_discovery_lease(run)
    db.commit()


def _run_scan(db: Session, run: CatalogDiscoveryRun) -> None:
    clinic_ids = _company_clinic_ids(db, run.company_id)
    checkpoint = dict(run.checkpoint or {})
    checkpoint.setdefault("phase", "regular")
    checkpoint.setdefault("regular_last_id", 0)
    checkpoint.setdefault("contact_last_id", 0)
    checkpoint.setdefault("regular_max_id", 0)
    checkpoint.setdefault("contact_max_id", 0)

    if checkpoint["phase"] == "regular":
        while True:
            query = db.query(Order).filter(
                Order.clinic_id.in_(clinic_ids),
                Order.id > int(checkpoint["regular_last_id"]),
            )
            if checkpoint["regular_max_id"]:
                query = query.filter(Order.id <= int(checkpoint["regular_max_id"]))
            rows = query.order_by(Order.id.asc()).limit(DISCOVERY_BATCH_SIZE).all()
            if not rows:
                checkpoint["phase"] = "contact"
                _commit_scan_progress(db, run, checkpoint=checkpoint, scanned=0)
                break
            batch_candidates = [
                candidate
                for order in rows
                for candidate in _regular_candidates(order)
            ]
            _persist_scan_batch(db, run=run, candidates=batch_candidates)
            checkpoint["regular_last_id"] = rows[-1].id
            _commit_scan_progress(db, run, checkpoint=checkpoint, scanned=len(rows))

    if checkpoint["phase"] == "contact":
        while True:
            query = db.query(ContactLensOrder).filter(
                ContactLensOrder.clinic_id.in_(clinic_ids),
                ContactLensOrder.id > int(checkpoint["contact_last_id"]),
            )
            if checkpoint["contact_max_id"]:
                query = query.filter(ContactLensOrder.id <= int(checkpoint["contact_max_id"]))
            rows = query.order_by(ContactLensOrder.id.asc()).limit(DISCOVERY_BATCH_SIZE).all()
            if not rows:
                break
            batch_candidates = [
                candidate
                for order in rows
                for side in ("right", "left")
                for candidate in [_contact_candidate(order, side)]
                if candidate
            ]
            _persist_scan_batch(db, run=run, candidates=batch_candidates)
            checkpoint["contact_last_id"] = rows[-1].id
            _commit_scan_progress(db, run, checkpoint=checkpoint, scanned=len(rows))

    run.status = "ready"
    run.step = "Discovery scan completed"
    run.progress = 100
    run.scanned_orders = run.total_orders
    run.finished_at = _utcnow()
    run.locked_by = None
    run.lease_until = None
    run.error = None
    run.summary = {
        **(run.summary or {}),
        "needs_details": db.query(func.count(CatalogDiscoveryCandidate.id)).filter(
            CatalogDiscoveryCandidate.run_id == run.id,
            CatalogDiscoveryCandidate.needs_details.is_(True),
        ).scalar() or 0,
    }
    db.commit()


def _bulk_insert_observations(db: Session, rows: list[dict[str, Any]]) -> int:
    if not rows:
        return 0
    dialect = db.bind.dialect.name if db.bind is not None else ""
    if dialect == "postgresql":
        from sqlalchemy.dialects.postgresql import insert

        result = db.execute(insert(CatalogOrderObservation).values(rows).on_conflict_do_nothing())
    elif dialect == "sqlite":
        from sqlalchemy.dialects.sqlite import insert

        result = db.execute(insert(CatalogOrderObservation).values(rows).on_conflict_do_nothing())
    else:
        for row in rows:
            db.add(CatalogOrderObservation(**row))
        return len(rows)
    return result.rowcount if result.rowcount is not None and result.rowcount >= 0 else len(rows)


def _run_confirmation(db: Session, run: CatalogDiscoveryRun) -> None:
    checkpoint = dict(run.checkpoint or {})
    last_candidate_id = int(checkpoint.get("last_candidate_id") or 0)
    created_variants = int((run.summary or {}).get("created_variants") or 0)
    observations = int((run.summary or {}).get("observations") or 0)
    processed = int((run.summary or {}).get("confirmed_candidates") or 0)

    while True:
        candidate = db.query(CatalogDiscoveryCandidate).filter(
            CatalogDiscoveryCandidate.run_id == run.id,
            CatalogDiscoveryCandidate.company_id == run.company_id,
            CatalogDiscoveryCandidate.selected.is_(True),
            CatalogDiscoveryCandidate.id > last_candidate_id,
        ).order_by(CatalogDiscoveryCandidate.id.asc()).first()
        if not candidate:
            break
        if candidate.needs_details:
            raise ValueError("A selected discovery candidate is missing required details")
        product = create_product(
            db,
            company_id=run.company_id,
            category=candidate.category,
            data=candidate.product_data or {},
        )
        before = db.query(CatalogVariant.id).filter(
            CatalogVariant.company_id == run.company_id,
            CatalogVariant.normalized_fingerprint == normalized_variant_fingerprint(
                candidate.category, candidate.product_data or {}, candidate.variant_attributes or {}
            ),
        ).scalar()
        variant = create_variant(
            db,
            company_id=run.company_id,
            product=product,
            data={
                "attributes": candidate.variant_attributes or {},
                "is_stockable": candidate.category == "frame" and not candidate.needs_details,
            },
        )
        candidate.confirmed_variant_id = variant.id
        if before is None:
            created_variants += 1

        source_rows: list[dict[str, Any]] = []
        source_query = db.query(CatalogDiscoverySource).filter(
            CatalogDiscoverySource.candidate_id == candidate.id,
        ).order_by(CatalogDiscoverySource.id.asc())
        for source in source_query.yield_per(1000):
            source_rows.append({
                "company_id": run.company_id,
                "clinic_id": source.clinic_id,
                "variant_id": variant.id,
                "order_id": source.order_id,
                "contact_lens_order_id": source.contact_lens_order_id,
                "component": source.component,
                "observed_on": source.observed_on,
                "quantity": source.quantity,
            })
            if len(source_rows) >= 1000:
                observations += _bulk_insert_observations(db, source_rows)
                source_rows = []
        observations += _bulk_insert_observations(db, source_rows)

        processed += 1
        last_candidate_id = candidate.id
        run.progress = min(99, int(100 * processed / max(1, run.selected_count)))
        run.step = f"Creating catalog items ({processed:,}/{run.selected_count:,})"
        run.summary = {
            **(run.summary or {}),
            "created_variants": created_variants,
            "observations": observations,
            "confirmed_candidates": processed,
        }
        run.checkpoint = {"phase": "confirm", "last_candidate_id": last_candidate_id}
        _refresh_discovery_lease(run)
        db.commit()

    run.status = "confirmed"
    run.step = "Catalog items created"
    run.progress = 100
    run.confirmed_at = _utcnow()
    run.finished_at = run.confirmed_at
    run.locked_by = None
    run.lease_until = None
    run.error = None
    db.commit()


def run_discovery_job(db: Session, run: CatalogDiscoveryRun) -> None:
    try:
        if run.status == "running":
            _run_scan(db, run)
        elif run.status == "confirming":
            _run_confirmation(db, run)
    except Exception as exc:
        db.rollback()
        current = db.get(CatalogDiscoveryRun, run.id)
        if current:
            current.status = "failed"
            current.step = "Discovery failed"
            current.error = str(exc)[:2000]
            current.finished_at = _utcnow()
            current.locked_by = None
            current.lease_until = None
            db.commit()
        raise
