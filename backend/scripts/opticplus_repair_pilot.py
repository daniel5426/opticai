"""Guarded OpticPlus v2 pilot repair. Defaults to a read-only preview.

Requires an existing completed import, exact target identity and selected-client bundle.
No clinic-wide catalog import, schema mutation, hard deletion or source modification.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import sys
from uuid import uuid4


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--bundle',type=Path,required=True)
    p.add_argument('--previous-import-job-id',required=True)
    p.add_argument('--clinic-id',type=int,required=True)
    p.add_argument('--company-id',type=int,required=True)
    p.add_argument('--clinic-name',required=True)
    p.add_argument('--expected-db-user',required=True)
    p.add_argument('--source-client-id',type=int,action='append',required=True)
    p.add_argument('--output',type=Path,required=True)
    p.add_argument('--apply',action='store_true')
    args=p.parse_args()
    sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
    from dotenv import dotenv_values
    from sqlalchemy import create_engine, inspect
    from sqlalchemy.engine import make_url
    from sqlalchemy.orm import Session
    from database import Base
    from models import (Client,Clinic,SoftOpticMigrationJob,MigrationSourceLink,OpticalExam,
                        ExamLayoutInstance,MedicalLog,OrderGroup,Billing,BillingPayment,OrderLineItem)
    from migration.opticplus.bundle import validate_bundle,source_id
    from migration.opticplus.mapping import json_value
    from migration.opticplus.clinical import CLINICAL_REVISION
    from services.opticplus_migration_service import OpticPlusImporter, MODELS
    url=make_url(dotenv_values(Path(__file__).resolve().parents[1]/'.env')['DATABASE_URL'])
    if url.get_backend_name()!='postgresql' or url.database!='postgres' or url.username!=args.expected_db_user:
        raise SystemExit('Database identity does not match the explicitly requested target')
    print(json.dumps({'database_backend':url.get_backend_name(),'host':url.host,'database':url.database,'username':url.username}))
    manifest=json.loads((args.bundle/'manifest.json').read_text())
    validation=validate_bundle(args.bundle,manifest)
    selected={source_id(i) for i in args.source_client_id}
    if set(map(source_id,manifest['selected_client_ids']))!=selected:
        raise SystemExit('Bundle selection differs from requested pilot clients')
    args.output.mkdir(mode=0o700,parents=True,exist_ok=False)
    engine=create_engine(url,hide_parameters=True)
    inspector=inspect(engine)
    missing={}
    for model in [Client,OpticalExam,MedicalLog,OrderGroup,ExamLayoutInstance,MigrationSourceLink,
                  MODELS["Order"],MODELS["ContactLensOrder"],Billing,OrderLineItem]:
        actual={column["name"] for column in inspector.get_columns(model.__tablename__)}
        absent=set(model.__table__.columns.keys())-actual
        if absent: missing[model.__tablename__]=sorted(absent)
    if missing:
        raise SystemExit("This checkout requires columns absent from the configured database: " + json.dumps(missing) + ". Reconcile repository schema separately; this repair wrote no records.")
    with Session(engine,autoflush=False) as db:
        clinic=db.get(Clinic,args.clinic_id)
        if not clinic or clinic.company_id!=args.company_id or clinic.name!=args.clinic_name or clinic.maintenance_mode:
            raise SystemExit('Clinic identity/state differs from requested target')
        previous=db.get(SoftOpticMigrationJob,args.previous_import_job_id)
        if not previous or previous.status!='completed' or previous.source_system!='opticplus' or previous.clinic_id!=clinic.id or previous.company_id!=clinic.company_id:
            raise SystemExit('Previous import does not match this clinic')
        dataset=(previous.source_metadata or {}).get('dataset_id')
        if not dataset: raise SystemExit('Previous import has no dataset binding')
        if db.query(SoftOpticMigrationJob.id).filter(SoftOpticMigrationJob.clinic_id==clinic.id,
            SoftOpticMigrationJob.status.in_(['queued','running','paused','awaiting_upload'])).first():
            raise SystemExit('Clinic already has an active migration')
        links=db.query(MigrationSourceLink).filter_by(source_system='opticplus',clinic_id=clinic.id,company_id=clinic.company_id).filter(
            MigrationSourceLink.raw_row_ref.like(f'opticplus:{dataset}:%')).all()
        client_ids=[]
        for source in selected:
            candidates=[link for link in links if link.target_model=='Client' and str(link.source_per_id)==source]
            if len(candidates)!=1: raise SystemExit('Pilot client does not have exactly one existing source binding')
            client=db.get(Client,candidates[0].target_id)
            if not client or client.clinic_id!=clinic.id or client.company_id!=clinic.company_id or client.deleted_at:
                raise SystemExit('Pilot source binding points outside target or to removed client')
            client_ids.append(client.id)
        scoped_links=[link for link in links if str(link.source_per_id) in selected or
                      source_id_safe((link.raw_payload or {}).get('numw')) in selected or
                      source_id_safe((link.raw_payload or {}).get('wnum')) in selected]
        backup=[]
        for link in scoped_links:
            model=MODELS.get(link.target_model)
            target=db.get(model,link.target_id) if model else None
            backup.append({'link':{c.name:json_value(getattr(link,c.name)) for c in MigrationSourceLink.__table__.columns},
                'target':{c.name:json_value(getattr(target,c.name)) for c in model.__table__.columns} if target else None})
        groups=db.query(OrderGroup).filter(OrderGroup.clinic_id==clinic.id,OrderGroup.payer_client_id.in_(client_ids)).all()
        finance=[]
        for group in groups:
            bill=db.query(Billing).filter_by(order_group_id=group.id).one()
            finance.append({'group_id':group.id,'total':bill.total_after_discount,'paid':bill.prepayment_amount})
        reviewer=OpticPlusImporter(db,previous,args.bundle,validation)
        finance_snapshot=[reviewer.finance_state(db.query(Billing).filter_by(order_group_id=group.id).one()) for group in groups]
        (args.output/'before.json').write_text(json.dumps({'records':backup,'finance':finance_snapshot},ensure_ascii=False,indent=2))
        print(json.dumps({'dry_run':not args.apply,'clinic_id':clinic.id,'company_id':clinic.company_id,
            'source_clients':sorted(selected),'existing_client_ids':client_ids,'source_counts':validation['counts'],'finance_before':finance}))
        if not args.apply: return
        job=SoftOpticMigrationJob(id='opticplus-pilot-v2-'+uuid4().hex,source_system='opticplus',clinic_id=clinic.id,company_id=clinic.company_id,
            status='running',step='opticplus.repair',progress=0,locked_by='explicit-pilot-repair',
            lease_until=datetime.now(timezone.utc)+timedelta(minutes=10),source_fingerprint=manifest['source_fingerprint'],bundle_format_version=2,
            source_metadata={'dataset_id':dataset,'mapping_version':2,'clinical_revision':CLINICAL_REVISION,'selected_client_ids':sorted(map(int,selected)),
                'previous_import_job_id':previous.id,'include_reference_data':False})
        db.add(job);db.commit()
        importer=OpticPlusImporter(db,job,args.bundle,validation)
        try:
            report=importer.run()
        except Exception as exc:
            db.rollback()
            failed=db.get(SoftOpticMigrationJob,job.id)
            failed.status='failed';failed.step='opticplus.failed';failed.error=type(exc).__name__
            db.commit()
            raise
        for entry in finance:
            bill=db.query(Billing).filter_by(order_group_id=entry['group_id']).one()
            assert (bill.total_after_discount,bill.prepayment_amount)==(entry['total'],entry['paid']), 'Pilot balances changed'
        job.status='completed';job.progress=100;job.step='opticplus.completed'
        job.validation_summary={'counts':validation['counts'],'manifest':{'mapping_version':2,'format_version':2}}
        job.import_summary={**(job.import_summary or {}),'reconciliation':report}
        db.commit()
        (args.output/'reconciliation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
        print(json.dumps({'job_id':job.id,'status':job.status,'client_ids':client_ids,'counts':dict(importer.counts)}))
    engine.dispose()


def source_id_safe(value):
    if value is None: return None
    text=str(value)
    return str(int(text)) if text.isascii() and text.isdecimal() else None

if __name__=='__main__':main()
