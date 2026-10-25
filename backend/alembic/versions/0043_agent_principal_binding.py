"""Separate durable staff conversations from expiring authentication sessions."""
from alembic import op
import sqlalchemy as sa

revision = '0043_agent_principal_binding'
down_revision = '0042_prysm_agents24'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('prysm_agent_contexts', sa.Column('platform_principal_ref', sa.String(255), nullable=True))
    op.create_index('ix_prysm_agent_contexts_platform_principal_ref', 'prysm_agent_contexts', ['platform_principal_ref'])


def downgrade():
    op.drop_index('ix_prysm_agent_contexts_platform_principal_ref', table_name='prysm_agent_contexts')
    op.drop_column('prysm_agent_contexts', 'platform_principal_ref')
