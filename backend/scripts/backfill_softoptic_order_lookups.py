"""Name SoftOptic order lookups that older imports stored as OpticSoft codes.

Imports before the lookup mapping kept order status, seller, delivered-by and technician as
codes ("19", "2"), and filled a contact lens order's supply branch with the clinic even when
OpticSoft left it empty. A value is changed only while it still equals the code in the order's
stored source row, so anything edited since the import is left alone. The names come from the
import's own export bundle.

Dry run by default; pass --apply to write.

    cd backend && .venv/bin/python -m scripts.backfill_softoptic_order_lookups --job-id <job>
"""
from __future__ import annotations

import argparse
import shutil
import tempfile
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Tuple

from sqlalchemy.orm.attributes import flag_modified

from database import SessionLocal
from migration.pipeline.common import clean_legacy_text
from migration.pipeline.steps import _build_account_name_map, _build_lookup_code_name_map
from models import ContactLensOrder, MigrationSourceLink, Order, SoftOpticMigrationJob

# Order field -> (source column, lookup)
CONTACT_FIELDS = {"order_status": ("order_status", "status"), "advisor": ("advisor_code", "workers")}
REGULAR_DETAIL_FIELDS = {
    "order_status": ("order_status", "status"),
    "advisor": ("advisor_code", "workers"),
    "delivered_by": ("giver_code", "workers"),
    "technician": ("tech_code", "workers"),
    "delivery_location": ("supply_branch", "sites"),
}


def load_lookups(csv_dir: str) -> Dict[str, Dict[str, str]]:
    return {
        "status": _build_lookup_code_name_map(csv_dir, "optic_tv_order_status.csv"),
        "workers": _build_account_name_map(csv_dir, "WORK"),
        "sites": _build_account_name_map(csv_dir, "SITE"),
    }


def _named(value: Any, raw: Dict[str, Any], column: str, lookup: Dict[str, str]):
    code = clean_legacy_text(raw.get(column))
    if not code or value != code or code not in lookup:
        return None
    return lookup[code]


def plan(db, job: SoftOpticMigrationJob, lookups: Dict[str, Dict[str, str]]) -> Tuple[List[tuple], Counter]:
    """Each change is (record, field path, old value, new value)."""
    changes: List[tuple] = []
    counts: Counter = Counter()
    links = (
        db.query(MigrationSourceLink.target_model, MigrationSourceLink.target_id, MigrationSourceLink.raw_payload)
        .filter(
            MigrationSourceLink.migration_job_id == job.id,
            MigrationSourceLink.target_model.in_(("ContactLensOrder", "Order")),
            MigrationSourceLink.source_table.in_(("optic_contact_presc.csv", "optic_glasses_presc.csv")),
        )
        .all()
    )
    for model, name in ((ContactLensOrder, "ContactLensOrder"), (Order, "Order")):
        raw_by_id = {target_id: raw or {} for target_model, target_id, raw in links if target_model == name}
        ids = sorted(raw_by_id)
        for start in range(0, len(ids), 1000):
            batch = db.query(model).filter(model.id.in_(ids[start:start + 1000]), model.deleted_at.is_(None))
            for order in batch:
                raw = raw_by_id[order.id]
                if model is ContactLensOrder:
                    block = (order.order_data or {}).get("contact-lens-order") or {}
                    for field, (column, lookup) in CONTACT_FIELDS.items():
                        name_ = _named(getattr(order, field), raw, column, lookups[lookup])
                        if name_:
                            changes.append((order, field, getattr(order, field), name_))
                        block_name = _named(block.get(field), raw, column, lookups[lookup])
                        if block_name:
                            changes.append((order, f"order_data.contact-lens-order.{field}", block.get(field), block_name))
                    if not clean_legacy_text(raw.get("supply_branch")) and order.supply_in_clinic_id == job.clinic_id:
                        changes.append((order, "supply_in_clinic_id", order.supply_in_clinic_id, None))
                else:
                    details = (order.order_data or {}).get("details") or {}
                    for field, (column, lookup) in REGULAR_DETAIL_FIELDS.items():
                        name_ = _named(details.get(field), raw, column, lookups[lookup])
                        if name_:
                            changes.append((order, f"order_data.details.{field}", details.get(field), name_))
    for _, path, _, _ in changes:
        counts[path.rsplit(".", 1)[-1]] += 1
    return changes, counts


def apply_changes(changes: List[tuple]) -> None:
    for record, path, _, new in changes:
        if not path.startswith("order_data."):
            setattr(record, path, new)
            continue
        _, block, field = path.split(".")
        data = dict(record.order_data or {})
        data[block] = {**(data.get(block) or {}), field: new}
        record.order_data = data
        flag_modified(record, "order_data")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--job-id", required=True, help="softoptic_migration_jobs.id of the SoftOptic import")
    parser.add_argument("--csv-dir", help="the export's extracted CSVs (default: download the job's bundle)")
    parser.add_argument("--apply", action="store_true", help="write the changes (default: dry run)")
    parser.add_argument("--samples", type=int, default=10)
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
            temp_dir = Path(tempfile.mkdtemp(prefix=f"softoptic_lookups_{job.id}_"))
            bundle = temp_dir / "bundle.zip"
            get_file_storage_service().download_to_path(job.bundle_storage_bucket, job.bundle_storage_key, bundle)
            _safe_extract_zip(bundle, temp_dir)
            csv_dir = str(_find_csv_root(temp_dir))

        changes, counts = plan(db, job, load_lookups(csv_dir))
        print(f"clinic {job.clinic_id}: {len(changes)} changes {dict(counts)}")
        for record, path, old, new in changes[: args.samples]:
            print(f"  {type(record).__name__} {record.id} {path}: {old!r} -> {new!r}")
        if args.apply:
            apply_changes(changes)
            db.commit()
            print("applied")
        else:
            print("dry run; pass --apply to write")
    finally:
        db.close()
        if temp_dir:
            shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
