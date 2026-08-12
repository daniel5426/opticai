"""add immutable money currencies

Revision ID: 0037_currency_support
Revises: 0036_presc_clinic_index
Create Date: 2026-08-12
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0037_currency_support"
down_revision: Union[str, None] = "0036_presc_clinic_index"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _add_currency_column(table_name: str, column_name: str) -> None:
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns(table_name)}
    if column_name not in columns:
        op.add_column(
            table_name,
            sa.Column(
                column_name,
                sa.String(length=3),
                nullable=False,
                server_default=sa.text("'ILS'"),
            ),
        )


def upgrade() -> None:
    # Existing monetary values were entered as ILS.  This labels them without
    # changing any numeric value or performing an exchange-rate conversion.
    _add_currency_column("settings", "default_currency")
    _add_currency_column("billings", "currency")
    _add_currency_column("billing_payments", "currency")
    _add_currency_column("order_line_item", "currency")


def downgrade() -> None:
    bind = op.get_bind()
    for table_name, column_name in (
        ("order_line_item", "currency"),
        ("billing_payments", "currency"),
        ("billings", "currency"),
        ("settings", "default_currency"),
    ):
        columns = {column["name"] for column in sa.inspect(bind).get_columns(table_name)}
        if column_name in columns:
            op.drop_column(table_name, column_name)
