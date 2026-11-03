"""Durable report callback retry state on existing jobs.

Revision ID: 0050_agent_report_completion
Revises: 0049_company_client_records
"""
from alembic import op
import sqlalchemy as sa
revision='0050_agent_report_completion'
down_revision='0049_company_client_records'
branch_labels=None
depends_on=None
def upgrade():
    op.add_column('prysm_agent_jobs',sa.Column('platform_callbacks',sa.JSON(),nullable=True))
    op.add_column('prysm_agent_jobs',sa.Column('completion_retry_at',sa.DateTime(timezone=True),nullable=True))
    op.create_index('ix_prysm_agent_jobs_completion_retry','prysm_agent_jobs',['completion_retry_at'],postgresql_where=sa.text('completion_retry_at IS NOT NULL'))
def downgrade():
    op.drop_index('ix_prysm_agent_jobs_completion_retry',table_name='prysm_agent_jobs')
    op.drop_column('prysm_agent_jobs','completion_retry_at')
    op.drop_column('prysm_agent_jobs','platform_callbacks')
