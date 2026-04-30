"""default exam layout seeds

Revision ID: 0004_default_exam_layout_seeds
Revises: 0003_backend_owned_auth
Create Date: 2026-04-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0004_default_exam_layout_seeds"
down_revision: Union[str, None] = "0003_backend_owned_auth"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def _has_index(table_name: str, index_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return index_name in {index["name"] for index in inspector.get_indexes(table_name)}


def upgrade() -> None:
    if not _has_column("exam_layouts", "seed_key"):
        op.add_column("exam_layouts", sa.Column("seed_key", sa.String(), nullable=True))
    if not _has_column("exam_layouts", "seed_version"):
        op.add_column("exam_layouts", sa.Column("seed_version", sa.Integer(), nullable=True))
    if not _has_column("exam_layouts", "is_seeded_default"):
        op.add_column(
            "exam_layouts",
            sa.Column("is_seeded_default", sa.Boolean(), nullable=False, server_default=sa.false()),
        )
        op.alter_column("exam_layouts", "is_seeded_default", server_default=None)

    if not _has_index("exam_layouts", "ix_exam_layouts_clinic_seed_key"):
        op.create_index(
            "ix_exam_layouts_clinic_seed_key",
            "exam_layouts",
            ["clinic_id", "seed_key"],
            unique=True,
        )


def downgrade() -> None:
    pass
