"""index prescription search rows by layout instance

Revision ID: 0031_presc_layout_index
Revises: 0030_presc_exam_index
Create Date: 2026-08-10
"""

from typing import Sequence, Union

from alembic import op


revision: str = "0031_presc_layout_index"
down_revision: Union[str, None] = "0030_presc_exam_index"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS "
            "ix_prescription_search_layout_instance_id "
            "ON prescription_search_index (layout_instance_id)"
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_prescription_search_layout_instance_id")
