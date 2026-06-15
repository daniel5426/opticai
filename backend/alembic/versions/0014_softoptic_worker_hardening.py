"""softoptic worker hardening

Revision ID: 0014_softoptic_worker_hardening
Revises: 0013_softoptic_migration_jobs
Create Date: 2026-06-15
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0014_softoptic_worker_hardening"
down_revision: Union[str, None] = "0013_softoptic_migration_jobs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("softoptic_migration_jobs", sa.Column("include_documents", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("softoptic_migration_jobs", sa.Column("checkpoint", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")))
    op.add_column("softoptic_migration_jobs", sa.Column("bundle_storage_bucket", sa.String(), nullable=True))
    op.add_column("softoptic_migration_jobs", sa.Column("bundle_storage_key", sa.Text(), nullable=True))
    op.add_column("softoptic_migration_jobs", sa.Column("locked_by", sa.String(), nullable=True))
    op.add_column("softoptic_migration_jobs", sa.Column("lease_until", sa.DateTime(timezone=True), nullable=True))
    op.add_column("softoptic_migration_jobs", sa.Column("heartbeat_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("softoptic_migration_jobs", sa.Column("pause_requested", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("softoptic_migration_jobs", sa.Column("attempt_count", sa.Integer(), nullable=False, server_default=sa.text("0")))
    op.add_column("softoptic_migration_jobs", sa.Column("last_error_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_softoptic_migration_jobs_locked_by", "softoptic_migration_jobs", ["locked_by"])
    op.create_index("ix_softoptic_migration_jobs_lease_until", "softoptic_migration_jobs", ["lease_until"])
    op.create_index(
        "ix_softoptic_migration_jobs_status_lease",
        "softoptic_migration_jobs",
        ["status", "lease_until"],
    )


def downgrade() -> None:
    op.drop_index("ix_softoptic_migration_jobs_status_lease", table_name="softoptic_migration_jobs")
    op.drop_index("ix_softoptic_migration_jobs_lease_until", table_name="softoptic_migration_jobs")
    op.drop_index("ix_softoptic_migration_jobs_locked_by", table_name="softoptic_migration_jobs")
    op.drop_column("softoptic_migration_jobs", "last_error_at")
    op.drop_column("softoptic_migration_jobs", "attempt_count")
    op.drop_column("softoptic_migration_jobs", "pause_requested")
    op.drop_column("softoptic_migration_jobs", "heartbeat_at")
    op.drop_column("softoptic_migration_jobs", "lease_until")
    op.drop_column("softoptic_migration_jobs", "locked_by")
    op.drop_column("softoptic_migration_jobs", "bundle_storage_key")
    op.drop_column("softoptic_migration_jobs", "bundle_storage_bucket")
    op.drop_column("softoptic_migration_jobs", "checkpoint")
    op.drop_column("softoptic_migration_jobs", "include_documents")
