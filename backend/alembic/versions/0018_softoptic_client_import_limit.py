"""softoptic client import limit

Revision ID: 0018_softoptic_client_limit
Revises: 0017_clinic_trust_expiry
Create Date: 2026-07-01 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0018_softoptic_client_limit"
down_revision: Union[str, None] = "0017_clinic_trust_expiry"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("softoptic_migration_jobs", sa.Column("client_import_limit", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("softoptic_migration_jobs", "client_import_limit")
