"""Add app-owned Agents24 tables without changing existing clinic records."""
from alembic import op
import sqlalchemy as sa
revision = '0042_prysm_agents24'
down_revision = '0041_shared_order_groups'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('prysm_agent_contexts',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('session_id', sa.String(36), sa.ForeignKey('auth_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('company_id', sa.Integer, sa.ForeignKey('companies.id'), nullable=False),
        sa.Column('clinic_id', sa.Integer, sa.ForeignKey('clinics.id'), nullable=False),
        sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('patient_scope', sa.Integer, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('session_id', 'clinic_id', 'patient_scope', name='uq_agent_context_scope'),
    )
    op.create_table('prysm_agent_changes',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('context_id', sa.String(36), sa.ForeignKey('prysm_agent_contexts.id'), nullable=False),
        sa.Column('kind', sa.String(40), nullable=False),
        sa.Column('action', sa.String(20), nullable=False),
        sa.Column('payload', sa.JSON, nullable=False),
        sa.Column('expected', sa.JSON, nullable=False),
        sa.Column('result', sa.JSON),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table('prysm_followup_tasks',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('clinic_id', sa.Integer, sa.ForeignKey('clinics.id'), nullable=False),
        sa.Column('client_id', sa.Integer, sa.ForeignKey('clients.id')),
        sa.Column('assigned_user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_by_user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('title', sa.String(300), nullable=False),
        sa.Column('notes', sa.String),
        sa.Column('due_date', sa.Date, nullable=False),
        sa.Column('source', sa.JSON, nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('revision', sa.Integer, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_prysm_followup_tasks_clinic_id", "prysm_followup_tasks", ["clinic_id"])
    op.create_index("ix_prysm_followup_tasks_due_date", "prysm_followup_tasks", ["due_date"])
    op.create_table('prysm_followup_events',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('task_id', sa.String(36), sa.ForeignKey('prysm_followup_tasks.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('change', sa.JSON, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table('prysm_agent_jobs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('unique_key', sa.String(200), unique=True, nullable=False),
        sa.Column('company_id', sa.Integer, sa.ForeignKey('companies.id'), nullable=False),
        sa.Column('clinic_id', sa.Integer, sa.ForeignKey('clinics.id'), nullable=False),
        sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id')),
        sa.Column('context_id', sa.String(36), sa.ForeignKey('prysm_agent_contexts.id')),
        sa.Column('kind', sa.String(30), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('locale', sa.String(2), nullable=False),
        sa.Column('business_date', sa.Date),
        sa.Column('definition', sa.JSON, nullable=False),
        sa.Column('result', sa.JSON),
        sa.Column('run_id', sa.String(36)),
        sa.Column('thread_id', sa.String(36)),
        sa.Column('worker', sa.String(100)),
        sa.Column('lease_until', sa.DateTime(timezone=True)),
        sa.Column('file_name', sa.String(200)),
        sa.Column('expires_at', sa.DateTime(timezone=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_prysm_agent_jobs_clinic_id", "prysm_agent_jobs", ["clinic_id"])
    op.create_index("ix_prysm_agent_jobs_kind", "prysm_agent_jobs", ["kind"])
    op.create_index("ix_prysm_agent_jobs_status", "prysm_agent_jobs", ["status"])
    op.create_table('prysm_insight_cache',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('client_id', sa.Integer, sa.ForeignKey('clients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('locale', sa.String(2), nullable=False),
        sa.Column('fingerprint', sa.String(64), nullable=False),
        sa.Column('sections', sa.JSON, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('client_id', 'locale', name='uq_insight_client_locale'),
    )

def downgrade():
    op.drop_table('prysm_insight_cache')
    op.drop_table('prysm_agent_jobs')
    op.drop_table('prysm_followup_events')
    op.drop_table('prysm_followup_tasks')
    op.drop_table('prysm_agent_changes')
    op.drop_table('prysm_agent_contexts')
