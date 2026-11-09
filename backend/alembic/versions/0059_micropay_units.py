"""Separate immutable provider billing units from transport segments; durable DLR inbox."""
from alembic import op
import sqlalchemy as sa
revision = '0059_micropay_units'
down_revision = '0058_campaign_messaging'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('campaign_deliveries', sa.Column('billing_units', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('campaign_deliveries', sa.Column('billing_policy', sa.JSON(), nullable=True))
    op.execute('UPDATE campaign_deliveries SET billing_units = segments')
    op.add_column('messaging_events', sa.Column('payload', sa.JSON(), nullable=True))

def downgrade():
    op.drop_column('messaging_events', 'payload')
    op.drop_column('campaign_deliveries', 'billing_policy')
    op.drop_column('campaign_deliveries', 'billing_units')
