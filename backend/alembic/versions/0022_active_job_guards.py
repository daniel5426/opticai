"""enforce one active migration and prune per clinic

Revision ID: 0022_active_job_guards
Revises: 0021_unified_migration_prune
Create Date: 2026-07-29
"""

from typing import Sequence, Union

from alembic import op


revision: str = "0022_active_job_guards"
down_revision: Union[str, None] = "0021_unified_migration_prune"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute(
            """
            CREATE UNIQUE INDEX uq_migration_jobs_one_active_per_clinic
            ON softoptic_migration_jobs (clinic_id)
            WHERE status IN ('awaiting_upload', 'queued', 'running', 'paused')
            """
        )
        op.execute(
            """
            CREATE UNIQUE INDEX uq_prune_jobs_one_active_per_clinic
            ON clinic_data_prune_jobs (clinic_id)
            WHERE status IN ('queued', 'running')
            """
        )


def downgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute("DROP INDEX IF EXISTS uq_prune_jobs_one_active_per_clinic")
        op.execute("DROP INDEX IF EXISTS uq_migration_jobs_one_active_per_clinic")

