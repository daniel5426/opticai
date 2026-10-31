"""index order groups by clinic and opened date for the company dashboard

The manager dashboard's invoice ledger filters order groups (about 780k rows) by clinic and date,
but only a single-column clinic index existed, so Postgres started from the clients table
(~13k clients per clinic) and probed order groups one client at a time: ~370 ms per ledger
query, four ledger queries per dashboard request. Orders and contact-lens orders already have
a (clinic, date) index; order groups now get the same.

Revision ID: 0048_order_group_clinic_date_index
Revises: 0047_client_lookup_indexes
Create Date: 2026-10-28
"""

from typing import Sequence, Union

from alembic import op


revision: str = "0048_order_group_clinic_date_index"
down_revision: Union[str, None] = "0047_client_lookup_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET statement_timeout TO 0")
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_order_groups_clinic_opened "
            "ON order_groups (clinic_id, opened_date) WHERE deleted_at IS NULL"
        )
        op.execute("ANALYZE order_groups")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_order_groups_clinic_opened")
