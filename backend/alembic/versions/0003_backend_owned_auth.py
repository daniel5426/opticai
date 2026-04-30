"""backend owned auth

Revision ID: 0003_backend_owned_auth
Revises: 0002_launch_schema_guards
Create Date: 2026-04-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0003_backend_owned_auth"
down_revision: Union[str, None] = "0002_launch_schema_guards"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(table_name: str) -> bool:
    return table_name in sa.inspect(op.get_bind()).get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    if _has_table("users") and _has_column("users", "password") and not _has_column("users", "password_hash"):
        with op.batch_alter_table("users") as batch:
            batch.alter_column("password", new_column_name="password_hash")
    elif _has_table("users") and not _has_column("users", "password_hash"):
        op.add_column("users", sa.Column("password_hash", sa.String(), nullable=True))

    if not _has_table("auth_sessions"):
        op.create_table(
            "auth_sessions",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("company_id", sa.Integer(), nullable=False),
            sa.Column("clinic_id", sa.Integer(), nullable=True),
            sa.Column("refresh_token_hash", sa.String(), nullable=False),
            sa.Column("device_id", sa.String(), nullable=True),
            sa.Column("user_agent", sa.String(), nullable=True),
            sa.Column("ip_address", sa.String(), nullable=True),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"]),
            sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_auth_sessions_user_id", "auth_sessions", ["user_id"])
        op.create_index("ix_auth_sessions_company_id", "auth_sessions", ["company_id"])
        op.create_index("ix_auth_sessions_clinic_id", "auth_sessions", ["clinic_id"])
        op.create_index("ix_auth_sessions_expires_at", "auth_sessions", ["expires_at"])
        op.create_index("ix_auth_sessions_refresh_token_hash", "auth_sessions", ["refresh_token_hash"], unique=True)

    if not _has_table("clinic_device_trusts"):
        op.create_table(
            "clinic_device_trusts",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("clinic_id", sa.Integer(), nullable=False),
            sa.Column("company_id", sa.Integer(), nullable=False),
            sa.Column("device_id", sa.String(), nullable=False),
            sa.Column("token_hash", sa.String(), nullable=False),
            sa.Column("entry_pin_version", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"]),
            sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("clinic_id", "device_id", name="uq_clinic_device_trusts_clinic_device"),
        )
        op.create_index("ix_clinic_device_trusts_id", "clinic_device_trusts", ["id"])
        op.create_index("ix_clinic_device_trusts_clinic_id", "clinic_device_trusts", ["clinic_id"])
        op.create_index("ix_clinic_device_trusts_company_id", "clinic_device_trusts", ["company_id"])
        op.create_index("ix_clinic_device_trusts_expires_at", "clinic_device_trusts", ["expires_at"])
        op.create_index("ix_clinic_device_trusts_token_hash", "clinic_device_trusts", ["token_hash"], unique=True)

    if not _has_table("pending_company_setups"):
        op.create_table(
            "pending_company_setups",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("setup_token_hash", sa.String(), nullable=False),
            sa.Column("email", sa.String(), nullable=False),
            sa.Column("full_name", sa.String(), nullable=True),
            sa.Column("password_hash", sa.String(), nullable=True),
            sa.Column("auth_provider", sa.String(), nullable=False, server_default="email"),
            sa.Column("google_account_email", sa.String(), nullable=True),
            sa.Column("google_access_token", sa.Text(), nullable=True),
            sa.Column("google_refresh_token", sa.Text(), nullable=True),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_pending_company_setups_setup_token_hash", "pending_company_setups", ["setup_token_hash"], unique=True)
        op.create_index("ix_pending_company_setups_email", "pending_company_setups", ["email"])
        op.create_index("ix_pending_company_setups_expires_at", "pending_company_setups", ["expires_at"])


def downgrade() -> None:
    pass
