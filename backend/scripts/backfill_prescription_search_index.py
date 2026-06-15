from __future__ import annotations

import argparse

from database import SessionLocal
from models import Clinic
from services.prescription_search_index import rebuild_clinic_prescription_search_index


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill derived prescription search rows.")
    parser.add_argument("--batch-size", type=int, default=100)
    parser.add_argument("--clinic-id", type=int)
    args = parser.parse_args()

    db = SessionLocal()
    try:
        clinic_ids = [args.clinic_id] if args.clinic_id else [row[0] for row in db.query(Clinic.id).order_by(Clinic.id).all()]
        totals = {}
        for clinic_id in clinic_ids:
            totals[clinic_id] = rebuild_clinic_prescription_search_index(
                db,
                clinic_id,
                batch_size=args.batch_size,
                commit_each_batch=True,
            )
            print(f"clinic {clinic_id}: {totals[clinic_id]}")
        print(f"done: {totals}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
