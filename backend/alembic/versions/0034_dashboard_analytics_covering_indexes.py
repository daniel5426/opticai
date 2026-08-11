"""add dashboard analytics covering indexes

Revision ID: 0034_analytics_covering_indexes
Revises: 0033_rebuild_analytics_indexes
Create Date: 2026-08-11
"""

from typing import Sequence, Union

from alembic import op


revision: str = "0034_analytics_covering_indexes"
down_revision: Union[str, None] = "0033_rebuild_analytics_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


INDEXES = (
    (
        "ix_orders_clinic_date_analytics",
        "orders",
        "clinic_id, order_date",
        "id, type",
    ),
    (
        "ix_contact_lens_orders_clinic_date_analytics",
        "contact_lens_orders",
        "clinic_id, order_date",
        "id, type",
    ),
)


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET statement_timeout TO 0")
        for name, table, columns, included_columns in INDEXES:
            op.execute(
                f"CREATE INDEX CONCURRENTLY IF NOT EXISTS {name} "
                f"ON {table} ({columns}) INCLUDE ({included_columns})"
            )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        for name, _, _, _ in reversed(INDEXES):
            op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {name}")
