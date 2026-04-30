"""file storage refactor

Revision ID: 0006_file_storage_refactor
Revises: 0005_seeded_default_flag
Create Date: 2026-05-01
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0006_file_storage_refactor"
down_revision: Union[str, None] = "0005_seeded_default_flag"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("files") as batch_op:
        batch_op.add_column(sa.Column("original_file_name", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("storage_bucket", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("storage_key", sa.String(), nullable=True))
        batch_op.drop_column("file_path")
    op.create_index("ix_files_storage_key", "files", ["storage_bucket", "storage_key"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_files_storage_key", table_name="files")
    with op.batch_alter_table("files") as batch_op:
        batch_op.add_column(sa.Column("file_path", sa.String(), nullable=True))
        batch_op.drop_column("storage_key")
        batch_op.drop_column("storage_bucket")
        batch_op.drop_column("original_file_name")
