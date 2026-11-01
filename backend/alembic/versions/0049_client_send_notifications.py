"""add clients.send_notifications, the per-client opt-in for notifications

Defaults to false for existing and new clients; SoftOptic imports fill it from
account.send_sms_email.

Revision ID: 0049_client_send_notifications
Revises: 0048_order_group_clinic_date_index
Create Date: 2026-10-31
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0049_client_send_notifications"
down_revision: Union[str, None] = "0048_order_group_clinic_date_index"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # A constant default makes this a metadata-only change on Postgres 11+, with no table rewrite.
    op.add_column(
        "clients",
        sa.Column("send_notifications", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("clients", "send_notifications")
