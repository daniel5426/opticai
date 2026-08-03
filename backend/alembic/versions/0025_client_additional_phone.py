"""add client additional phone

Revision ID: 0025_client_additional_phone
Revises: 0024_raw_source_payloads
Create Date: 2026-08-03
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0025_client_additional_phone"
down_revision: Union[str, None] = "0024_raw_source_payloads"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("clients", sa.Column("additional_phone", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("clients", "additional_phone")
