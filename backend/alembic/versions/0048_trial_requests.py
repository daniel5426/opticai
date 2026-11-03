"""Owner-reviewed free trial requests; no automatic grants or billing changes.

Revision ID: 0048_trial_requests
Revises: 0047_allpay_billing
"""
from alembic import op
import sqlalchemy as sa

revision = "0048_trial_requests"
down_revision = "0047_allpay_billing"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("subscription_trial_requests",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False, unique=True),
        sa.Column("requested_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.Column("reviewed_by_user_id", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("trial_ends_at", sa.DateTime(timezone=True)),
        sa.Column("decision_reason", sa.Text()),
        sa.CheckConstraint("status IN ('pending','approved','rejected')", name="ck_subscription_trial_request_status"))
    op.create_index("ix_subscription_trial_requests_status", "subscription_trial_requests", ["status"])
    op.execute("ALTER TABLE subscription_trial_requests ENABLE ROW LEVEL SECURITY")
    op.execute("REVOKE ALL ON TABLE subscription_trial_requests FROM anon, authenticated")


def downgrade():
    op.drop_index("ix_subscription_trial_requests_status", table_name="subscription_trial_requests")
    op.drop_table("subscription_trial_requests")
