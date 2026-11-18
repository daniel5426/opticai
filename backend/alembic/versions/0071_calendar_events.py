"""Add general calendar events: free text at a time, with no client.

Appointments always belong to a client, so meetings, deliveries and other notes on the calendar
get their own table. It is additive; nothing existing changes.

Revision ID: 0071_calendar_events
Revises: 0070_messaging_channel_controls
"""
from alembic import op
import sqlalchemy as sa

revision = "0071_calendar_events"
down_revision = "0070_messaging_channel_controls"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "calendar_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("clinic_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("time", sa.String(length=5), nullable=False),
        sa.Column("duration", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_calendar_events_id", "calendar_events", ["id"])
    op.create_index("ix_calendar_events_company_id", "calendar_events", ["company_id"])
    op.create_index("ix_calendar_events_clinic_date", "calendar_events", ["clinic_id", "date"])
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY")


def downgrade():
    op.drop_table("calendar_events")
