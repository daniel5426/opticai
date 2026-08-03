"""add clinic holiday overrides

Revision ID: 0026_clinic_holiday_overrides
Revises: 0025_client_additional_phone
Create Date: 2026-08-04
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0026_clinic_holiday_overrides"
down_revision: Union[str, None] = "0025_client_additional_phone"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "clinic_holiday_overrides",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("clinic_id", sa.Integer(), nullable=False),
        sa.Column("holiday_date", sa.Date(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("clinic_id", "holiday_date", name="uq_clinic_holiday_overrides_clinic_date"),
    )
    op.create_index("ix_clinic_holiday_overrides_clinic_id", "clinic_holiday_overrides", ["clinic_id"])
    op.create_index("ix_clinic_holiday_overrides_holiday_date", "clinic_holiday_overrides", ["holiday_date"])

    if op.get_bind().dialect.name == "postgresql":
        op.execute('ALTER TABLE public.clinic_holiday_overrides ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    op.drop_table("clinic_holiday_overrides")
