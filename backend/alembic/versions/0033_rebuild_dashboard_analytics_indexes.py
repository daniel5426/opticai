"""repair incomplete dashboard analytics indexes

Revision ID: 0033_rebuild_analytics_indexes
Revises: 0032_dashboard_analytics_indexes
Create Date: 2026-08-11
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


revision: str = "0033_rebuild_analytics_indexes"
down_revision: Union[str, None] = "0032_dashboard_analytics_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


INDEXES = (
    ("ix_billings_order_id", "billings", "order_id"),
    ("ix_billings_contact_lens_id", "billings", "contact_lens_id"),
    ("ix_order_line_item_billings_id", "order_line_item", "billings_id"),
)


def _index_is_valid(name: str) -> bool:
    return bool(
        op.get_bind()
        .execute(
            text(
                """
                SELECT index_entry.indisvalid
                FROM pg_index AS index_entry
                JOIN pg_class AS index_class ON index_class.oid = index_entry.indexrelid
                JOIN pg_namespace AS schema ON schema.oid = index_class.relnamespace
                WHERE schema.nspname = 'public' AND index_class.relname = :name
                """
            ),
            {"name": name},
        )
        .scalar()
    )


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET statement_timeout TO 0")
        for name, table, columns in INDEXES:
            if not _index_is_valid(name):
                op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {name}")
                op.execute(f"CREATE INDEX CONCURRENTLY {name} ON {table} ({columns})")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        for name, _, _ in reversed(INDEXES):
            op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {name}")
