"""make entity deletion foreign keys production-safe

Revision ID: 0020_delete_cascade_compat
Revises: 0019_enable_recent_search_rls
Create Date: 2026-07-15
"""

from typing import Sequence, Union

from alembic import op


revision: str = "0020_delete_cascade_compat"
down_revision: Union[str, None] = "0019_enable_recent_search_rls"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


CASCADE_FOREIGN_KEYS = (
    ("billing_payments", "billing_payments_billing_id_fkey", "billing_id", "billings"),
    ("billings", "billings_contact_lens_id_fkey", "contact_lens_id", "contact_lens_orders"),
    ("billings", "billings_order_id_fkey", "order_id", "orders"),
    ("campaign_client_executions", "campaign_client_executions_campaign_id_fkey", "campaign_id", "campaigns"),
    ("email_logs", "email_logs_appointment_id_fkey", "appointment_id", "appointments"),
    ("order_line_item", "order_line_item_billings_id_fkey", "billings_id", "billings"),
    ("referral_eye", "referral_eye_referral_id_fkey", "referral_id", "referrals"),
)

SET_NULL_FOREIGN_KEYS = (
    ("appointments", "appointments_user_id_fkey", "user_id", "users"),
    ("clients", "clients_family_id_fkey", "family_id", "families"),
    ("contact_lens_orders", "contact_lens_orders_user_id_fkey", "user_id", "users"),
    ("files", "files_uploaded_by_fkey", "uploaded_by", "users"),
    ("medical_logs", "medical_logs_user_id_fkey", "user_id", "users"),
    ("optical_exams", "optical_exams_user_id_fkey", "user_id", "users"),
    ("orders", "orders_user_id_fkey", "user_id", "users"),
    ("referrals", "referrals_user_id_fkey", "user_id", "users"),
)

ORIGINAL_DELETE_RULES = {
    "appointments_user_id_fkey": "CASCADE",
    "auth_sessions_user_id_fkey": None,
    "billing_payments_billing_id_fkey": None,
    "billings_contact_lens_id_fkey": None,
    "billings_order_id_fkey": None,
    "campaign_client_executions_campaign_id_fkey": None,
    "clients_family_id_fkey": None,
    "contact_lens_orders_user_id_fkey": "CASCADE",
    "email_logs_appointment_id_fkey": None,
    "files_uploaded_by_fkey": "RESTRICT",
    "medical_logs_user_id_fkey": "RESTRICT",
    "optical_exams_user_id_fkey": "CASCADE",
    "order_line_item_billings_id_fkey": None,
    "orders_user_id_fkey": "RESTRICT",
    "referral_eye_referral_id_fkey": None,
    "referrals_user_id_fkey": "RESTRICT",
}

AUTH_SESSION_FOREIGN_KEY = ("auth_sessions", "auth_sessions_user_id_fkey", "user_id", "users")


def _replace_foreign_key(table: str, name: str, column: str, parent: str, ondelete: str | None) -> None:
    op.drop_constraint(name, table, type_="foreignkey")
    op.create_foreign_key(name, table, parent, [column], ["id"], ondelete=ondelete)


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return

    for foreign_key in CASCADE_FOREIGN_KEYS:
        _replace_foreign_key(*foreign_key, ondelete="CASCADE")
    _replace_foreign_key(*AUTH_SESSION_FOREIGN_KEY, ondelete="CASCADE")
    for foreign_key in SET_NULL_FOREIGN_KEYS:
        _replace_foreign_key(*foreign_key, ondelete="SET NULL")


def downgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return

    foreign_keys = (*CASCADE_FOREIGN_KEYS, AUTH_SESSION_FOREIGN_KEY, *SET_NULL_FOREIGN_KEYS)
    for table, name, column, parent in foreign_keys:
        _replace_foreign_key(table, name, column, parent, ORIGINAL_DELETE_RULES[name])
