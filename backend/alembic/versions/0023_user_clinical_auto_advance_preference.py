"""add user clinical auto advance preference

Revision ID: 0023_auto_advance_pref
Revises: 0022_active_job_guards
Create Date: 2026-08-02
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0023_auto_advance_pref"
down_revision: Union[str, None] = "0022_active_job_guards"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "clinical_auto_advance_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "clinical_auto_advance_enabled")
