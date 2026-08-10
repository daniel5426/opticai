"""index prescription search rows by exam

Revision ID: 0030_presc_exam_index
Revises: 0029_web_signup_billing
Create Date: 2026-08-10
"""

from typing import Sequence, Union

from alembic import op


revision: str = "0030_presc_exam_index"
down_revision: Union[str, None] = "0029_web_signup_billing"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS "
            "ix_prescription_search_exam_id ON prescription_search_index (exam_id)"
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_prescription_search_exam_id")
