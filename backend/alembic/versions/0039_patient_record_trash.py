"""add patient record trash

Revision ID: 0039_patient_record_trash
Revises: 0038_company_currency
Create Date: 2026-09-07
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0039_patient_record_trash"
down_revision: Union[str, None] = "0038_company_currency"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


SOFT_DELETE_TABLES = (
    "clients",
    "medical_logs",
    "optical_exams",
    "orders",
    "contact_lens_orders",
    "referrals",
    "appointments",
    "files",
)


def upgrade() -> None:
    op.create_table(
        "trash_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("clinic_id", sa.Integer(), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("root_entity_type", sa.String(40), nullable=False),
        sa.Column("root_entity_id", sa.Integer(), nullable=False),
        sa.Column("display_label", sa.String(255), nullable=False),
        sa.Column("client_id", sa.Integer()),
        sa.Column("client_label", sa.String(255)),
        sa.Column("deleted_by_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(24), server_default="trashed", nullable=False),
        sa.Column("included_counts", sa.JSON(), server_default=sa.text("'{}'"), nullable=False),
        sa.Column("warnings", sa.JSON(), server_default=sa.text("'[]'"), nullable=False),
        sa.Column("restored_by_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("restored_at", sa.DateTime(timezone=True)),
        sa.Column("purge_requested_by_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("purge_requested_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_trash_items_scope_deleted", "trash_items", ["company_id", "clinic_id", "deleted_at"])
    op.create_index("ix_trash_items_expiry_status", "trash_items", ["expires_at", "status"])
    for column in ("company_id", "clinic_id", "root_entity_type", "client_id", "deleted_by_user_id", "deleted_at", "expires_at", "status"):
        op.create_index(f"ix_trash_items_{column}", "trash_items", [column])

    op.create_table(
        "trash_members",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("trash_item_id", sa.Integer(), sa.ForeignKey("trash_items.id", ondelete="CASCADE"), nullable=False),
        sa.Column("entity_type", sa.String(40), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("entity_type", "entity_id", "trash_item_id", name="uq_trash_member_entity_batch"),
    )
    op.create_index("ix_trash_members_trash_item_id", "trash_members", ["trash_item_id"])
    op.create_index("ix_trash_members_entity", "trash_members", ["entity_type", "entity_id"])

    op.create_table(
        "trash_audit_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("trash_item_id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("clinic_id", sa.Integer(), nullable=False),
        sa.Column("entity_type", sa.String(40), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(40), nullable=False),
        sa.Column("actor_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("event_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("event_metadata", sa.JSON(), server_default=sa.text("'{}'"), nullable=False),
    )
    for column in ("trash_item_id", "company_id", "clinic_id", "event_type", "event_at"):
        op.create_index(f"ix_trash_audit_events_{column}", "trash_audit_events", [column])

    op.create_table(
        "trash_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("trash_item_id", sa.Integer(), sa.ForeignKey("trash_items.id", ondelete="CASCADE"), nullable=False),
        sa.Column("job_type", sa.String(40), nullable=False),
        sa.Column("generation", sa.Integer(), server_default="1", nullable=False),
        sa.Column("status", sa.String(24), server_default="pending", nullable=False),
        sa.Column("payload", sa.JSON(), server_default=sa.text("'{}'"), nullable=False),
        sa.Column("attempt_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("available_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("claimed_at", sa.DateTime(timezone=True)),
        sa.Column("claimed_by", sa.String(160)),
        sa.Column("last_error", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("trash_item_id", "job_type", "generation", name="uq_trash_job_generation"),
    )
    op.create_index("ix_trash_jobs_trash_item_id", "trash_jobs", ["trash_item_id"])
    op.create_index("ix_trash_jobs_status", "trash_jobs", ["status"])
    op.create_index("ix_trash_jobs_claim", "trash_jobs", ["status", "available_at", "created_at"])

    for table in SOFT_DELETE_TABLES:
        op.add_column(table, sa.Column("deleted_at", sa.DateTime(timezone=True)))
        op.add_column(table, sa.Column("deleted_by_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")))
        op.add_column(table, sa.Column("trash_item_id", sa.Integer(), sa.ForeignKey("trash_items.id", ondelete="SET NULL")))
        op.create_index(f"ix_{table}_deleted_at", table, ["deleted_at"])
        op.create_index(f"ix_{table}_deleted_by_user_id", table, ["deleted_by_user_id"])
        op.create_index(f"ix_{table}_trash_item_id", table, ["trash_item_id"])


def downgrade() -> None:
    for table in reversed(SOFT_DELETE_TABLES):
        op.drop_index(f"ix_{table}_trash_item_id", table_name=table)
        op.drop_index(f"ix_{table}_deleted_by_user_id", table_name=table)
        op.drop_index(f"ix_{table}_deleted_at", table_name=table)
        op.drop_column(table, "trash_item_id")
        op.drop_column(table, "deleted_by_user_id")
        op.drop_column(table, "deleted_at")
    op.drop_table("trash_jobs")
    op.drop_table("trash_audit_events")
    op.drop_table("trash_members")
    op.drop_table("trash_items")
