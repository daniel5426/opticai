"""add indexes for the default orders list page

Revision ID: 0035_order_paging_indexes
Revises: 0034_analytics_covering_indexes
Create Date: 2026-08-11
"""

from typing import Sequence, Union

from alembic import op


revision: str = "0035_order_paging_indexes"
down_revision: Union[str, None] = "0034_analytics_covering_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


INDEXES = (
    ("ix_orders_clinic_date_id_paging", "orders"),
    ("ix_contact_lens_orders_clinic_date_id_paging", "contact_lens_orders"),
)


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET statement_timeout TO 0")
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_orders_clinic_date_id_paging "
            "ON orders (clinic_id, order_date DESC NULLS LAST, id DESC)"
        )
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_contact_lens_orders_clinic_date_id_paging "
            "ON contact_lens_orders (clinic_id, order_date DESC NULLS LAST, id DESC)"
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        for name, _ in reversed(INDEXES):
            op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {name}")
