"""appointment exam layout id

Revision ID: 0015_appointment_exam_layout_id
Revises: 0014_softoptic_worker_hardening
Create Date: 2026-06-15
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0015_appointment_exam_layout_id"
down_revision: Union[str, None] = "0014_softoptic_worker_hardening"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("appointments", sa.Column("exam_layout_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_appointments_exam_layout_id_exam_layouts",
        "appointments",
        "exam_layouts",
        ["exam_layout_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_appointments_exam_layout_id_exam_layouts", "appointments", type_="foreignkey")
    op.drop_column("appointments", "exam_layout_id")
