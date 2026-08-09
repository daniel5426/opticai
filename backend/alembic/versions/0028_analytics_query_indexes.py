"""add analytics query indexes

Revision ID: 0028_analytics_query_indexes
Revises: 0027_inventory_supply_v1
Create Date: 2026-08-09
"""

from typing import Sequence, Union

from alembic import op


revision: str = "0028_analytics_query_indexes"
down_revision: Union[str, None] = "0027_inventory_supply_v1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


INDEXES = (
    ("ix_billing_payments_paid_at_billing_id", "billing_payments", "paid_at, billing_id"),
    ("ix_clients_clinic_file_creation_date", "clients", "clinic_id, file_creation_date"),
    ("ix_work_shifts_user_date", "work_shifts", "user_id, date"),
    (
        "ix_inventory_movements_clinic_type_created",
        "inventory_movements",
        "clinic_id, movement_type, created_at",
    ),
    (
        "ix_catalog_observations_clinic_date_variant",
        "catalog_order_observations",
        "clinic_id, observed_on, variant_id",
    ),
)


def upgrade() -> None:
    with op.get_context().autocommit_block():
        for name, table, columns in INDEXES:
            op.execute(f"CREATE INDEX CONCURRENTLY IF NOT EXISTS {name} ON {table} ({columns})")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        for name, _, _ in reversed(INDEXES):
            op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {name}")
