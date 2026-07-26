"""enable RLS for recent-search tables

Revision ID: 0019_enable_recent_search_rls
Revises: 0018_softoptic_client_limit
Create Date: 2026-07-14
"""

from typing import Sequence, Union

from alembic import op


revision: str = "0019_enable_recent_search_rls"
down_revision: Union[str, None] = "0018_softoptic_client_limit"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TABLES = ("recent_client_visits", "prescription_search_index")


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return

    for table_name in TABLES:
        op.execute(f'ALTER TABLE IF EXISTS public."{table_name}" ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return

    for table_name in TABLES:
        op.execute(f'ALTER TABLE IF EXISTS public."{table_name}" DISABLE ROW LEVEL SECURITY')
