"""Add spectacle lens catalog support and optional percentage item discounts."""
from alembic import op
import sqlalchemy as sa

revision = "0056_order_pricing_lenses"
down_revision = "0055_email_verification_codes"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("catalog_products") as batch:
        batch.drop_constraint("ck_catalog_products_category", type_="check")
        batch.create_check_constraint("ck_catalog_products_category", "category IN ('frame', 'contact_lens', 'spectacle_lens')")
    op.add_column("order_line_item", sa.Column("discount_percent", sa.Float(), nullable=True))


def downgrade():
    # Refuse narrowing while lens catalog records exist; never discard user data.
    count = op.get_bind().execute(sa.text("SELECT count(*) FROM catalog_products WHERE category = 'spectacle_lens' ")).scalar()
    if count:
        raise RuntimeError("Spectacle lens catalog entries must be migrated before downgrade")
    op.drop_column("order_line_item", "discount_percent")
    with op.batch_alter_table("catalog_products") as batch:
        batch.drop_constraint("ck_catalog_products_category", type_="check")
        batch.create_check_constraint("ck_catalog_products_category", "category IN ('frame', 'contact_lens')")
