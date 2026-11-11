"""Track opt-in Google Calendar rescheduling and observed event versions."""
from alembic import op
import sqlalchemy as sa

revision = '0068_calendar_pull'
down_revision = '0067_merge_layout_color'
branch_labels = None
depends_on = None


def upgrade():
    # Acquire the three short DDL locks together before changing any table. A
    # busy API transaction should fail this attempt instead of waiting on DDL.
    op.execute('LOCK TABLE users, clinics, google_calendar_sync IN ACCESS EXCLUSIVE MODE NOWAIT')
    op.add_column('clinics', sa.Column('google_calendar_revision', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('google_calendar_pull_at', sa.DateTime(timezone=True)))
    op.add_column('users', sa.Column('google_calendar_pull_since', sa.DateTime(timezone=True)))
    op.add_column('users', sa.Column('google_calendar_pull_error', sa.String()))
    op.add_column('google_calendar_sync', sa.Column('remote_etag', sa.Text()))
    op.create_index('ix_google_calendar_user_status', 'google_calendar_sync', ['user_id', 'status'])


def downgrade():
    op.drop_index('ix_google_calendar_user_status', table_name='google_calendar_sync')
    op.drop_column('google_calendar_sync', 'remote_etag')
    op.drop_column('users', 'google_calendar_pull_error')
    op.drop_column('users', 'google_calendar_pull_since')
    op.drop_column('users', 'google_calendar_pull_at')
    op.drop_column('clinics', 'google_calendar_revision')
