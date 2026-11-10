"""Durable Calendar mappings/retries and nullable OAuth token provenance.

Existing encrypted tokens and appointment event IDs are preserved. Legacy
mappings are adopted lazily on the first appointment mutation or manual sync.
"""
from alembic import op
import sqlalchemy as sa

revision = '0064_google_calendar_sync'
down_revision = '0063_merge_layout_duration'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('google_oauth_client_type', sa.String(), nullable=True))
    op.add_column('users', sa.Column('google_token_expiry', sa.DateTime(timezone=True), nullable=True))
    op.create_table('google_calendar_sync',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('appointment_id', sa.Integer(), sa.ForeignKey('appointments.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('account_email', sa.String(), nullable=True),
        sa.Column('event_id', sa.String(), nullable=False),
        sa.Column('generation', sa.Integer(), nullable=False),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=False),
        sa.Column('available_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('error_code', sa.String(), nullable=True),
        sa.Column('synced_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('appointment_id', 'user_id', name='uq_google_calendar_owner'))
    op.create_index('ix_google_calendar_pending', 'google_calendar_sync', ['status', 'available_at'])
    op.execute('ALTER TABLE google_calendar_sync ENABLE ROW LEVEL SECURITY')


def downgrade():
    op.drop_table('google_calendar_sync')
    op.drop_column('users', 'google_token_expiry')
    op.drop_column('users', 'google_oauth_client_type')
