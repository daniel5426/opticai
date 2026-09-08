"""make catalog discovery durable and paginated

Revision ID: 0029_catalog_discovery_jobs
Revises: 0038_company_currency
Create Date: 2026-09-01
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0029_catalog_discovery_jobs"
down_revision: Union[str, None] = "0038_company_currency"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("catalog_discovery_runs", sa.Column("step", sa.String(length=160), nullable=False, server_default="Waiting for discovery worker"))
    op.add_column("catalog_discovery_runs", sa.Column("progress", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("catalog_discovery_runs", sa.Column("total_orders", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("catalog_discovery_runs", sa.Column("scanned_orders", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("catalog_discovery_runs", sa.Column("candidate_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("catalog_discovery_runs", sa.Column("selected_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("catalog_discovery_runs", sa.Column("checkpoint", sa.JSON(), nullable=False, server_default=sa.text("'{}'")))
    op.add_column("catalog_discovery_runs", sa.Column("error", sa.Text(), nullable=True))
    op.add_column("catalog_discovery_runs", sa.Column("locked_by", sa.String(length=160), nullable=True))
    op.add_column("catalog_discovery_runs", sa.Column("lease_until", sa.DateTime(timezone=True), nullable=True))
    op.add_column("catalog_discovery_runs", sa.Column("heartbeat_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("catalog_discovery_runs", sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("catalog_discovery_runs", sa.Column("started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("catalog_discovery_runs", sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True))
    op.alter_column("catalog_discovery_runs", "status", existing_type=sa.String(length=32), server_default="queued")
    op.create_index("ix_catalog_discovery_runs_status", "catalog_discovery_runs", ["status"])
    op.create_index("ix_catalog_discovery_runs_locked_by", "catalog_discovery_runs", ["locked_by"])
    op.create_index("ix_catalog_discovery_runs_lease_until", "catalog_discovery_runs", ["lease_until"])

    op.create_table(
        "catalog_discovery_sources",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("candidate_id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("clinic_id", sa.Integer(), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=True),
        sa.Column("contact_lens_order_id", sa.Integer(), nullable=True),
        sa.Column("component", sa.String(length=32), nullable=False),
        sa.Column("observed_on", sa.Date(), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint(
            "(order_id IS NOT NULL AND contact_lens_order_id IS NULL) OR "
            "(order_id IS NULL AND contact_lens_order_id IS NOT NULL)",
            name="ck_catalog_discovery_sources_one_order",
        ),
        sa.ForeignKeyConstraint(["candidate_id"], ["catalog_discovery_candidates.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["contact_lens_order_id"], ["contact_lens_orders.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("candidate_id", "order_id", "component", name="uq_catalog_discovery_sources_order_component"),
        sa.UniqueConstraint("candidate_id", "contact_lens_order_id", "component", name="uq_catalog_discovery_sources_contact_component"),
    )
    for column in ("candidate_id", "company_id", "clinic_id", "order_id", "contact_lens_order_id"):
        op.create_index(f"ix_catalog_discovery_sources_{column}", "catalog_discovery_sources", [column])


def downgrade() -> None:
    op.drop_table("catalog_discovery_sources")
    for name in (
        "ix_catalog_discovery_runs_lease_until",
        "ix_catalog_discovery_runs_locked_by",
        "ix_catalog_discovery_runs_status",
    ):
        op.drop_index(name, table_name="catalog_discovery_runs")
    for column in (
        "finished_at", "started_at", "attempt_count", "heartbeat_at", "lease_until",
        "locked_by", "error", "checkpoint", "selected_count", "candidate_count",
        "scanned_orders", "total_orders", "progress", "step",
    ):
        op.drop_column("catalog_discovery_runs", column)
    op.alter_column("catalog_discovery_runs", "status", existing_type=sa.String(length=32), server_default="review")
