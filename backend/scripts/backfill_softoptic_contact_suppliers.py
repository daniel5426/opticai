"""Add an imported SoftOptic clinic's contact lens suppliers to its contact lens supplier lookup.

OpticSoft lists contact lens suppliers in optic_tv_contact_manuf, and each contact lens order
stores its eyes' supplier from right_manuf/left_manuf. Older imports put that list into the
manufacturer lookup, so the contact lens supplier field did not offer them. New imports add them to
the contact lens supplier lookup. Run it after migration 0069, which creates that lookup.

For one import job, this adds the supplier names its contact lens orders use, and the names in its
optic_tv_contact_manuf export when the job's bundle (or --csv-dir) is available, to the job's
clinic only. It only adds missing names: nothing the clinic entered is changed or removed, orders
are not touched, and other clinics are never read or written.

Dry run by default; pass --apply to write.

    cd backend && .venv/bin/python -m scripts.backfill_softoptic_contact_suppliers --job-id <job>
"""
from __future__ import annotations

import argparse
import shutil
import tempfile
from pathlib import Path
from typing import List, Optional, Set

from database import SessionLocal
from migration.pipeline.common import clean_legacy_text, read_csv
from models import LookupContactLensSupplier, MigrationSourceLink, SoftOpticMigrationJob


def used_supplier_names(db, job: SoftOpticMigrationJob) -> Set[str]:
    """The supplier names the job's imported contact lens orders were given."""
    names: Set[str] = set()
    for (raw,) in db.query(MigrationSourceLink.raw_payload).filter(
        # Matches the (source_system, source_table, clinic_id) index; the job id alone scans every row.
        MigrationSourceLink.source_system == "softoptic",
        MigrationSourceLink.source_table == "optic_contact_presc.csv",
        MigrationSourceLink.clinic_id == job.clinic_id,
        MigrationSourceLink.migration_job_id == job.id,
    ):
        for column in ("right_manuf", "left_manuf"):
            name = clean_legacy_text((raw or {}).get(column))
            if name:
                names.add(name)
    return names


def listed_supplier_names(csv_dir: Optional[str]) -> Set[str]:
    if not csv_dir:
        return set()
    return {name for name in (clean_legacy_text(r.get("name")) for r in read_csv(csv_dir, "optic_tv_contact_manuf.csv")) if name}


def plan(db, job: SoftOpticMigrationJob, csv_dir: Optional[str] = None) -> List[str]:
    """The contact lens supplier names the job's clinic is missing from its contact lens supplier lookup."""
    existing = {name for (name,) in db.query(LookupContactLensSupplier.name).filter(LookupContactLensSupplier.clinic_id == job.clinic_id)}
    return sorted((used_supplier_names(db, job) | listed_supplier_names(csv_dir)) - existing)


def apply(db, job: SoftOpticMigrationJob, names: List[str]) -> None:
    db.add_all(LookupContactLensSupplier(clinic_id=job.clinic_id, name=name) for name in names)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--job-id", required=True, help="softoptic_migration_jobs.id of the clinic's SoftOptic import")
    parser.add_argument("--apply", action="store_true", help="write the changes (default: dry run)")
    parser.add_argument("--csv-dir", help="the SoftOptic export, when the job's bundle is no longer stored")
    args = parser.parse_args()

    db = SessionLocal()
    temp_dir = None
    try:
        job = db.get(SoftOpticMigrationJob, args.job_id)
        if job is None:
            raise SystemExit(f"No migration job {args.job_id}")
        csv_dir = args.csv_dir
        if not csv_dir and job.bundle_storage_bucket and job.bundle_storage_key:
            from services.file_storage_service import get_file_storage_service
            from services.softoptic_migration_service import _find_csv_root, _safe_extract_zip

            temp_dir = Path(tempfile.mkdtemp(prefix=f"softoptic_contact_suppliers_{job.id}_"))
            bundle = temp_dir / "bundle.zip"
            get_file_storage_service().download_to_path(job.bundle_storage_bucket, job.bundle_storage_key, bundle)
            _safe_extract_zip(bundle, temp_dir)
            csv_dir = str(_find_csv_root(temp_dir))
        if not csv_dir:
            print("The job's bundle is no longer stored; adding only the names its orders use (pass --csv-dir for the full list).")

        names = plan(db, job, csv_dir)
        print(f"clinic {job.clinic_id}: {len(names)} contact lens suppliers to add {names}")
        if args.apply:
            apply(db, job, names)
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
