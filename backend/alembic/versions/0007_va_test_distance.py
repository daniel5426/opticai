"""add VA test distance setting

Revision ID: 0007_va_test_distance
Revises: 0006_file_storage_refactor
Create Date: 2026-05-03
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0007_va_test_distance"
down_revision: Union[str, None] = "0006_file_storage_refactor"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    settings_columns = {column["name"] for column in inspector.get_columns("settings")}

    if "va_test_distance" not in settings_columns:
        with op.batch_alter_table("settings") as batch_op:
            batch_op.add_column(
                sa.Column(
                    "va_test_distance",
                    sa.Integer(),
                    nullable=False,
                    server_default="6",
                )
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    settings_columns = {column["name"] for column in inspector.get_columns("settings")}

    if "va_test_distance" in settings_columns:
        with op.batch_alter_table("settings") as batch_op:
            batch_op.drop_column("va_test_distance")
