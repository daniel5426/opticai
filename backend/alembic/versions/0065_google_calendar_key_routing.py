"""Route shared-database Calendar work to the API that owns the token key."""
from alembic import op
import sqlalchemy as sa
revision = '0065_google_calendar_key_routing'
down_revision = '0064_google_calendar_sync'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('google_token_key_id', sa.String(64), nullable=True))


def downgrade():
    op.drop_column('users', 'google_token_key_id')
