"""Give frames and contact lenses their own supplier and color lookups.

The glasses lens lists keep lookup_supplier and lookup_color. Each existing clinic's shared list
is copied into both new lists, so no clinic loses a supplier or color it already offers; clinics
can then trim each list on its own. Nothing existing is changed or removed.

Revision ID: 0069_split_supplier_color_lookups
Revises: 0068_calendar_pull
"""
from alembic import op
import sqlalchemy as sa

revision = "0069_split_supplier_color_lookups"
down_revision = "0068_calendar_pull"
branch_labels = None
depends_on = None

# New table -> the shared table its rows start from.
NEW_TABLES = {
    "lookup_frame_supplier": "lookup_supplier",
    "lookup_contact_lens_supplier": "lookup_supplier",
    "lookup_frame_color": "lookup_color",
    "lookup_contact_lens_color": "lookup_color",
}


def upgrade():
    postgres = op.get_bind().dialect.name == "postgresql"
    for table, source in NEW_TABLES.items():
        # The same shape, constraint and index names as models.ClinicScopedLookupMixin.
        op.create_table(
            table,
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
            sa.Column("clinic_id", sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("clinic_id", "name", name=f"uq_{table}_clinic_name"),
        )
        op.create_index(f"ix_{table}_id", table, ["id"])
        op.create_index(f"ix_{table}_clinic_id", table, ["clinic_id"])
        op.create_index(f"ix_{table}_clinic_name", table, ["clinic_id", "name"])
        op.create_index(f"ix_{table}_clinic_id_id", table, ["clinic_id", "id"])
        if postgres:
            op.execute(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY")
        op.execute(
            f"INSERT INTO {table} (clinic_id, name, created_at) "
            f"SELECT clinic_id, name, created_at FROM {source} ORDER BY id"
        )


def downgrade():
    for table in NEW_TABLES:
        op.drop_table(table)
