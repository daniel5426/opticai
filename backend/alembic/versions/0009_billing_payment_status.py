"""billing payment status

Revision ID: 0009_billing_payment_status
Revises: 0008_clinic_scoped_lookups
Create Date: 2026-05-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0009_billing_payment_status"
down_revision: Union[str, None] = "0008_clinic_scoped_lookups"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("billings")}
    if "payment_status" not in columns:
        op.add_column("billings", sa.Column("payment_status", sa.String(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("billings")}
    if "payment_status" in columns:
        op.drop_column("billings", "payment_status")
