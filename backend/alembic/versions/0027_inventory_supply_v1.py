"""add inventory and supply v1

Revision ID: 0027_inventory_supply_v1
Revises: 0026_clinic_holiday_overrides
Create Date: 2026-08-09
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0027_inventory_supply_v1"
down_revision: Union[str, None] = "0026_clinic_holiday_overrides"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TABLES = (
    "catalog_products",
    "catalog_variants",
    "inventory_balances",
    "inventory_movements",
    "order_inventory_allocations",
    "catalog_discovery_runs",
    "catalog_discovery_candidates",
    "catalog_order_observations",
    "inventory_company_settings",
)


def _json_type():
    return sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def upgrade() -> None:
    op.create_table(
        "catalog_products",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(length=32), nullable=False),
        sa.Column("brand", sa.String(length=160), nullable=True),
        sa.Column("model", sa.String(length=160), nullable=False),
        sa.Column("product_type", sa.String(length=120), nullable=True),
        sa.Column("material", sa.String(length=120), nullable=True),
        sa.Column("preferred_supplier", sa.String(length=160), nullable=True),
        sa.Column("replacement_schedule", sa.String(length=120), nullable=True),
        sa.Column("normalized_key", sa.String(length=512), nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("category IN ('frame', 'contact_lens')", name="ck_catalog_products_category"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("company_id", "category", "normalized_key", name="uq_catalog_products_company_category_key"),
    )
    op.create_index("ix_catalog_products_company_id", "catalog_products", ["company_id"])
    op.create_index("ix_catalog_products_category", "catalog_products", ["category"])

    op.create_table(
        "catalog_variants",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("attributes", _json_type(), nullable=False),
        sa.Column("normalized_fingerprint", sa.String(length=1024), nullable=False),
        sa.Column("sku", sa.String(length=120), nullable=True),
        sa.Column("barcode", sa.String(length=160), nullable=True),
        sa.Column("default_cost", sa.Float(), nullable=True),
        sa.Column("default_retail", sa.Float(), nullable=True),
        sa.Column("currency", sa.String(length=3), server_default="ILS", nullable=False),
        sa.Column("is_stockable", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["catalog_products.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("company_id", "normalized_fingerprint", name="uq_catalog_variants_company_fingerprint"),
        sa.UniqueConstraint("company_id", "sku", name="uq_catalog_variants_company_sku"),
        sa.UniqueConstraint("company_id", "barcode", name="uq_catalog_variants_company_barcode"),
    )
    op.create_index("ix_catalog_variants_company_id", "catalog_variants", ["company_id"])
    op.create_index("ix_catalog_variants_product_id", "catalog_variants", ["product_id"])

    op.create_table(
        "inventory_balances",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("clinic_id", sa.Integer(), nullable=False),
        sa.Column("variant_id", sa.Integer(), nullable=False),
        sa.Column("on_hand", sa.Integer(), server_default="0", nullable=False),
        sa.Column("reserved", sa.Integer(), server_default="0", nullable=False),
        sa.Column("reorder_point", sa.Integer(), server_default="0", nullable=False),
        sa.Column("target_quantity", sa.Integer(), server_default="0", nullable=False),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("on_hand >= 0", name="ck_inventory_balances_on_hand_nonnegative"),
        sa.CheckConstraint("reserved >= 0", name="ck_inventory_balances_reserved_nonnegative"),
        sa.CheckConstraint("reserved <= on_hand", name="ck_inventory_balances_reserved_not_above_on_hand"),
        sa.CheckConstraint("reorder_point >= 0", name="ck_inventory_balances_reorder_nonnegative"),
        sa.CheckConstraint("target_quantity >= 0", name="ck_inventory_balances_target_nonnegative"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["variant_id"], ["catalog_variants.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("clinic_id", "variant_id", name="uq_inventory_balances_clinic_variant"),
    )
    op.create_index("ix_inventory_balances_company_id", "inventory_balances", ["company_id"])
    op.create_index("ix_inventory_balances_clinic_id", "inventory_balances", ["clinic_id"])
    op.create_index("ix_inventory_balances_variant_id", "inventory_balances", ["variant_id"])

    op.create_table(
        "inventory_movements",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("clinic_id", sa.Integer(), nullable=False),
        sa.Column("variant_id", sa.Integer(), nullable=False),
        sa.Column("balance_id", sa.Integer(), nullable=False),
        sa.Column("movement_type", sa.String(length=40), nullable=False),
        sa.Column("on_hand_delta", sa.Integer(), server_default="0", nullable=False),
        sa.Column("reserved_delta", sa.Integer(), server_default="0", nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("actor_user_id", sa.Integer(), nullable=True),
        sa.Column("order_id", sa.Integer(), nullable=True),
        sa.Column("contact_lens_order_id", sa.Integer(), nullable=True),
        sa.Column("idempotency_key", sa.String(length=160), nullable=True),
        sa.Column("movement_metadata", _json_type(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("on_hand_delta <> 0 OR reserved_delta <> 0", name="ck_inventory_movements_nonzero_delta"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["balance_id"], ["inventory_balances.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["contact_lens_order_id"], ["contact_lens_orders.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["variant_id"], ["catalog_variants.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("company_id", "idempotency_key", name="uq_inventory_movements_company_idempotency"),
    )
    for column in ("company_id", "clinic_id", "variant_id", "balance_id", "movement_type", "actor_user_id", "order_id", "contact_lens_order_id", "created_at"):
        op.create_index(f"ix_inventory_movements_{column}", "inventory_movements", [column])

    op.create_table(
        "order_inventory_allocations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("clinic_id", sa.Integer(), nullable=False),
        sa.Column("variant_id", sa.Integer(), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=True),
        sa.Column("contact_lens_order_id", sa.Integer(), nullable=True),
        sa.Column("component", sa.String(length=32), nullable=False),
        sa.Column("quantity", sa.Integer(), server_default="1", nullable=False),
        sa.Column("fulfillment_source", sa.String(length=32), nullable=False),
        sa.Column("lifecycle_state", sa.String(length=32), nullable=False),
        sa.Column("snapshot_fingerprint", sa.String(length=1024), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("(order_id IS NOT NULL AND contact_lens_order_id IS NULL) OR (order_id IS NULL AND contact_lens_order_id IS NOT NULL)", name="ck_order_inventory_allocations_one_order"),
        sa.CheckConstraint("quantity > 0", name="ck_order_inventory_allocations_quantity_positive"),
        sa.CheckConstraint("fulfillment_source IN ('inventory', 'supplier_ordered')", name="ck_order_inventory_allocations_source"),
        sa.CheckConstraint("lifecycle_state IN ('reserved', 'supplier_ordered', 'consumed', 'released', 'detached')", name="ck_order_inventory_allocations_state"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["contact_lens_order_id"], ["contact_lens_orders.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["variant_id"], ["catalog_variants.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("order_id", "component", name="uq_order_inventory_allocations_order_component"),
        sa.UniqueConstraint("contact_lens_order_id", "component", name="uq_order_inventory_allocations_contact_component"),
    )
    for column in ("company_id", "clinic_id", "variant_id", "order_id", "contact_lens_order_id"):
        op.create_index(f"ix_order_inventory_allocations_{column}", "order_inventory_allocations", [column])

    op.create_table(
        "catalog_discovery_runs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=32), server_default="review", nullable=False),
        sa.Column("summary", _json_type(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_catalog_discovery_runs_company_id", "catalog_discovery_runs", ["company_id"])
    op.create_index("ix_catalog_discovery_runs_created_by_user_id", "catalog_discovery_runs", ["created_by_user_id"])

    op.create_table(
        "catalog_discovery_candidates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("run_id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(length=32), nullable=False),
        sa.Column("product_data", _json_type(), nullable=False),
        sa.Column("variant_attributes", _json_type(), nullable=False),
        sa.Column("normalized_fingerprint", sa.String(length=1024), nullable=False),
        sa.Column("occurrence_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("source_summary", _json_type(), nullable=False),
        sa.Column("needs_details", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("selected", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("suggested_variant_id", sa.Integer(), nullable=True),
        sa.Column("confirmed_variant_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["confirmed_variant_id"], ["catalog_variants.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["run_id"], ["catalog_discovery_runs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["suggested_variant_id"], ["catalog_variants.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("run_id", "normalized_fingerprint", name="uq_catalog_discovery_candidates_run_fingerprint"),
    )
    op.create_index("ix_catalog_discovery_candidates_run_id", "catalog_discovery_candidates", ["run_id"])
    op.create_index("ix_catalog_discovery_candidates_company_id", "catalog_discovery_candidates", ["company_id"])

    op.create_table(
        "catalog_order_observations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("clinic_id", sa.Integer(), nullable=False),
        sa.Column("variant_id", sa.Integer(), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=True),
        sa.Column("contact_lens_order_id", sa.Integer(), nullable=True),
        sa.Column("component", sa.String(length=32), nullable=False),
        sa.Column("observed_on", sa.Date(), nullable=True),
        sa.Column("quantity", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("(order_id IS NOT NULL AND contact_lens_order_id IS NULL) OR (order_id IS NULL AND contact_lens_order_id IS NOT NULL)", name="ck_catalog_observations_one_order"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["contact_lens_order_id"], ["contact_lens_orders.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["variant_id"], ["catalog_variants.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("order_id", "component", name="uq_catalog_observations_order_component"),
        sa.UniqueConstraint("contact_lens_order_id", "component", name="uq_catalog_observations_contact_component"),
    )
    for column in ("company_id", "clinic_id", "variant_id", "order_id", "contact_lens_order_id"):
        op.create_index(f"ix_catalog_order_observations_{column}", "catalog_order_observations", [column])

    op.create_table(
        "inventory_company_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("discovery_intro_acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("default_reorder_point", sa.Integer(), server_default="0", nullable=False),
        sa.Column("default_target_quantity", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("company_id", name="uq_inventory_company_settings_company"),
    )
    op.create_index("ix_inventory_company_settings_company_id", "inventory_company_settings", ["company_id"])

    if op.get_bind().dialect.name == "postgresql":
        for table_name in TABLES:
            op.execute(f'ALTER TABLE public."{table_name}" ENABLE ROW LEVEL SECURITY')
            op.execute(f'REVOKE ALL ON TABLE public."{table_name}" FROM anon, authenticated')


def downgrade() -> None:
    for table_name in reversed(TABLES):
        op.drop_table(table_name)
