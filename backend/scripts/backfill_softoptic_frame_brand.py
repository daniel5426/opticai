"""Swap the frame supplier and brand of imported SoftOptic glasses orders.

OpticSoft's frame_supplier column holds the frame's brand and frame_manuf its supplier; older
imports read them the other way round, into the frame, the frame's billing line and the lookups.
A value is swapped only while it still equals the column the older import read it from, so anything
edited since the import is left alone.

The lookups are name lists that orders do not point at. The frame suppliers (OpticSoft's
optic_tv_frame_manuf, read from the import's export bundle) are added to the supplier lookup and
taken out of the brand lookup, except a name that is also a contact lens manufacturer or a frame
brand. The brands the orders use often enough are added to the brand lookup.

Dry run by default; pass --apply to write.

    cd backend && .venv/bin/python -m scripts.backfill_softoptic_frame_brand --job-id <job>
"""
from __future__ import annotations

import argparse
import copy
import shutil
import tempfile
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple

from sqlalchemy.orm.attributes import flag_modified

from database import SessionLocal
from migration.pipeline.common import clean_legacy_text, read_csv
from migration.pipeline.steps import frame_brand_lookup_names
from models import (
    Billing,
    LookupManufacturer,
    LookupSupplier,
    MigrationSourceLink,
    Order,
    OrderLineItem,
    SoftOpticMigrationJob,
)


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


def _names(csv_dir: str, filename: str) -> Set[str]:
    return {name for name in (clean_legacy_text(r.get("name")) for r in read_csv(csv_dir, filename)) if name}


def plan_lookups(db, job: SoftOpticMigrationJob, csv_dir: str) -> Dict[str, List[str]]:
    """The supplier names to add, and the brand names to add and to remove, for the job's clinic."""
    suppliers = _names(csv_dir, "optic_tv_frame_manuf.csv")
    contact_manufacturers = _names(csv_dir, "optic_tv_contact_manuf.csv")
    brands = Counter(
        clean_legacy_text((raw or {}).get("frame_supplier"))
        for (raw,) in db.query(MigrationSourceLink.raw_payload).filter(
            MigrationSourceLink.source_system == "softoptic",
            MigrationSourceLink.clinic_id == job.clinic_id,
            MigrationSourceLink.migration_job_id == job.id,
            MigrationSourceLink.target_model == "Order",
            MigrationSourceLink.source_table == "optic_glasses_presc.csv",
        )
    )
    used_brands = set(frame_brand_lookup_names(brands))

    def existing(model) -> Set[str]:
        return {name for (name,) in db.query(model.name).filter(model.clinic_id == job.clinic_id)}

    current_suppliers, current_brands = existing(LookupSupplier), existing(LookupManufacturer)
    return {
        "add_suppliers": sorted(suppliers - current_suppliers),
        "add_brands": sorted(used_brands - current_brands),
        "remove_brands": sorted((suppliers & current_brands) - contact_manufacturers - used_brands),
    }


def apply_lookups(db, job: SoftOpticMigrationJob, lookups: Dict[str, List[str]]) -> None:
    db.add_all(LookupSupplier(clinic_id=job.clinic_id, name=name) for name in lookups["add_suppliers"])
    db.add_all(LookupManufacturer(clinic_id=job.clinic_id, name=name) for name in lookups["add_brands"])
    if lookups["remove_brands"]:
        db.query(LookupManufacturer).filter(
            LookupManufacturer.clinic_id == job.clinic_id, LookupManufacturer.name.in_(lookups["remove_brands"])
        ).delete(synchronize_session=False)


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
    parser.add_argument("--csv-dir", help="the SoftOptic export, when the job's bundle is no longer stored")
    parser.add_argument("--samples", type=int, default=5)
    args = parser.parse_args()

    db = SessionLocal()
    temp_dir = None
    try:
        job = db.get(SoftOpticMigrationJob, args.job_id)
        if job is None:
            raise SystemExit(f"No migration job {args.job_id}")
        csv_dir = args.csv_dir
        if not csv_dir:
            from services.file_storage_service import get_file_storage_service
            from services.softoptic_migration_service import _find_csv_root, _safe_extract_zip

            if not (job.bundle_storage_bucket and job.bundle_storage_key):
                raise SystemExit("The job's bundle is no longer stored; pass --csv-dir with the export.")
            temp_dir = Path(tempfile.mkdtemp(prefix=f"softoptic_frame_brand_{job.id}_"))
            bundle = temp_dir / "bundle.zip"
            get_file_storage_service().download_to_path(job.bundle_storage_bucket, job.bundle_storage_key, bundle)
            _safe_extract_zip(bundle, temp_dir)
            csv_dir = str(_find_csv_root(temp_dir))

        lookups = plan_lookups(db, job, csv_dir)
        for key, names in lookups.items():
            print(f"lookups {key}: {len(names)} {names[:10]}")
        changes, counts = plan(db, job)
        print(f"clinic {job.clinic_id}: {len(changes)} orders to update {dict(counts)}")
        for order, data, line_fixes in changes[: args.samples]:
            frame = (data or order.order_data or {}).get("frame") or {}
            print(f"  order {order.id}: brand {frame.get('manufacturer')!r}, supplier {frame.get('supplier')!r}, {len(line_fixes)} billing lines")
        if args.apply:
            apply_lookups(db, job, lookups)
            apply_changes(changes)
            db.commit()
            print("applied")
        else:
            db.rollback()
            print("dry run; pass --apply to write")
    finally:
        db.close()
        if temp_dir:
            shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
