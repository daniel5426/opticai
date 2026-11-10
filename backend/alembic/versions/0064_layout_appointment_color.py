"""Let each exam layout or layout group set its appointments' calendar color.

Revision ID: 0064_layout_appointment_color
Revises: 0063_merge_layout_duration
"""
from alembic import op
import sqlalchemy as sa

revision = "0064_layout_appointment_color"
down_revision = "0063_merge_layout_duration"
branch_labels = None
depends_on = None


def upgrade():
    # Staging got this column by hand while the feature was reviewed.
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("exam_layouts")}
    if "appointment_color" not in columns:
        op.add_column("exam_layouts", sa.Column("appointment_color", sa.String(), nullable=True))


def downgrade():
    op.drop_column("exam_layouts", "appointment_color")
