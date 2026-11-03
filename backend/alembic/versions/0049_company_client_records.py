"""Company-owned client activity, preserving clinic attribution and legacy writers.

Revision ID: 0049_company_client_records
Revises: 0048_trial_requests
"""
from alembic import op
import sqlalchemy as sa

revision = '0049_company_client_records'
down_revision = '0048_trial_requests'
branch_labels = None
depends_on = None

ROOTS = ('optical_exams', 'medical_logs', 'referrals', 'appointments', 'files',
         'orders', 'contact_lens_orders', 'order_groups', 'prysm_followup_tasks')


def upgrade():
    bind = op.get_bind()
    # Authorization reads the parent tables before activity. Acquire locks in
    # that same order, before backfill locks, so concurrent requests cannot hold
    # a parent lock while waiting for our activity-table DDL.
    op.execute('LOCK TABLE clinics, clients, families, ' + ', '.join(ROOTS) + ' IN ACCESS EXCLUSIVE MODE')
    # Add first, validate existing history (including Trash), then enforce. Alembic's
    # transaction rolls everything back if any unresolved ownership is encountered.
    for table in ROOTS:
        op.add_column(table, sa.Column('company_id', sa.Integer(), nullable=True))
        anchor = 'payer_client_id' if table == 'order_groups' else 'client_id'
        op.execute(sa.text(f'UPDATE {table} r SET company_id = COALESCE((SELECT company_id FROM clinics WHERE id = r.clinic_id), (SELECT company_id FROM clients WHERE id = r.{anchor}))'))
    op.execute('UPDATE families f SET company_id = (SELECT company_id FROM clinics WHERE id = f.clinic_id) WHERE company_id IS NULL')
    problems = {}
    for table in ('clients', 'families', *ROOTS):
        anchor = 'payer_client_id' if table == 'order_groups' else ('client_id' if table in ROOTS else None)
        predicate = 'r.company_id IS NULL OR (r.clinic_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM clinics c WHERE c.id=r.clinic_id AND c.company_id=r.company_id))'
        if anchor:
            predicate += f' OR (r.{anchor} IS NOT NULL AND NOT EXISTS (SELECT 1 FROM clients c WHERE c.id=r.{anchor} AND c.company_id=r.company_id))'
        if table == 'clients':
            predicate += ' OR (r.merged_into_client_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM clients m WHERE m.id=r.merged_into_client_id AND m.company_id=r.company_id))'
            predicate += ' OR (r.family_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM families f WHERE f.id=r.family_id AND f.company_id=r.company_id))'
        ids = list(bind.execute(sa.text(f'SELECT r.id FROM {table} r WHERE {predicate} ORDER BY r.id LIMIT 25')).scalars())
        if ids:
            problems[table] = ids
    child_checks = {
        'order_group_entries': "SELECT x.id FROM order_group_entries x JOIN order_groups g ON g.id=x.group_id LEFT JOIN orders o ON o.id=x.order_id LEFT JOIN contact_lens_orders c ON c.id=x.contact_lens_id WHERE (o.id IS NOT NULL AND (o.company_id<>g.company_id OR o.clinic_id IS DISTINCT FROM g.clinic_id)) OR (c.id IS NOT NULL AND (c.company_id<>g.company_id OR c.clinic_id IS DISTINCT FROM g.clinic_id))",
        'exam_layout_instances': "SELECT x.id FROM exam_layout_instances x JOIN optical_exams e ON e.id=x.exam_id JOIN exam_layouts l ON l.id=x.layout_id JOIN clinics c ON c.id=l.clinic_id WHERE e.company_id<>c.company_id",
    }
    for table, query in child_checks.items():
        ids = list(bind.execute(sa.text(query + ' ORDER BY x.id LIMIT 25')).scalars())
        if ids:
            problems[table] = ids
    if problems:
        raise RuntimeError(f'Company ownership preflight failed; resolve these record IDs before retrying: {problems}')
    for table in ('clinics', 'clients', 'families'):
        op.create_unique_constraint(f'uq_{table}_company_id_id', table, ['company_id', 'id'])
    for table in ('families', *ROOTS):
        op.alter_column(table, 'company_id', existing_type=sa.Integer(), nullable=False)
    for table in ('clients', 'families', *ROOTS):
        if table in ROOTS:
            op.create_foreign_key(f'fk_{table}_company', table, 'companies', ['company_id'], ['id'])
            op.create_index(f'ix_{table}_company_id', table, ['company_id'])
        op.create_foreign_key(f'fk_{table}_company_clinic', table, 'clinics', ['company_id', 'clinic_id'], ['company_id', 'id'])
        if table != 'families':  # Already owned by the existing family-directory migration.
            op.create_index(f'ix_{table}_company_clinic_id', table, ['company_id', 'clinic_id', 'id'])
        if table in ROOTS:
            anchor = 'payer_client_id' if table == 'order_groups' else 'client_id'
            op.create_foreign_key(f'fk_{table}_company_client', table, 'clients', ['company_id', anchor], ['company_id', 'id'])
            op.create_index(f'ix_{table}_company_client_clinic', table, ['company_id', anchor, 'clinic_id'])
    op.create_foreign_key('fk_clients_company_merge', 'clients', 'clients', ['company_id', 'merged_into_client_id'], ['company_id', 'id'])
    op.create_foreign_key('fk_clients_company_family', 'clients', 'families', ['company_id', 'family_id'], ['company_id', 'id'])
    # Compatibility for older workers/desktop API writers during rolling delivery.
    # This is migration-owned DDL, never a startup-time schema guard.
    op.execute('''CREATE FUNCTION fill_client_record_company() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.company_id IS NULL THEN
        SELECT company_id INTO NEW.company_id FROM clinics WHERE id=NEW.clinic_id;
      END IF;
      RETURN NEW;
    END $$''')
    for table in ROOTS:
        op.execute(f'CREATE TRIGGER fill_company BEFORE INSERT ON {table} FOR EACH ROW EXECUTE FUNCTION fill_client_record_company()')


def downgrade():
    raise RuntimeError('Company-wide history cannot safely be downgraded to clinic-only ownership. Use a compatible forward repair.')
