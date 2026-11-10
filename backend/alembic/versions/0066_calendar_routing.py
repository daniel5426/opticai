"""Add opt-in clinic destinations and owner subscriptions, preserving primary defaults."""
from alembic import op
import sqlalchemy as sa
revision = '0066_calendar_routing'
down_revision = '0065_google_calendar_key_routing'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('google_calendar_routes', sa.JSON(), nullable=True))
    op.add_column('google_calendar_sync', sa.Column('calendar_id', sa.Text(), nullable=False, server_default='primary'))
    op.add_column('google_calendar_sync', sa.Column('retired_events', sa.JSON(), nullable=True))


def downgrade():
    op.drop_column('google_calendar_sync', 'retired_events')
    op.drop_column('google_calendar_sync', 'calendar_id')
    op.drop_column('users', 'google_calendar_routes')
