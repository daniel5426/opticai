"""Freeze messaging checkout integration identity and preserve legacy funding records."""
from alembic import op
import sqlalchemy as sa
revision = '0062_messaging_checkout'
down_revision = '0061_campaign_allowances'
branch_labels = None
depends_on = None


def upgrade():
    # NULL identifies pre-existing orders, which retain subscription integration credentials.
    op.add_column('messaging_topups', sa.Column('provider_login', sa.String(100), nullable=True))
    op.add_column('messaging_topups', sa.Column('checkout_mode', sa.String(20), nullable=False, server_default='hosted_fields'))


def downgrade():
    op.drop_column('messaging_topups', 'checkout_mode')
    op.drop_column('messaging_topups', 'provider_login')
