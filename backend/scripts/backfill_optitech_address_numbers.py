"""Split house numbers out of OptiTech-imported street addresses.

Imports before the address split stored "נתיבות המשפט 52/1" entirely in address_street.
A client is updated only when it came from the given migration job, its street is still
exactly what that import wrote (so hand-edited addresses are left alone), it has no house
number yet, and the address splits unambiguously.

Dry run by default; pass --apply to write.

    cd backend && .venv/bin/python -m scripts.backfill_optitech_address_numbers --job-id <job>
"""
from __future__ import annotations

import argparse
from collections import Counter

from sqlalchemy import or_

from database import SessionLocal
from migration.optitech.src.records import split_street_address
from models import Client, MigrationSourceLink


def plan(db, job_id: str):
    rows = (
        db.query(Client, MigrationSourceLink.payload)
        .join(MigrationSourceLink, MigrationSourceLink.target_id == Client.id)
        .filter(
            MigrationSourceLink.migration_job_id == job_id,
            MigrationSourceLink.target_model == "Client",
            Client.address_street.isnot(None),
            Client.address_street != "",
            or_(Client.address_number.is_(None), Client.address_number == ""),
        )
        .all()
    )
    changes, skipped = [], Counter()
    for client, payload in rows:
        imported_street = ((payload or {}).get("target_payload") or {}).get("address_street")
        if client.address_street != imported_street:
            skipped["edited since import"] += 1
            continue
        street, number = split_street_address(client.address_street)
        if not number:
            skipped["no unambiguous house number"] += 1
            continue
        changes.append((client, street, number))
    return changes, skipped


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--job-id", required=True, help="softoptic_migration_jobs.id of the OptiTech import")
    parser.add_argument("--apply", action="store_true", help="write the changes (default: dry run)")
    parser.add_argument("--samples", type=int, default=25)
    args = parser.parse_args()

    db = SessionLocal()
    try:
        changes, skipped = plan(db, args.job_id)
        clinics = Counter(client.clinic_id for client, _, _ in changes)
        print(f"{'APPLY' if args.apply else 'DRY RUN'}: {len(changes)} clients to update, by clinic {dict(clinics)}")
        print(f"skipped: {dict(skipped)}")
        for client, street, number in changes[: args.samples]:
            print(f"  client {client.id}: {client.address_street!r} -> street {street!r}, number {number!r}")
        if not args.apply:
            return
        for client, street, number in changes:
            client.address_street = street
            client.address_number = number
        db.commit()
        print(f"updated {len(changes)} clients")
    finally:
        db.close()


if __name__ == "__main__":
    main()
