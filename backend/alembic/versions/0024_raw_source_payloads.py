"""Add raw source snapshots to migration links.

Revision ID: 0024_raw_source_payloads
Revises: 0023_auto_advance_pref
Create Date: 2026-08-03
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0024_raw_source_payloads"
down_revision: Union[str, None] = "0023_auto_advance_pref"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "migration_source_links",
        sa.Column("migration_job_id", sa.String(), nullable=True),
    )
    op.create_foreign_key(
        "fk_migration_source_links_migration_job_id",
        "migration_source_links",
        "softoptic_migration_jobs",
        ["migration_job_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_migration_source_links_migration_job_id",
        "migration_source_links",
        ["migration_job_id"],
        unique=False,
    )
    op.add_column("migration_source_links", sa.Column("raw_payload", sa.JSON(), nullable=True))
    op.add_column("migration_source_links", sa.Column("raw_payload_sha256", sa.String(), nullable=True))
    op.add_column(
        "migration_source_links",
        sa.Column("raw_captured_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("migration_source_links", "raw_captured_at")
    op.drop_column("migration_source_links", "raw_payload_sha256")
    op.drop_column("migration_source_links", "raw_payload")
    op.drop_index("ix_migration_source_links_migration_job_id", table_name="migration_source_links")
    op.drop_constraint(
        "fk_migration_source_links_migration_job_id",
        "migration_source_links",
        type_="foreignkey",
    )
    op.drop_column("migration_source_links", "migration_job_id")
