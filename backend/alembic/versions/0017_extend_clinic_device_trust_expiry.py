"""extend clinic device trust expiry

Revision ID: 0017_clinic_trust_expiry
Revises: 0016_recent_search_merge
Create Date: 2026-06-16
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0017_clinic_trust_expiry"
down_revision: Union[str, None] = "0016_recent_search_merge"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

EXTENSION_DAYS = 3650


def _has_table(table_name: str) -> bool:
    return table_name in sa.inspect(op.get_bind()).get_table_names()


def upgrade() -> None:
    if not _has_table("clinic_device_trusts"):
        return

    dialect = op.get_bind().dialect.name
    if dialect == "postgresql":
        op.execute(
            sa.text(
                f"""
                UPDATE clinic_device_trusts
                SET expires_at = CURRENT_TIMESTAMP + INTERVAL '{EXTENSION_DAYS} days'
                WHERE revoked_at IS NULL
                  AND expires_at < CURRENT_TIMESTAMP + INTERVAL '{EXTENSION_DAYS} days'
                """
            )
        )
    elif dialect == "sqlite":
        op.execute(
            sa.text(
                f"""
                UPDATE clinic_device_trusts
                SET expires_at = datetime('now', '+{EXTENSION_DAYS} days')
                WHERE revoked_at IS NULL
                  AND expires_at < datetime('now', '+{EXTENSION_DAYS} days')
                """
            )
        )


def downgrade() -> None:
    pass
