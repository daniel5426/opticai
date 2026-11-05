"""Persist email verification attempt limits without invalidating existing links.

Revision ID: 0055_email_verification_codes
Revises: 0054_reusable_discounts
"""
from alembic import op
import sqlalchemy as sa

revision = "0055_email_verification_codes"
down_revision = "0054_reusable_discounts"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("auth_action_tokens", sa.Column(
        "failed_attempts", sa.Integer(), nullable=False, server_default="0",
    ))


def downgrade():
    op.drop_column("auth_action_tokens", "failed_attempts")
