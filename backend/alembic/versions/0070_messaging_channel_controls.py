"""Add owner-controlled campaign channel switches per company."""
from alembic import op
import sqlalchemy as sa

revision = '0070_messaging_channel_controls'
down_revision = '0069_split_supplier_colors'
branch_labels = None
depends_on = None


def upgrade():
    for name in ('email_sending_enabled', 'sms_sending_enabled'):
        op.add_column('messaging_accounts', sa.Column(
            name, sa.Boolean(), nullable=False, server_default=sa.true()))


def downgrade():
    for name in ('sms_sending_enabled', 'email_sending_enabled'):
        op.drop_column('messaging_accounts', name)
