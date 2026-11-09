"""Join layout appointment durations with the campaign/scanner migration chain.

Revision ID: 0063_merge_layout_duration
Revises: 0058_layout_appointment_duration, 0062_messaging_checkout
"""

revision = "0063_merge_layout_duration"
down_revision = ("0058_layout_appointment_duration", "0062_messaging_checkout")
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
