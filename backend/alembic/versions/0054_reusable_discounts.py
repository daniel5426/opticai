"""Reusable clinic discounts and preservation of existing invoice context.

Revision ID: 0054_reusable_discounts
Revises: 0053_client_send_notifications
"""
from alembic import op
import sqlalchemy as sa

revision = "0054_reusable_discounts"
down_revision = "0053_client_send_notifications"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "discount_definitions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("clinic_id", sa.Integer(), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("description", sa.String(200), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.CheckConstraint("amount > 0", name="ck_discount_definitions_amount"),
    )
    op.create_index("ix_discount_definitions_clinic_id", "discount_definitions", ["clinic_id"])
    op.add_column("billings", sa.Column("line_subtotal_offset", sa.Float(), nullable=True))
    op.add_column("billings", sa.Column("line_total_offset", sa.Float(), nullable=True))


def downgrade():
    op.drop_column("billings", "line_total_offset")
    op.drop_column("billings", "line_subtotal_offset")
    op.drop_table("discount_definitions")
