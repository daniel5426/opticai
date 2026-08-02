"""unified migration metadata and clinic data prune jobs

Revision ID: 0021_unified_migration_prune
Revises: 0020_delete_cascade_compat
Create Date: 2026-07-29
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0021_unified_migration_prune"
down_revision: Union[str, None] = "0020_delete_cascade_compat"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "softoptic_migration_jobs",
        sa.Column("source_system", sa.String(), nullable=False, server_default="softoptic"),
    )
    op.add_column("softoptic_migration_jobs", sa.Column("bundle_format_version", sa.Integer(), nullable=True))
    op.add_column("softoptic_migration_jobs", sa.Column("source_fingerprint", sa.String(), nullable=True))
    op.create_index("ix_softoptic_migration_jobs_source_system", "softoptic_migration_jobs", ["source_system"])
    op.create_index("ix_softoptic_migration_jobs_source_fingerprint", "softoptic_migration_jobs", ["source_fingerprint"])
    op.create_index(
        "ix_softoptic_migration_jobs_source_status",
        "softoptic_migration_jobs",
        ["source_system", "status"],
    )

    op.add_column(
        "clinics",
        sa.Column("maintenance_mode", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column("clinics", sa.Column("maintenance_reason", sa.String(), nullable=True))
    op.add_column("clinics", sa.Column("maintenance_job_id", sa.String(), nullable=True))
    op.add_column("clinics", sa.Column("maintenance_started_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "clinic_data_prune_jobs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("clinic_id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("requested_by_user_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("step", sa.String(), nullable=False),
        sa.Column("progress", sa.Integer(), nullable=False),
        sa.Column("checkpoint", sa.JSON(), nullable=False),
        sa.Column("preview_counts", sa.JSON(), nullable=False),
        sa.Column("deleted_counts", sa.JSON(), nullable=False),
        sa.Column("warnings", sa.JSON(), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("locked_by", sa.String(), nullable=True),
        sa.Column("lease_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("heartbeat_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("attempt_count", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"]),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["requested_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_clinic_data_prune_jobs_clinic_id", "clinic_data_prune_jobs", ["clinic_id"])
    op.create_index("ix_clinic_data_prune_jobs_company_id", "clinic_data_prune_jobs", ["company_id"])
    op.create_index("ix_clinic_data_prune_jobs_requested_by_user_id", "clinic_data_prune_jobs", ["requested_by_user_id"])
    op.create_index("ix_clinic_data_prune_jobs_status", "clinic_data_prune_jobs", ["status"])
    op.create_index("ix_clinic_data_prune_jobs_locked_by", "clinic_data_prune_jobs", ["locked_by"])
    op.create_index("ix_clinic_data_prune_jobs_lease_until", "clinic_data_prune_jobs", ["lease_until"])
    op.create_index(
        "ix_clinic_data_prune_jobs_clinic_created",
        "clinic_data_prune_jobs",
        ["clinic_id", "created_at"],
    )

    op.create_table(
        "clinic_data_prune_storage_objects",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("job_id", sa.String(), nullable=False),
        sa.Column("bucket", sa.String(), nullable=False),
        sa.Column("storage_key", sa.Text(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("attempt_count", sa.Integer(), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.ForeignKeyConstraint(["job_id"], ["clinic_data_prune_jobs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("job_id", "bucket", "storage_key", name="uq_prune_storage_job_object"),
    )
    op.create_index("ix_clinic_data_prune_storage_objects_job_id", "clinic_data_prune_storage_objects", ["job_id"])
    op.create_index("ix_clinic_data_prune_storage_objects_status", "clinic_data_prune_storage_objects", ["status"])

    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TABLE public.clinic_data_prune_jobs ENABLE ROW LEVEL SECURITY")
        op.execute("ALTER TABLE public.clinic_data_prune_storage_objects ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_index("ix_clinic_data_prune_storage_objects_status", table_name="clinic_data_prune_storage_objects")
    op.drop_index("ix_clinic_data_prune_storage_objects_job_id", table_name="clinic_data_prune_storage_objects")
    op.drop_table("clinic_data_prune_storage_objects")
    op.drop_index("ix_clinic_data_prune_jobs_clinic_created", table_name="clinic_data_prune_jobs")
    op.drop_index("ix_clinic_data_prune_jobs_lease_until", table_name="clinic_data_prune_jobs")
    op.drop_index("ix_clinic_data_prune_jobs_locked_by", table_name="clinic_data_prune_jobs")
    op.drop_index("ix_clinic_data_prune_jobs_status", table_name="clinic_data_prune_jobs")
    op.drop_index("ix_clinic_data_prune_jobs_requested_by_user_id", table_name="clinic_data_prune_jobs")
    op.drop_index("ix_clinic_data_prune_jobs_company_id", table_name="clinic_data_prune_jobs")
    op.drop_index("ix_clinic_data_prune_jobs_clinic_id", table_name="clinic_data_prune_jobs")
    op.drop_table("clinic_data_prune_jobs")

    op.drop_column("clinics", "maintenance_started_at")
    op.drop_column("clinics", "maintenance_job_id")
    op.drop_column("clinics", "maintenance_reason")
    op.drop_column("clinics", "maintenance_mode")

    op.drop_index("ix_softoptic_migration_jobs_source_status", table_name="softoptic_migration_jobs")
    op.drop_index("ix_softoptic_migration_jobs_source_fingerprint", table_name="softoptic_migration_jobs")
    op.drop_index("ix_softoptic_migration_jobs_source_system", table_name="softoptic_migration_jobs")
    op.drop_column("softoptic_migration_jobs", "source_fingerprint")
    op.drop_column("softoptic_migration_jobs", "bundle_format_version")
    op.drop_column("softoptic_migration_jobs", "source_system")
