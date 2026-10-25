#!/usr/bin/env python3
"""Explicit, target-checked staged maintenance; dry-run unless --apply is supplied."""
import argparse
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))
from sqlalchemy.engine import make_url
from config import settings
from database import SessionLocal
from models import User, File
from security.scope import assert_clinic_scope
from agent.authority import Authority


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['prescriptions', 'documents'])
    parser.add_argument('--clinic-id', type=int, required=True)
    parser.add_argument('--staff-user-id', type=int, required=True)
    parser.add_argument('--batch-size', type=int, default=100)
    parser.add_argument('--after-id', type=int, default=0)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--expected-host')
    parser.add_argument('--expected-database')
    args = parser.parse_args()
    target = make_url(settings.DATABASE_URL)
    print({'backend': target.get_backend_name(), 'host': target.host, 'database': target.database, 'username': target.username})
    if args.batch_size < 1 or args.batch_size > 1000:
        parser.error('batch-size must be between 1 and 1000')
    if args.apply and (args.expected_host != (target.host or 'local') or args.expected_database != target.database):
        parser.error('Supply the exact displayed --expected-host and --expected-database before applying.')
    with SessionLocal() as db:
        user = db.get(User, args.staff_user_id)
        if not user or not user.is_active or (user.role_level or 0) < 3:
            parser.error('An active clinic manager is required.')
        assert_clinic_scope(db, user, args.clinic_id)
        if not args.apply:
            print({'operation': args.operation, 'clinic_id': args.clinic_id, 'dry_run': True})
            return
        if args.operation == 'prescriptions':
            from services.prescription_index_maintenance import backfill
            print(backfill(db, args.clinic_id, args.batch_size))
        else:
            from services.clinic_catalog import scoped_query
            from agent.document_library import enqueue
            auth = Authority(user, args.clinic_id, 'maintenance')
            files = scoped_query(db, auth, 'files').filter(File.id > args.after_id).order_by(File.id).limit(args.batch_size).all()
            for file in files:
                enqueue(db, auth, file.id)
            print({'queued': len(files), 'after_id': files[-1].id if files else args.after_id})


if __name__ == '__main__':
    main()
