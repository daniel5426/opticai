"""keep exam layout seed flag defaulted

Revision ID: 0005_seeded_default_flag
Revises: 0004_default_exam_layout_seeds
Create Date: 2026-05-01
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0005_seeded_default_flag"
down_revision: Union[str, None] = "0004_default_exam_layout_seeds"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE exam_layouts SET is_seeded_default = false WHERE is_seeded_default IS NULL")
    op.alter_column("exam_layouts", "is_seeded_default", server_default=sa.false())


def downgrade() -> None:
    op.alter_column("exam_layouts", "is_seeded_default", server_default=None)
