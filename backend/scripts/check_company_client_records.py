"""Read-only ownership preflight. Prints target identity and IDs, never credentials/PII."""
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from config import settings

TABLES = ('clients', 'families', 'optical_exams', 'medical_logs', 'referrals', 'appointments',
          'files', 'orders', 'contact_lens_orders', 'order_groups', 'prysm_followup_tasks')


def preflight(connection):
    inspector = inspect(connection)
    issues = {}
    for table in TABLES:
        columns = {column['name'] for column in inspector.get_columns(table)}
        anchor = 'payer_client_id' if table == 'order_groups' else ('client_id' if 'client_id' in columns else None)
        candidates = ['r.company_id'] if 'company_id' in columns else []
        candidates += ['(SELECT company_id FROM clinics WHERE id=r.clinic_id)']
        if anchor:
            candidates += [f'(SELECT company_id FROM clients WHERE id=r.{anchor})']
        company = 'COALESCE(' + ','.join(candidates) + ')' if len(candidates)>1 else candidates[0]
        conditions = [f'{company} IS NULL', f'(r.clinic_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM clinics c WHERE c.id=r.clinic_id AND c.company_id={company}))']
        if anchor:
            conditions += [f'(r.{anchor} IS NOT NULL AND NOT EXISTS (SELECT 1 FROM clients c WHERE c.id=r.{anchor} AND c.company_id={company}))']
        if table=='clients':
            conditions += ['(r.merged_into_client_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM clients m WHERE m.id=r.merged_into_client_id AND m.company_id=r.company_id))']
            conditions += ['(r.family_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM families f LEFT JOIN clinics fc ON fc.id=f.clinic_id WHERE f.id=r.family_id AND COALESCE(f.company_id,fc.company_id)=r.company_id))']
        predicate = ' OR '.join(conditions)
        count = connection.execute(text(f'SELECT count(*) FROM {table} r WHERE {predicate}')).scalar()
        if count:
            issues[table] = {'count': count, 'sample_ids': list(connection.execute(text(f'SELECT r.id FROM {table} r WHERE {predicate} ORDER BY r.id LIMIT 25')).scalars())}
    return issues


if __name__ == '__main__':
    target=make_url(settings.DATABASE_URL)
    print(json.dumps({'backend':target.get_backend_name(),'host':target.host,'database':target.database,'username':target.username}))
    engine=create_engine(target)
    try:
        with engine.connect() as connection:
            if target.get_backend_name()=='postgresql':
                connection.execute(text('SET TRANSACTION READ ONLY'))
            issues=preflight(connection)
            print(json.dumps({'ownership_issues':issues},indent=2))
        sys.exit(1 if issues else 0)
    finally:engine.dispose()
