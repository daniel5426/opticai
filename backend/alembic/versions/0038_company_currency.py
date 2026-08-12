"""move default currency to company scope

Revision ID: 0038_company_currency
Revises: 0037_currency_support
Create Date: 2026-08-12
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0038_company_currency"
down_revision: Union[str, None] = "0037_currency_support"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    company_columns = {column["name"] for column in inspector.get_columns("companies")}
    if "default_currency" not in company_columns:
        op.add_column(
            "companies",
            sa.Column(
                "default_currency",
                sa.String(length=3),
                nullable=False,
                server_default=sa.text("'ILS'"),
            ),
        )
    settings_columns = {
        column["name"] for column in sa.inspect(bind).get_columns("settings")
    }
    if "default_currency" in settings_columns:
        op.drop_column("settings", "default_currency")


def downgrade() -> None:
    bind = op.get_bind()
    settings_columns = {
        column["name"] for column in sa.inspect(bind).get_columns("settings")
    }
    if "default_currency" not in settings_columns:
        op.add_column(
            "settings",
            sa.Column(
                "default_currency",
                sa.String(length=3),
                nullable=False,
                server_default=sa.text("'ILS'"),
            ),
        )
    company_columns = {
        column["name"] for column in sa.inspect(bind).get_columns("companies")
    }
    if "default_currency" in company_columns:
        op.drop_column("companies", "default_currency")
