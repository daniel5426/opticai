"""protect catalog discovery source rows with RLS

Revision ID: 0030_discovery_source_rls
Revises: 0029_catalog_discovery_jobs
Create Date: 2026-09-01
"""

from typing import Sequence, Union

from alembic import op


revision: str = "0030_discovery_source_rls"
down_revision: Union[str, None] = "0029_catalog_discovery_jobs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute('ALTER TABLE public."catalog_discovery_sources" ENABLE ROW LEVEL SECURITY')
        op.execute('REVOKE ALL ON TABLE public."catalog_discovery_sources" FROM anon, authenticated')


def downgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute('ALTER TABLE public."catalog_discovery_sources" DISABLE ROW LEVEL SECURITY')
