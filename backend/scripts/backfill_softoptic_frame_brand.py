"""Swap the frame supplier and brand of imported SoftOptic glasses orders.

OpticSoft's frame_supplier column holds the frame's brand and frame_manuf its supplier; older
imports read them the other way round, into the frame and into the frame's billing line. A value
is swapped only while it still equals the column the older import read it from, so anything
edited since the import is left alone.

Dry run by default; pass --apply to write.

    cd backend && .venv/bin/python -m scripts.backfill_softoptic_frame_brand --job-id <job>
"""
from __future__ import annotations

import argparse
import copy
from collections import Counter
from typing import Any, Dict, List, Tuple

from sqlalchemy.orm.attributes import flag_modified

from database import SessionLocal
from migration.pipeline.common import clean_legacy_text
from models import Billing, MigrationSourceLink, Order, OrderLineItem, SoftOpticMigrationJob


def _fix_frame(frame: Any, brand: Any, supplier: Any) -> int:
    """Older imports stored the brand as the supplier and the supplier as the manufacturer."""
    if not isinstance(frame, dict):
        return 0
    fixed = 0
    if brand != supplier and frame.get("supplier") == brand:
        frame["supplier"] = supplier
        fixed += 1
    if brand != supplier and frame.get("manufacturer") == supplier:
        frame["manufacturer"] = brand
        fixed += 1
    return fixed


def plan(db, job: SoftOpticMigrationJob) -> Tuple[List[tuple], Counter]:
    """Each change is (order, new order_data or None, [(line item, new supplied_by)])."""
    changes: List[tuple] = []
    counts: Counter = Counter()
    raw_by_order = dict(
        db.query(MigrationSourceLink.target_id, MigrationSourceLink.raw_payload)
        .filter(
            # Matches the (source_system, source_table, clinic_id) index; the job id alone scans every row.
            MigrationSourceLink.source_system == "softoptic",
            MigrationSourceLink.clinic_id == job.clinic_id,
            MigrationSourceLink.migration_job_id == job.id,
            MigrationSourceLink.target_model == "Order",
            MigrationSourceLink.source_table == "optic_glasses_presc.csv",
        )
        .all()
    )
    sources: Dict[int, Tuple[Any, Any, Any]] = {}
    for order_id, raw in raw_by_order.items():
        raw = raw or {}
        brand, supplier = clean_legacy_text(raw.get("frame_supplier")), clean_legacy_text(raw.get("frame_manuf"))
        if brand != supplier:
            sources[order_id] = (brand, supplier, clean_legacy_text(raw.get("frame_model")) or "Frame")
    ids = sorted(sources)
    for start in range(0, len(ids), 500):
        batch = ids[start:start + 500]
        items: Dict[int, List[OrderLineItem]] = {}
        for order_id, item in (
            db.query(Billing.order_id, OrderLineItem)
            .join(OrderLineItem, OrderLineItem.billings_id == Billing.id)
            .filter(Billing.order_id.in_(batch))
            .all()
        ):
            items.setdefault(order_id, []).append(item)
        for order in db.query(Order).filter(Order.id.in_(batch), Order.deleted_at.is_(None)).all():
            brand, supplier, description = sources[order.id]
            data = copy.deepcopy(order.order_data or {})
            fixed = _fix_frame(data.get("frame"), brand, supplier)
            for tab in data.get("lens_frame_tabs") or []:
                if isinstance(tab, dict):
                    fixed += _fix_frame(tab.get("frame"), brand, supplier)
            line_fixes = [
                (item, supplier)
                for item in items.get(order.id, [])
                if item.description == description and item.supplied_by == brand
            ]
            counts["frame fields swapped"] += fixed
            counts["billing lines fixed"] += len(line_fixes)
            if fixed or line_fixes:
                changes.append((order, data if fixed else None, line_fixes))
    counts["orders"] = len(raw_by_order)
    return changes, counts


def apply_changes(changes: List[tuple]) -> None:
    for order, data, line_fixes in changes:
        if data is not None:
            order.order_data = data
            flag_modified(order, "order_data")
        for item, supplied_by in line_fixes:
            item.supplied_by = supplied_by


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--job-id", required=True, help="softoptic_migration_jobs.id of the SoftOptic import")
    parser.add_argument("--apply", action="store_true", help="write the changes (default: dry run)")
    parser.add_argument("--samples", type=int, default=5)
    args = parser.parse_args()

    db = SessionLocal()
    try:
        job = db.get(SoftOpticMigrationJob, args.job_id)
        if job is None:
            raise SystemExit(f"No migration job {args.job_id}")
        changes, counts = plan(db, job)
        print(f"clinic {job.clinic_id}: {len(changes)} orders to update {dict(counts)}")
        for order, data, line_fixes in changes[: args.samples]:
            frame = (data or order.order_data or {}).get("frame") or {}
            print(f"  order {order.id}: brand {frame.get('manufacturer')!r}, supplier {frame.get('supplier')!r}, {len(line_fixes)} billing lines")
        if args.apply:
            apply_changes(changes)
            db.commit()
            print("applied")
        else:
            db.rollback()
            print("dry run; pass --apply to write")
    finally:
        db.close()


if __name__ == "__main__":
    main()
