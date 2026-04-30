from __future__ import annotations

import argparse
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from database import SessionLocal  # noqa: E402
from models import Clinic  # noqa: E402
from services.default_exam_layouts import ensure_default_exam_layouts_for_clinic  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed code-owned default exam layouts into clinic DB rows.")
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--all-clinics", action="store_true", help="Seed every clinic.")
    target.add_argument("--clinic-id", type=int, help="Seed one clinic by id.")
    parser.add_argument("--dry-run", action="store_true", help="Report what would happen without committing changes.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    db = SessionLocal()
    try:
        if args.all_clinics:
            clinic_ids = [row[0] for row in db.query(Clinic.id).order_by(Clinic.id.asc()).all()]
        else:
            clinic_ids = [args.clinic_id]

        total = {"created": 0, "tagged": 0, "existing": 0}
        for clinic_id in clinic_ids:
            result = ensure_default_exam_layouts_for_clinic(db, clinic_id, dry_run=args.dry_run)
            print(f"clinic_id={clinic_id} created={result['created']} tagged={result['tagged']} existing={result['existing']}")
            for key in total:
                total[key] += result[key]

        if args.dry_run:
            db.rollback()
        else:
            db.commit()
        print(f"total created={total['created']} tagged={total['tagged']} existing={total['existing']}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
