"""billing payments

Revision ID: 0011_billing_payments
Revises: 0010_drop_billing_payment_status
Create Date: 2026-05-24
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0011_billing_payments"
down_revision: Union[str, None] = "0010_drop_billing_payment_status"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "billing_payments" not in inspector.get_table_names():
        op.create_table(
            "billing_payments",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("billing_id", sa.Integer(), nullable=False),
            sa.Column("amount", sa.Float(), nullable=False),
            sa.Column("paid_at", sa.Date(), nullable=False),
            sa.Column("kind", sa.String(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
            sa.ForeignKeyConstraint(["billing_id"], ["billings.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    inspector = sa.inspect(bind)
    indexes = {index["name"] for index in inspector.get_indexes("billing_payments")}
    if "ix_billing_payments_id" not in indexes:
        op.create_index(op.f("ix_billing_payments_id"), "billing_payments", ["id"], unique=False)
    if "ix_billing_payments_billing_id" not in indexes:
        op.create_index(
            op.f("ix_billing_payments_billing_id"),
            "billing_payments",
            ["billing_id"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "billing_payments" in inspector.get_table_names():
        indexes = {index["name"] for index in inspector.get_indexes("billing_payments")}
        if "ix_billing_payments_billing_id" in indexes:
            op.drop_index(op.f("ix_billing_payments_billing_id"), table_name="billing_payments")
        if "ix_billing_payments_id" in indexes:
            op.drop_index(op.f("ix_billing_payments_id"), table_name="billing_payments")
        op.drop_table("billing_payments")
