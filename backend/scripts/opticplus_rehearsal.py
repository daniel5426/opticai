"""Run an OpticPlus bundle against a NEW private SQLite database, never backend/.env.

Usage: backend/.venv/bin/python backend/scripts/opticplus_rehearsal.py --bundle DIR --output DIR [--repeat]
Source rows and database stay in the private output directory. Only aggregate results print.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import json
import os
from pathlib import Path
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--repeat', action='store_true')
    args = parser.parse_args()
    args.output.mkdir(mode=0o700, parents=True, exist_ok=False)
    database = args.output / 'rehearsal.sqlite'
    os.environ['DATABASE_URL'] = 'sqlite:///' + str(database.resolve())
    os.environ['SECRET_KEY'] = 'isolated-opticplus-rehearsal-only'
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from sqlalchemy import create_engine, func
    from sqlalchemy.orm import sessionmaker
    from database import Base
    from models import (Client, Clinic, Company, OpticalExam, OrderGroup, Billing, BillingPayment,
                        MigrationSourceLink, ExamLayoutInstance, SoftOpticMigrationJob)
    from migration.opticplus.bundle import validate_bundle, iter_rows
    from services.opticplus_migration_service import OpticPlusImporter
    manifest = json.loads((args.bundle / 'manifest.json').read_text())
    validation = validate_bundle(args.bundle, manifest)
    engine = create_engine(os.environ['DATABASE_URL'], hide_parameters=True)
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine, autoflush=False)() as db:
        company = Company(name='Isolated OpticPlus rehearsal', owner_full_name='Synthetic')
        db.add(company); db.flush()
        clinic = Clinic(name='Isolated rehearsal', unique_id='opticplus-rehearsal', company_id=company.id, is_active=True)
        db.add(clinic); db.commit()
        before = None
        for attempt in range(2 if args.repeat else 1):
            job = SoftOpticMigrationJob(id=f'opticplus-v2-rehearsal-{attempt}', source_system='opticplus',
                clinic_id=clinic.id, company_id=company.id, status='running', locked_by='isolated-rehearsal',
                lease_until=datetime.now(timezone.utc)+timedelta(minutes=10), source_metadata={'dataset_id':'a'*32})
            db.add(job); db.commit()
            importer = OpticPlusImporter(db, job, args.bundle, validation)
            original_checkpoint = importer.checkpoint
            def checkpoint(table, offset, *, done=False):
                original_checkpoint(table, offset, done=done)
                if done or offset % 5000 == 0: print(json.dumps({'phase':table,'rows':offset,'done':done}), flush=True)
            importer.checkpoint = checkpoint
            report = importer.run()
            counts = {model.__name__:db.query(model).count() for model in [Client,OpticalExam,OrderGroup,Billing,BillingPayment,MigrationSourceLink,ExamLayoutInstance]}
            assert counts['Client'] == validation['counts']['cust_list']
            assert counts['OrderGroup'] == validation['counts']['orders']
            assert counts['BillingPayment'] == 0
            source_totals = {key:sum((Decimal(str(row.get(key) or 0)) for row in iter_rows(args.bundle,validation['tables']['orders'])),Decimal(0)) for key in ['gf_price','tpay','gpay']}
            target = db.query(func.sum(Billing.total_after_discount),func.sum(Billing.prepayment_amount)).one()
            assert abs(Decimal(str(target[0] or 0))-source_totals['gf_price']) < Decimal('.01')
            assert abs(Decimal(str(target[1] or 0))-source_totals['tpay']) < Decimal('.01')
            assert source_totals['gf_price']-source_totals['tpay']==source_totals['gpay']
            if before is not None: assert counts == before, 'Repeat created duplicate records'
            before = counts
            for instance in db.query(ExamLayoutInstance).yield_per(500):
                assert 'contact-lens-details' not in (instance.exam_data or {})
                assert all(item['type']!='contact-lens-details' for item in json.loads(instance.layout_data or '{}').get('items',[]))
            summary={'counts':counts,'source_totals':{k:str(v) for k,v in source_totals.items()},'coverage':report['coverage'],
                     'warnings':{k:v for k,v in importer.counts.items() if k.startswith('warning:')},'mapping_version':2,'attempt':attempt+1}
            (args.output/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
            job.status='completed';db.commit()
            print(json.dumps(summary,ensure_ascii=False),flush=True)
    engine.dispose()

if __name__ == '__main__': main()
