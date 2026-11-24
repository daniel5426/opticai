"""Add clinic terminal checkout and fiscal-document tracking."""
from alembic import op
import sqlalchemy as sa

revision = "0073_terminal_checkout"
down_revision = "0072_company_exam_layouts"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "terminal_connections",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("owner_clinic_id", sa.Integer(), sa.ForeignKey("clinics.id"), nullable=False),
        sa.Column("provider", sa.String(12), nullable=False),
        sa.Column("environment", sa.String(12), nullable=False),
        sa.Column("account_ref", sa.String(100), nullable=False),
        sa.Column("label", sa.String(200), nullable=False),
        sa.Column("encrypted_credentials", sa.Text(), nullable=False),
        sa.UniqueConstraint("company_id", "provider", "environment", "account_ref"),
    )
    op.create_table(
        "terminal_checkouts",
        sa.Column("clinic_id", sa.Integer(), sa.ForeignKey("clinics.id"), primary_key=True),
        sa.Column("environment", sa.String(12), nullable=False),
        sa.Column("payplus_id", sa.Integer(), sa.ForeignKey("terminal_connections.id")),
        sa.Column("sumit_id", sa.Integer(), sa.ForeignKey("terminal_connections.id")),
        sa.Column("device_uid", sa.String(36)),
        sa.Column("device_label", sa.String(100)),
        sa.Column("terminal_uid", sa.String(36)),
        sa.Column("deposit_document", sa.Integer(), nullable=False),
        sa.Column("final_document", sa.Integer(), nullable=False),
        sa.Column("invoice_description", sa.String(100)),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.UniqueConstraint("environment", "device_uid"),
    )
    op.create_table(
        "terminal_operations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("request_key", sa.String(36), nullable=False),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("clinic_id", sa.Integer(), sa.ForeignKey("clinics.id"), nullable=False),
        sa.Column("billing_id", sa.Integer(), sa.ForeignKey("billings.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("original_id", sa.String(36), sa.ForeignKey("terminal_operations.id")),
        sa.Column("payment_id", sa.Integer(), sa.ForeignKey("billing_payments.id"), unique=True),
        sa.Column("payplus_id", sa.Integer(), sa.ForeignKey("terminal_connections.id"), nullable=False),
        sa.Column("sumit_id", sa.Integer(), sa.ForeignKey("terminal_connections.id"), nullable=False),
        sa.Column("environment", sa.String(12), nullable=False),
        sa.Column("device_uid", sa.String(36), nullable=False),
        sa.Column("terminal_uid", sa.String(36), nullable=False),
        sa.Column("amount_minor", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(250)),
        sa.Column("state", sa.String(16), nullable=False),
        sa.Column("work_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("cancel_requested", sa.Boolean(), nullable=False),
        sa.Column("provider_uid", sa.String(100)),
        sa.Column("paid_at", sa.DateTime(timezone=True)),
        sa.Column("document_type", sa.Integer(), nullable=False),
        sa.Column("document_payload", sa.JSON(), nullable=False),
        sa.Column("document_state", sa.String(16), nullable=False),
        sa.Column("document_work_at", sa.DateTime(timezone=True)),
        sa.Column("document_id", sa.String(40)),
        sa.Column("document_number", sa.String(40)),
        sa.Column("document_url", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("company_id", "request_key"),
        sa.UniqueConstraint("payplus_id", "provider_uid"),
    )
    for column in ("billing_id", "original_id"):
        op.create_index(f"ix_terminal_operations_{column}", "terminal_operations", [column])
    active = sa.text("state IN ('queued', 'sending', 'checking')")
    for key, columns in (("billing", ["billing_id"]), ("device", ["environment", "device_uid"])):
        op.create_index(f"uq_terminal_operation_busy_{key}", "terminal_operations", columns,
                        unique=True, postgresql_where=active, sqlite_where=active)
    op.create_index("ix_terminal_operation_work", "terminal_operations", ["state", "work_at"])
    op.create_index("ix_terminal_document_work", "terminal_operations", ["document_state", "document_work_at"])
    if op.get_bind().dialect.name == "postgresql":
        for table in ("terminal_connections", "terminal_checkouts", "terminal_operations"):
            op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
            op.execute(f"REVOKE ALL ON TABLE {table} FROM PUBLIC")
            for role in ("anon", "authenticated"):
                op.execute(
                    f"DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{role}') "
                    f"THEN EXECUTE 'REVOKE ALL ON TABLE {table} FROM {role}'; END IF; END $$"
                )


def downgrade():
    for table in ("terminal_operations", "terminal_checkouts", "terminal_connections"):
        op.drop_table(table)
