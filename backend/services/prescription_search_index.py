from __future__ import annotations

from datetime import date
from typing import Any, Callable, Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from models import (
    ContactLensOrder,
    ExamLayoutInstance,
    OpticalExam,
    Order,
    PrescriptionSearchIndex,
    Referral,
    ReferralEye,
)


PRESCRIPTION_CARD_TYPES = {
    "subjective",
    "final-subjective",
    "final-prescription",
    "compact-prescription",
    "addition",
    "old-refraction",
    "old-refraction-extension",
    "objective",
    "retinoscop",
    "retinoscop-dilation",
    "contact-lens-details",
    "contact-lens-exam",
    "old-contact-lenses",
    "over-refraction",
}

PRESCRIPTION_CARD_TYPE_PREFIXES = sorted(PRESCRIPTION_CARD_TYPES, key=len, reverse=True)


def _to_float(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_int(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _to_text(value: Any) -> str | None:
    if value in (None, ""):
        return None
    return str(value)


def _date(value: Any) -> date | None:
    if isinstance(value, date):
        return value
    return None


def _extract_rows_from_component(
    component: dict[str, Any],
    *,
    source_type: str,
    source_id: int,
    client_id: int,
    clinic_id: int,
    source_date: date | None,
    card_type: str,
    exam_id: int | None = None,
    layout_instance_id: int | None = None,
) -> list[PrescriptionSearchIndex]:
    rows: list[PrescriptionSearchIndex] = []
    for eye_prefix, eye in (("r", "R"), ("l", "L")):
        sph = _to_float(component.get(f"{eye_prefix}_sph"))
        cyl = _to_float(component.get(f"{eye_prefix}_cyl"))
        ax = _to_int(component.get(f"{eye_prefix}_ax"))
        add = _to_float(
            component.get(f"{eye_prefix}_add")
            if component.get(f"{eye_prefix}_add") is not None
            else component.get(f"{eye_prefix}_ad")
        )
        va = _to_text(component.get(f"{eye_prefix}_va"))
        pd = _to_float(component.get(f"{eye_prefix}_pd"))

        if all(value is None for value in (sph, cyl, ax, add, va, pd)):
            continue

        rows.append(
            PrescriptionSearchIndex(
                source_type=source_type,
                source_id=source_id,
                client_id=client_id,
                clinic_id=clinic_id,
                exam_id=exam_id,
                layout_instance_id=layout_instance_id,
                card_type=card_type,
                source_date=source_date,
                eye=eye,
                sph=sph,
                cyl=cyl,
                ax=ax,
                add=add,
                va=va,
                pd=pd,
            )
        )
    return rows


def _iter_components(payload: Any) -> Iterable[tuple[str, dict[str, Any]]]:
    if not isinstance(payload, dict):
        return
    for key, value in payload.items():
        if not isinstance(value, dict):
            continue
        key_text = str(key)
        card_type = next(
            (prefix for prefix in PRESCRIPTION_CARD_TYPE_PREFIXES if key_text == prefix or key_text.startswith(f"{prefix}-")),
            key_text,
        )
        explicit_type = value.get("type")
        if isinstance(explicit_type, str):
            card_type = explicit_type
        if card_type in PRESCRIPTION_CARD_TYPES or any(
            f"{eye}_{field}" in value
            for eye in ("r", "l")
            for field in ("sph", "cyl", "ax", "add", "ad", "va", "pd")
        ):
            yield card_type, value


def _delete_source_rows(db: Session, source_type: str, source_id: int) -> None:
    db.query(PrescriptionSearchIndex).filter(
        PrescriptionSearchIndex.source_type == source_type,
        PrescriptionSearchIndex.source_id == source_id,
    ).delete(synchronize_session=False)


def delete_source_index_rows(db: Session, source_type: str, source_id: int) -> None:
    _delete_source_rows(db, source_type, source_id)


def delete_source_index_rows_bulk(db: Session, source_type: str, source_ids: Iterable[int], *, batch_size: int = 1000) -> int:
    batch_size = max(1, batch_size)
    ids = sorted({int(source_id) for source_id in source_ids if source_id is not None})
    deleted = 0
    for offset in range(0, len(ids), batch_size):
        batch = ids[offset : offset + batch_size]
        deleted += (
            db.query(PrescriptionSearchIndex)
            .filter(PrescriptionSearchIndex.source_type == source_type)
            .filter(PrescriptionSearchIndex.source_id.in_(batch))
            .delete(synchronize_session=False)
        )
    return deleted


def rebuild_exam_instance_index(db: Session, instance: ExamLayoutInstance) -> None:
    exam = db.query(OpticalExam).filter(OpticalExam.id == instance.exam_id).first()
    if not exam or not exam.client_id or not exam.clinic_id:
        return

    _delete_source_rows(db, "exam", instance.id)
    rows: list[PrescriptionSearchIndex] = []
    for card_type, component in _iter_components(instance.exam_data or {}):
        rows.extend(
            _extract_rows_from_component(
                component,
                source_type="exam",
                source_id=instance.id,
                client_id=exam.client_id,
                clinic_id=exam.clinic_id,
                source_date=_date(exam.exam_date),
                card_type=card_type,
                exam_id=exam.id,
                layout_instance_id=instance.id,
            )
        )
    db.add_all(rows)


def _flush_or_commit(db: Session, *, commit_each_batch: bool) -> None:
    if commit_each_batch:
        db.commit()
    else:
        db.flush()


def _delete_clinic_index_rows(
    db: Session,
    *,
    clinic_id: int,
    batch_size: int,
    commit_each_batch: bool,
) -> int:
    deleted = 0
    while True:
        ids = (
            db.execute(
                select(PrescriptionSearchIndex.id)
                .where(PrescriptionSearchIndex.clinic_id == clinic_id)
                .order_by(PrescriptionSearchIndex.id)
                .limit(batch_size)
            )
            .scalars()
            .all()
        )
        if not ids:
            return deleted
        deleted += (
            db.query(PrescriptionSearchIndex)
            .filter(PrescriptionSearchIndex.id.in_(ids))
            .delete(synchronize_session=False)
        )
        _flush_or_commit(db, commit_each_batch=commit_each_batch)


def _rebuild_rows_by_id(
    db: Session,
    *,
    query_factory: Callable[[int], Any],
    rebuild: Callable[[Session, Any], None],
    order_column: Any,
    batch_size: int,
    commit_each_batch: bool,
) -> int:
    last_id = 0
    processed = 0
    while True:
        rows = query_factory(last_id).order_by(order_column).limit(batch_size).all()
        if not rows:
            return processed
        for row in rows:
            rebuild(db, row)
            last_id = row.id
            processed += 1
        _flush_or_commit(db, commit_each_batch=commit_each_batch)


def rebuild_clinic_prescription_search_index(
    db: Session,
    clinic_id: int,
    *,
    batch_size: int = 500,
    commit_each_batch: bool = False,
) -> dict[str, int]:
    batch_size = max(1, batch_size)
    deleted = _delete_clinic_index_rows(
        db,
        clinic_id=clinic_id,
        batch_size=batch_size,
        commit_each_batch=commit_each_batch,
    )

    totals = {
        "deleted": deleted,
        "exam_layout_instances": _rebuild_rows_by_id(
            db,
            query_factory=lambda last_id: (
                db.query(ExamLayoutInstance)
                .join(OpticalExam, OpticalExam.id == ExamLayoutInstance.exam_id)
                .filter(OpticalExam.clinic_id == clinic_id)
                .filter(OpticalExam.client_id.isnot(None))
                .filter(ExamLayoutInstance.id > last_id)
            ),
            rebuild=rebuild_exam_instance_index,
            order_column=ExamLayoutInstance.id,
            batch_size=batch_size,
            commit_each_batch=commit_each_batch,
        ),
        "orders": _rebuild_rows_by_id(
            db,
            query_factory=lambda last_id: (
                db.query(Order)
                .filter(Order.clinic_id == clinic_id)
                .filter(Order.client_id.isnot(None))
                .filter(Order.id > last_id)
            ),
            rebuild=rebuild_order_index,
            order_column=Order.id,
            batch_size=batch_size,
            commit_each_batch=commit_each_batch,
        ),
        "contact_lens_orders": _rebuild_rows_by_id(
            db,
            query_factory=lambda last_id: (
                db.query(ContactLensOrder)
                .filter(ContactLensOrder.clinic_id == clinic_id)
                .filter(ContactLensOrder.client_id.isnot(None))
                .filter(ContactLensOrder.id > last_id)
            ),
            rebuild=rebuild_contact_lens_order_index,
            order_column=ContactLensOrder.id,
            batch_size=batch_size,
            commit_each_batch=commit_each_batch,
        ),
        "referrals": _rebuild_rows_by_id(
            db,
            query_factory=lambda last_id: (
                db.query(Referral)
                .filter(Referral.clinic_id == clinic_id)
                .filter(Referral.client_id.isnot(None))
                .filter(Referral.id > last_id)
            ),
            rebuild=rebuild_referral_index,
            order_column=Referral.id,
            batch_size=batch_size,
            commit_each_batch=commit_each_batch,
        ),
    }
    _flush_or_commit(db, commit_each_batch=commit_each_batch)
    return totals


def rebuild_order_index(db: Session, order: Order) -> None:
    _delete_source_rows(db, "order", order.id)
    if not order.client_id or not order.clinic_id:
        return
    rows: list[PrescriptionSearchIndex] = []
    for card_type, component in _iter_components(order.order_data or {}):
        rows.extend(
            _extract_rows_from_component(
                component,
                source_type="order",
                source_id=order.id,
                client_id=order.client_id,
                clinic_id=order.clinic_id,
                source_date=_date(order.order_date),
                card_type=card_type,
            )
        )
    db.add_all(rows)


def rebuild_contact_lens_order_index(db: Session, order: ContactLensOrder) -> None:
    _delete_source_rows(db, "contact_lens_order", order.id)
    if not order.client_id or not order.clinic_id:
        return
    rows: list[PrescriptionSearchIndex] = []
    for card_type, component in _iter_components(order.order_data or {}):
        rows.extend(
            _extract_rows_from_component(
                component,
                source_type="contact_lens_order",
                source_id=order.id,
                client_id=order.client_id,
                clinic_id=order.clinic_id,
                source_date=_date(order.order_date),
                card_type=card_type,
            )
        )
    db.add_all(rows)


def rebuild_referral_index(db: Session, referral: Referral) -> None:
    _delete_source_rows(db, "referral", referral.id)
    if not referral.client_id or not referral.clinic_id:
        return
    rows: list[PrescriptionSearchIndex] = []
    for card_type, component in _iter_components(referral.referral_data or {}):
        rows.extend(
            _extract_rows_from_component(
                component,
                source_type="referral",
                source_id=referral.id,
                client_id=referral.client_id,
                clinic_id=referral.clinic_id,
                source_date=_date(referral.date),
                card_type=card_type,
            )
        )

    for eye_row in db.query(ReferralEye).filter(ReferralEye.referral_id == referral.id).all():
        eye = "R" if str(eye_row.eye).upper().startswith("R") else "L"
        rows.append(
            PrescriptionSearchIndex(
                source_type="referral",
                source_id=referral.id,
                client_id=referral.client_id,
                clinic_id=referral.clinic_id,
                card_type="referral-eye",
                source_date=_date(referral.date),
                eye=eye,
                sph=eye_row.sph,
                cyl=eye_row.cyl,
                ax=eye_row.ax,
                add=eye_row.add_power,
                va=str(eye_row.va) if eye_row.va is not None else None,
                pd=eye_row.pd,
            )
        )
    db.add_all(rows)
