"""Component provenance, private saved definitions and permanent document mappings."""
from alembic import op
import sqlalchemy as sa

revision = '0045_agent_search_reports'
down_revision = '0044_agent_backend_access'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('prescription_search_index', sa.Column('component_key', sa.String(255), nullable=True))
    op.create_table('prysm_prescription_index_state', sa.Column('clinic_id', sa.Integer, sa.ForeignKey('clinics.id'), primary_key=True),
        sa.Column('ready', sa.Boolean, nullable=False, server_default=sa.false()), sa.Column('checkpoint', sa.JSON, nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False))
    op.create_table('prysm_saved_reports', sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('clinic_id', sa.Integer, sa.ForeignKey('clinics.id'), nullable=False),
        sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('patient_scope', sa.Integer, nullable=False, server_default='0'),
        sa.Column('title', sa.String(200), nullable=False), sa.Column('definition', sa.JSON, nullable=False),
        sa.Column('revision', sa.Integer, nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False), sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False))
    op.create_table('prysm_document_indexes', sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('file_id', sa.Integer, sa.ForeignKey('files.id', ondelete='CASCADE'), nullable=False),
        sa.Column('clinic_id', sa.Integer, sa.ForeignKey('clinics.id'), nullable=False),
        sa.Column('client_id', sa.Integer, sa.ForeignKey('clients.id'), nullable=False),
        sa.Column('revision', sa.String(64), nullable=False), sa.Column('status', sa.String(24), nullable=False, server_default='queued'),
        sa.Column('job_id', sa.String(36), sa.ForeignKey('prysm_agent_jobs.id')),
        sa.Column('metadata_json', sa.JSON, nullable=False), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint('file_id', 'revision', name='uq_document_index_revision'))
    for table, fields in [('prysm_saved_reports', ['clinic_id', 'user_id']), ('prysm_document_indexes', ['file_id', 'clinic_id', 'client_id']), ('prysm_prescription_index_state', [])]:
        for field in fields:
            op.create_index(f'ix_{table}_{field}', table, [field])
        if op.get_bind().dialect.name == 'postgresql':
            op.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY')
            op.execute(f'REVOKE ALL ON "{table}" FROM PUBLIC')
            for role in ('anon', 'authenticated'):
                op.execute(f"DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{role}') THEN REVOKE ALL ON \"{table}\" FROM {role}; END IF; END $$")


def downgrade():
    op.drop_table('prysm_prescription_index_state')
    op.drop_table('prysm_document_indexes')
    op.drop_table('prysm_saved_reports')
    # Earlier local drafts included this index in 0045; 0046 owns the concurrent build.
    op.drop_index('ix_prescription_component', table_name='prescription_search_index', if_exists=True)
    op.drop_column('prescription_search_index', 'component_key')
