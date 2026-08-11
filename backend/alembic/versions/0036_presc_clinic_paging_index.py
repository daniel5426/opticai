"""index prescription rebuild batches by clinic

Revision ID: 0036_presc_clinic_index
Revises: 0035_order_paging_indexes
Create Date: 2026-08-11
"""

from typing import Sequence, Union

from alembic import op


revision: str = "0036_presc_clinic_index"
down_revision: Union[str, None] = "0035_order_paging_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET statement_timeout TO 0")
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS "
            "ix_prescription_search_clinic_id "
            "ON prescription_search_index (clinic_id, id)"
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(
            "DROP INDEX CONCURRENTLY IF EXISTS ix_prescription_search_clinic_id"
        )
