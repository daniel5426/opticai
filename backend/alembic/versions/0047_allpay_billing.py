"""Provider-neutral billing and owner overrides; preserve Stripe history.

Revision ID: 0047_allpay_billing
Revises: 0046_prescription_components
"""
from alembic import op
import sqlalchemy as sa

revision = "0047_allpay_billing"
down_revision = "0046_prescription_components"
branch_labels = None
depends_on = None


def upgrade():
    for col in [
        sa.Column("provider", sa.String(16), nullable=False, server_default="none"),
        sa.Column("amount_minor", sa.Integer()),
        sa.Column("automatic_billing", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("billing_locale", sa.String(2), nullable=False, server_default="en"),
        sa.Column("billing_anchor_at", sa.DateTime(timezone=True)),
        sa.Column("balance_minor", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("billing_revision", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("access_override", sa.String(16)),
        sa.Column("override_ends_at", sa.DateTime(timezone=True)),
        sa.Column("ai_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("campaigns_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("stripe_retired_at", sa.DateTime(timezone=True)),
    ]:
        op.add_column("subscriptions", col)
    op.execute("UPDATE subscriptions SET provider = 'stripe' WHERE stripe_subscription_id IS NOT NULL")
    # Legacy entitlement is an explicit migration decision, never a runtime fallback.
    op.execute("""INSERT INTO subscriptions
        (id, company_id, plan_code, status, clinic_limit, staff_limit)
        SELECT 'legacy-' || id::text, id, 'legacy', 'legacy_active', NULL, NULL
        FROM companies ON CONFLICT (company_id) DO NOTHING""")
    op.create_table("subscription_payment_methods",
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), primary_key=True),
        sa.Column("token_encrypted", sa.Text(), nullable=False),
        sa.Column("card_last4", sa.String(4)), sa.Column("card_brand", sa.String(32)),
        sa.Column("consent_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consent_version", sa.String(32), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
    op.create_table("subscription_invoices",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False, index=True),
        sa.Column("billing_revision", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("carry_minor", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cycle_key", sa.String(), unique=True, nullable=False),
        sa.Column("kind", sa.String(16), nullable=False), sa.Column("plan_code", sa.String(32), nullable=False),
        sa.Column("amount_minor", sa.Integer(), nullable=False), sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("period_start", sa.DateTime(timezone=True)), sa.Column("period_end", sa.DateTime(timezone=True)),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True)), sa.Column("receipt_url", sa.Text()),
        sa.Column("refunded_minor", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("notification_kind", sa.String(32)), sa.Column("notification_sent_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
    op.create_table("subscription_payment_attempts",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False, index=True),
        sa.Column("invoice_id", sa.String(), sa.ForeignKey("subscription_invoices.id"), index=True),
        sa.Column("kind", sa.String(16), nullable=False), sa.Column("status", sa.String(16), nullable=False),
        sa.Column("billing_revision", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("payment_url", sa.Text()), sa.Column("consent_at", sa.DateTime(timezone=True)),
        sa.Column("consent_version", sa.String(32)), sa.Column("test_mode", sa.Boolean(), nullable=False),
        sa.Column("error_code", sa.String(40)), sa.Column("token_pending", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("submitted_at", sa.DateTime(timezone=True)), sa.Column("reconciled_at", sa.DateTime(timezone=True)))
    op.create_table("subscription_audit_events",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False, index=True),
        sa.Column("actor_user_id", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("action", sa.String(64), nullable=False), sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("before", sa.JSON(), nullable=False), sa.Column("after", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
    op.create_table("subscription_refunds",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("invoice_id", sa.String(), sa.ForeignKey("subscription_invoices.id"), nullable=False, index=True),
        sa.Column("attempt_id", sa.String(), sa.ForeignKey("subscription_payment_attempts.id"), nullable=False),
        sa.Column("amount_minor", sa.Integer(), nullable=False), sa.Column("refunded_before", sa.Integer(), nullable=False, server_default="0"), sa.Column("status", sa.String(16), nullable=False),
        sa.Column("receipt_url", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
    for table in ("subscription_payment_methods", "subscription_invoices", "subscription_payment_attempts", "subscription_audit_events", "subscription_refunds"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"REVOKE ALL ON TABLE {table} FROM anon, authenticated")

    op.execute("""CREATE FUNCTION subscription_audit_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'Subscription audit events are append-only'; END; $$""")
    op.execute("""CREATE TRIGGER subscription_audit_no_mutation BEFORE UPDATE OR DELETE
        ON subscription_audit_events FOR EACH ROW EXECUTE FUNCTION subscription_audit_append_only()""")


def downgrade():
    op.execute("DROP TRIGGER subscription_audit_no_mutation ON subscription_audit_events")
    op.execute("DROP FUNCTION subscription_audit_append_only()")
    for table in ("subscription_refunds", "subscription_audit_events", "subscription_payment_attempts", "subscription_invoices", "subscription_payment_methods"):
        op.drop_table(table)
    for name in ("billing_locale", "billing_revision", "stripe_retired_at", "campaigns_enabled", "ai_enabled", "override_ends_at", "access_override", "balance_minor", "billing_anchor_at", "automatic_billing", "amount_minor", "provider"):
        op.drop_column("subscriptions", name)
