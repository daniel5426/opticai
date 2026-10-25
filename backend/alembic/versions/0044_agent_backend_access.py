"""Keep app-owned agent records behind the authenticated clinic backend."""
from alembic import op

revision = '0044_agent_backend_access'
down_revision = '0043_agent_principal_binding'
branch_labels = None
depends_on = None

TABLES = ('prysm_agent_contexts', 'prysm_agent_changes', 'prysm_followup_tasks',
          'prysm_followup_events', 'prysm_agent_jobs', 'prysm_insight_cache')


def upgrade():
    if op.get_bind().dialect.name != 'postgresql':
        return
    for table in TABLES:
        op.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY')
        op.execute(f'REVOKE ALL ON "{table}" FROM PUBLIC')
        for role in ('anon', 'authenticated'):
            op.execute(f"DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{role}') "
                       f'THEN REVOKE ALL ON "{table}" FROM {role}; END IF; END $$')


def downgrade():
    # Rolling back an application version must not expose private agent records.
    pass
