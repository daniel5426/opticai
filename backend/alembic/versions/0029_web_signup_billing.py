"""add web signup and subscription billing foundation

Revision ID: 0029_web_signup_billing
Revises: 0028_analytics_query_indexes
Create Date: 2026-08-09
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0029_web_signup_billing"
down_revision: Union[str, None] = "0028_analytics_query_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("pending_company_setups", sa.Column("selected_plan_code", sa.String(32), nullable=True))
    op.add_column("pending_company_setups", sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "pending_company_setups",
        sa.Column("wizard_state", sa.String(32), nullable=False, server_default="account"),
    )
    op.add_column("pending_company_setups", sa.Column("company_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column("pending_company_setups", sa.Column("clinic_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True))

    op.create_table(
        "subscriptions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("stripe_customer_id", sa.String(), nullable=True),
        sa.Column("stripe_subscription_id", sa.String(), nullable=True),
        sa.Column("stripe_price_id", sa.String(), nullable=True),
        sa.Column("plan_code", sa.String(32), nullable=False),
        sa.Column("pending_plan_code", sa.String(32), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending_checkout"),
        sa.Column("clinic_limit", sa.Integer(), nullable=True),
        sa.Column("staff_limit", sa.Integer(), nullable=True),
        sa.Column("trial_starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("trial_ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_period_starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_period_ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("grace_ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancel_at_period_end", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("pending_change_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("trial_consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("enterprise_clinic_limit", sa.Integer(), nullable=True),
        sa.Column("enterprise_staff_limit", sa.Integer(), nullable=True),
        sa.Column("stripe_event_created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "status IN ('pending_checkout','trialing','active','legacy_active','past_due','read_only','cancelled')",
            name="ck_subscriptions_status",
        ),
        sa.UniqueConstraint("company_id", name="uq_subscriptions_company_id"),
    )
    op.create_index("ix_subscriptions_company_id", "subscriptions", ["company_id"])
    op.create_index("ix_subscriptions_status", "subscriptions", ["status"])
    op.create_index("ix_subscriptions_stripe_customer_id", "subscriptions", ["stripe_customer_id"], unique=True)
    op.create_index("ix_subscriptions_stripe_subscription_id", "subscriptions", ["stripe_subscription_id"], unique=True)

    op.create_table(
        "billing_webhook_events",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("stripe_event_id", sa.String(), nullable=False),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("processing_state", sa.String(24), nullable=False, server_default="processing"),
        sa.Column("stripe_created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_billing_webhook_events_stripe_event_id", "billing_webhook_events", ["stripe_event_id"], unique=True)

    op.create_table(
        "terms_acceptances",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("terms_version", sa.String(64), nullable=False),
        sa.Column("privacy_version", sa.String(64), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("ip_address", sa.String(), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
    )
    op.create_index("ix_terms_acceptances_user_id", "terms_acceptances", ["user_id"])
    op.create_index("ix_terms_acceptances_company_id", "terms_acceptances", ["company_id"])

    op.create_table(
        "auth_action_tokens",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("token_hash", sa.String(), nullable=False),
        sa.Column("purpose", sa.String(32), nullable=False),
        sa.Column("pending_setup_id", sa.String(), sa.ForeignKey("pending_company_setups.id", ondelete="CASCADE"), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_auth_action_tokens_token_hash", "auth_action_tokens", ["token_hash"], unique=True)
    op.create_index("ix_auth_action_tokens_purpose", "auth_action_tokens", ["purpose"])
    op.create_index("ix_auth_action_tokens_pending_setup_id", "auth_action_tokens", ["pending_setup_id"])
    op.create_index("ix_auth_action_tokens_user_id", "auth_action_tokens", ["user_id"])
    op.create_index("ix_auth_action_tokens_expires_at", "auth_action_tokens", ["expires_at"])

    # Fail loudly before adding the production uniqueness guarantee. Empty values remain compatible.
    op.execute(
        """
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM users
            WHERE NULLIF(BTRIM(email), '') IS NOT NULL
            GROUP BY LOWER(BTRIM(email)) HAVING COUNT(*) > 1
          ) THEN
            RAISE EXCEPTION 'Duplicate normalized user emails must be resolved before migration';
          END IF;
        END $$;
        """
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_users_email_normalized_nonempty "
        "ON users (LOWER(BTRIM(email))) WHERE NULLIF(BTRIM(email), '') IS NOT NULL"
    )

    # Existing customers are explicitly unlimited and are never enrolled in billing.
    op.execute(
        """
        INSERT INTO subscriptions (id, company_id, plan_code, status, clinic_limit, staff_limit)
        SELECT 'legacy-' || id::text, id, 'legacy', 'legacy_active', NULL, NULL
        FROM companies
        ON CONFLICT (company_id) DO NOTHING
        """
    )

    # These tables are FastAPI-internal and are not part of the Supabase Data API contract.
    for table in ("subscriptions", "billing_webhook_events", "terms_acceptances", "auth_action_tokens"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"REVOKE ALL ON TABLE {table} FROM anon, authenticated")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_users_email_normalized_nonempty")
    op.drop_table("auth_action_tokens")
    op.drop_table("terms_acceptances")
    op.drop_table("billing_webhook_events")
    op.drop_table("subscriptions")
    op.drop_column("pending_company_setups", "clinic_payload")
    op.drop_column("pending_company_setups", "company_payload")
    op.drop_column("pending_company_setups", "wizard_state")
    op.drop_column("pending_company_setups", "email_verified_at")
    op.drop_column("pending_company_setups", "selected_plan_code")
