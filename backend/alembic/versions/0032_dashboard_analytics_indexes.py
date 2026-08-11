"""add dashboard analytics join indexes

Revision ID: 0032_dashboard_analytics_indexes
Revises: 0031_presc_layout_index
Create Date: 2026-08-11
"""

from typing import Sequence, Union

from alembic import op


revision: str = "0032_dashboard_analytics_indexes"
down_revision: Union[str, None] = "0031_presc_layout_index"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


INDEXES = (
    ("ix_billings_order_id", "billings", "order_id"),
    ("ix_billings_contact_lens_id", "billings", "contact_lens_id"),
    ("ix_order_line_item_billings_id", "order_line_item", "billings_id"),
)


def upgrade() -> None:
    with op.get_context().autocommit_block():
        # The staging pooler sets a 30-second statement timeout; index builds
        # must be allowed to finish while remaining non-blocking to writers.
        op.execute("SET statement_timeout TO 0")
        for name, table, columns in INDEXES:
            op.execute(f"CREATE INDEX CONCURRENTLY IF NOT EXISTS {name} ON {table} ({columns})")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        for name, table, _ in reversed(INDEXES):
            op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {name}")
