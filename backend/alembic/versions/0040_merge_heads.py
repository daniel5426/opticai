"""merge catalog discovery and patient-record trash migration heads

Revision ID: 0040_merge_heads
Revises: 0030_discovery_source_rls, 0039_patient_record_trash
Create Date: 2026-09-08
"""

from typing import Sequence, Union


revision: str = "0040_merge_heads"
down_revision: Union[str, Sequence[str], None] = (
    "0030_discovery_source_rls",
    "0039_patient_record_trash",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Merge point; the parent revisions contain the schema changes."""


def downgrade() -> None:
    """Merge point; the parent revisions contain the schema changes."""
