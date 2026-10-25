"""Add shared order groups without changing legacy order identities.

Revision ID: 0041_shared_order_groups
Revises: 0040_merge_heads
"""
from alembic import op
import sqlalchemy as sa

revision = "0041_shared_order_groups"
down_revision = "0040_merge_heads"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    # Refuse ambiguous invoices before any DDL or data changes.
    for column in ("order_id", "contact_lens_id"):
        duplicates = bind.execute(sa.text(f"SELECT {column}, COUNT(*) FROM billings WHERE {column} IS NOT NULL GROUP BY {column} HAVING COUNT(*) > 1 LIMIT 20")).all()
        if duplicates:
            raise RuntimeError(f"Resolve duplicate billing links before migrating: {column}: {duplicates}")
    if bind.execute(sa.text("SELECT id FROM billings WHERE order_id IS NOT NULL AND contact_lens_id IS NOT NULL LIMIT 1")).first():
        raise RuntimeError("Resolve billing records linked to both order kinds before migrating")
    op.create_table("order_groups",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("clinic_id", sa.Integer(), sa.ForeignKey("clinics.id")),
        sa.Column("payer_client_id", sa.Integer(), sa.ForeignKey("clients.id", ondelete="SET NULL")),
        sa.Column("opened_date", sa.Date()),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("legacy_write_protected", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("creation_key", sa.String(64), unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_by_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("trash_item_id", sa.Integer(), sa.ForeignKey("trash_items.id", ondelete="SET NULL")))
    for column in ("clinic_id", "payer_client_id", "deleted_at", "deleted_by_user_id", "trash_item_id"):
        op.create_index(f"ix_order_groups_{column}", "order_groups", [column])
    op.create_table("order_group_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("group_id", sa.Integer(), sa.ForeignKey("order_groups.id", ondelete="CASCADE"), nullable=False),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id", ondelete="CASCADE"), unique=True),
        sa.Column("contact_lens_id", sa.Integer(), sa.ForeignKey("contact_lens_orders.id", ondelete="CASCADE"), unique=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.CheckConstraint("(order_id IS NOT NULL AND contact_lens_id IS NULL) OR (order_id IS NULL AND contact_lens_id IS NOT NULL)", name="ck_group_entry_one_order"))
    op.create_index("ix_group_entry_position", "order_group_entries", ["group_id", "position"])
    if bind.dialect.name == "sqlite":
        # Avoid rebuilding invoice tables: DROP TABLE would cascade to payments.
        op.execute("ALTER TABLE billings ADD COLUMN order_group_id INTEGER REFERENCES order_groups(id) ON DELETE CASCADE")
        op.create_index("uq_billing_order_group", "billings", ["order_group_id"], unique=True)
        op.execute("ALTER TABLE order_line_item ADD COLUMN source_entry_id INTEGER REFERENCES order_group_entries(id) ON DELETE SET NULL")
        op.add_column("order_line_item", sa.Column("source_slot", sa.String()))
        op.add_column("order_line_item", sa.Column("manually_edited", sa.Boolean(), nullable=False, server_default=sa.true()))
        op.create_index("ix_order_line_item_source_entry_id", "order_line_item", ["source_entry_id"])
    else:
        with op.batch_alter_table("billings") as batch:
            batch.add_column(sa.Column("order_group_id", sa.Integer()))
            batch.create_foreign_key("fk_billing_order_group", "order_groups", ["order_group_id"], ["id"], ondelete="CASCADE")
            batch.create_unique_constraint("uq_billing_order_group", ["order_group_id"])
        with op.batch_alter_table("order_line_item") as batch:
            batch.add_column(sa.Column("source_entry_id", sa.Integer()))
            batch.add_column(sa.Column("source_slot", sa.String()))
            batch.add_column(sa.Column("manually_edited", sa.Boolean(), nullable=False, server_default=sa.true()))
            batch.create_foreign_key("fk_line_source_entry", "order_group_entries", ["source_entry_id"], ["id"], ondelete="SET NULL")
            batch.create_index("ix_order_line_item_source_entry_id", ["source_entry_id"])
    op.add_column("contact_lens_orders", sa.Column("dominant_eye", sa.String()))
    metadata = sa.MetaData()
    groups = sa.Table("order_groups", metadata, autoload_with=bind)
    entries = sa.Table("order_group_entries", metadata, autoload_with=bind)
    bills = sa.Table("billings", metadata, autoload_with=bind)
    for table_name, kind, link in (("orders", "regular", "order_id"), ("contact_lens_orders", "contact", "contact_lens_id")):
        orders = sa.Table(table_name, metadata, autoload_with=bind)
        key = sa.literal(f"legacy:{kind}:") + sa.cast(orders.c.id, sa.String())
        bind.execute(groups.insert().from_select(
            ["clinic_id", "payer_client_id", "opened_date", "creation_key", "deleted_at", "deleted_by_user_id", "trash_item_id"],
            sa.select(orders.c.clinic_id, orders.c.client_id, orders.c.order_date, key, orders.c.deleted_at, orders.c.deleted_by_user_id, orders.c.trash_item_id)))
        bind.execute(entries.insert().from_select(["group_id", link, "position"],
            sa.select(groups.c.id, orders.c.id, sa.literal(0)).select_from(orders.join(groups, groups.c.creation_key == key))))
        group_id = sa.select(entries.c.group_id).where(entries.c[link] == bills.c[link]).scalar_subquery()
        bind.execute(bills.update().where(bills.c[link].is_not(None)).values(order_group_id=group_id))
    if bind.dialect.name == "postgresql":
        for table in ("order_groups", "order_group_entries"):
            op.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY')
            # These tables are accessed through authenticated, clinic-scoped backend APIs.
            op.execute(f"DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON {table} FROM anon; END IF; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON {table} FROM authenticated; END IF; END $$")


def downgrade():
    raise RuntimeError("Shared groups cannot safely downgrade after use. Disable the feature and retain the compatibility backend.")
