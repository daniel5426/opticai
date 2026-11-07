"""Add scoped idempotency for atomic exam creation; preserve clinical data."""
from alembic import op
import sqlalchemy as sa

revision = "0057_exam_workspace_save"
down_revision = "0056_order_pricing_lenses"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("optical_exams", sa.Column("creation_key", sa.String(64), nullable=True))
    op.add_column("optical_exams", sa.Column("creation_request_hash", sa.String(64), nullable=True))
    op.create_index("uq_exam_company_creation_key", "optical_exams", ["company_id", "creation_key"], unique=True)


def downgrade():
    op.drop_index("uq_exam_company_creation_key", table_name="optical_exams")
    op.drop_column("optical_exams", "creation_request_hash")
    op.drop_column("optical_exams", "creation_key")
