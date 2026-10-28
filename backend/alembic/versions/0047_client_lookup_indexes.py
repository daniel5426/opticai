"""index client/clinic lookups on exams, medical logs and campaigns; refresh planner stats

Exams (about 1M rows) and medical logs had no index on client_id, and medical logs none on
clinic_id, so opening a client file or searching scanned whole tables (exams by client:
~640 ms; medical-log search in a clinic without logs: ~1.9 s). Planner statistics for
deleted_at were missing, which made global search pick nested loops until it timed out.

Revision ID: 0047_client_lookup_indexes
Revises: 0046_prescription_components
Create Date: 2026-10-26
"""

from typing import Sequence, Union

from alembic import op


revision: str = "0047_client_lookup_indexes"
down_revision: Union[str, None] = "0046_prescription_components"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


INDEXES = (
    ("ix_optical_exams_client_id", "optical_exams", "client_id"),
    ("ix_medical_logs_client_id", "medical_logs", "client_id"),
    ("ix_medical_logs_clinic_id", "medical_logs", "clinic_id"),
    ("ix_campaigns_clinic_id", "campaigns", "clinic_id"),
)

ANALYZED_TABLES = ("clients", "optical_exams", "medical_logs", "appointments", "referrals")


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET statement_timeout TO 0")
        for name, table, column in INDEXES:
            op.execute(f"CREATE INDEX CONCURRENTLY IF NOT EXISTS {name} ON {table} ({column})")
        # Read-only statistics refresh; it takes no locks that block reads or writes.
        op.execute(f"ANALYZE {', '.join(ANALYZED_TABLES)}")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        for name, _, _ in reversed(INDEXES):
            op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {name}")
