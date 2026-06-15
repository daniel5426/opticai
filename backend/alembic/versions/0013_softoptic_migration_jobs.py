"""softoptic migration jobs

Revision ID: 0013_softoptic_migration_jobs
Revises: 0012_table_search_trgm
Create Date: 2026-06-15
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0013_softoptic_migration_jobs"
down_revision: Union[str, None] = "0012_table_search_trgm"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "softoptic_migration_jobs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("clinic_id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("step", sa.String(), nullable=False),
        sa.Column("progress", sa.Integer(), nullable=False),
        sa.Column("source_metadata", sa.JSON(), nullable=False),
        sa.Column("export_summary", sa.JSON(), nullable=False),
        sa.Column("validation_summary", sa.JSON(), nullable=False),
        sa.Column("import_summary", sa.JSON(), nullable=False),
        sa.Column("warnings", sa.JSON(), nullable=False),
        sa.Column("errors", sa.JSON(), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("bundle_path", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"]),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_softoptic_migration_jobs_clinic_id", "softoptic_migration_jobs", ["clinic_id"])
    op.create_index("ix_softoptic_migration_jobs_company_id", "softoptic_migration_jobs", ["company_id"])
    op.create_index("ix_softoptic_migration_jobs_status", "softoptic_migration_jobs", ["status"])
    op.create_index("ix_softoptic_migration_jobs_user_id", "softoptic_migration_jobs", ["user_id"])
    op.create_index(
        "ix_softoptic_migration_jobs_clinic_created",
        "softoptic_migration_jobs",
        ["clinic_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_softoptic_migration_jobs_clinic_created", table_name="softoptic_migration_jobs")
    op.drop_index("ix_softoptic_migration_jobs_user_id", table_name="softoptic_migration_jobs")
    op.drop_index("ix_softoptic_migration_jobs_status", table_name="softoptic_migration_jobs")
    op.drop_index("ix_softoptic_migration_jobs_company_id", table_name="softoptic_migration_jobs")
    op.drop_index("ix_softoptic_migration_jobs_clinic_id", table_name="softoptic_migration_jobs")
    op.drop_table("softoptic_migration_jobs")
