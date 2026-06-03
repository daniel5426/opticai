"""table search trigram indexes

Revision ID: 0012_table_search_trgm
Revises: 0011_billing_payments
Create Date: 2026-06-03
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0012_table_search_trgm"
down_revision: Union[str, None] = "0011_billing_payments"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _blob_expression(*columns: str) -> str:
    return " || ' ' || ".join(f"coalesce(CAST({column} AS varchar), '')" for column in columns)


INDEXES = {
    "ix_clients_table_search_trgm": (
        "clients",
        f"lower({_blob_expression('first_name', 'last_name', 'national_id', 'phone_mobile', 'email')}) gin_trgm_ops",
    ),
    "ix_families_table_search_trgm": (
        "families",
        f"lower({_blob_expression('name')}) gin_trgm_ops",
    ),
    "ix_users_table_search_trgm": (
        "users",
        f"lower({_blob_expression('full_name', 'username', 'email', 'phone')}) gin_trgm_ops",
    ),
    "ix_orders_table_search_trgm": (
        "orders",
        f"lower({_blob_expression('type')}) gin_trgm_ops",
    ),
    "ix_contact_lens_orders_table_search_trgm": (
        "contact_lens_orders",
        f"lower({_blob_expression('type')}) gin_trgm_ops",
    ),
    "ix_optical_exams_table_search_trgm": (
        "optical_exams",
        f"lower({_blob_expression('test_name', 'clinic')}) gin_trgm_ops",
    ),
    "ix_appointments_table_search_trgm": (
        "appointments",
        f"lower({_blob_expression('time', 'exam_name', 'note')}) gin_trgm_ops",
    ),
    "ix_files_table_search_trgm": (
        "files",
        f"lower({_blob_expression('file_name', 'original_file_name', 'file_type', 'notes')}) gin_trgm_ops",
    ),
    "ix_referrals_table_search_trgm": (
        "referrals",
        f"lower({_blob_expression('type', 'recipient', 'urgency_level')}) gin_trgm_ops",
    ),
}


def upgrade() -> None:
    op.execute(sa.text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
    with op.get_context().autocommit_block():
        for index_name, (table_name, expression) in INDEXES.items():
            op.execute(
                sa.text(
                    f"CREATE INDEX CONCURRENTLY IF NOT EXISTS {index_name} "
                    f"ON {table_name} USING gin ({expression})"
                )
            )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        for index_name in reversed(INDEXES):
            op.execute(sa.text(f"DROP INDEX CONCURRENTLY IF EXISTS {index_name}"))
