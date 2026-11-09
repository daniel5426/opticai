"""Let each exam layout or layout group set its own appointment length.

Revision ID: 0058_layout_appointment_duration
Revises: 0057_exam_workspace_save
"""
from alembic import op
import sqlalchemy as sa

revision = "0058_layout_appointment_duration"
down_revision = "0057_exam_workspace_save"
branch_labels = None
depends_on = None


def upgrade():
    # Staging already got this column by hand while its chain ran ahead of main.
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("exam_layouts")}
    if "appointment_duration" not in columns:
        op.add_column("exam_layouts", sa.Column("appointment_duration", sa.Integer(), nullable=True))


def downgrade():
    op.drop_column("exam_layouts", "appointment_duration")
