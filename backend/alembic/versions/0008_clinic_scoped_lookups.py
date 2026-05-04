"""clinic scoped lookups

Revision ID: 0008_clinic_scoped_lookups
Revises: 0007_va_test_distance
Create Date: 2026-05-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0008_clinic_scoped_lookups"
down_revision: Union[str, None] = "0007_va_test_distance"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


LOOKUP_TABLES = [
    "lookup_supplier",
    "lookup_clinic",
    "lookup_order_type",
    "lookup_referral_type",
    "lookup_lens_model",
    "lookup_color",
    "lookup_material",
    "lookup_coating",
    "lookup_manufacturer",
    "lookup_frame_model",
    "lookup_contact_lens_type",
    "lookup_contact_eye_lens_type",
    "lookup_contact_eye_material",
    "lookup_contact_lens_model",
    "lookup_cleaning_solution",
    "lookup_disinfection_solution",
    "lookup_rinsing_solution",
    "lookup_manufacturing_lab",
    "lookup_advisor",
    "lookup_va_meter",
    "lookup_va_decimal",
]

VA_METER_VALUES = [
    "6/190", "6/150", "6/120", "6/96", "6/75", "6/60", "6/48", "6/38",
    "6/30", "6/24", "6/18", "6/15", "6/12", "6/9", "6/7.5", "6/6",
    "6/4.5", "6/3",
]

VA_DECIMAL_VALUES = [
    "-0.3", "-0.2", "-0.1", "0.0", "0.1", "0.2", "0.3", "0.4",
    "0.5", "0.6", "0.7", "0.8", "0.9", "1.0", "1.1", "1.2",
    "1.3", "1.4", "1.5",
]


def _drop_name_unique_constraints(inspector: sa.Inspector, table_name: str) -> None:
    for constraint in inspector.get_unique_constraints(table_name):
        if constraint.get("column_names") == ["name"] and constraint.get("name"):
            op.drop_constraint(constraint["name"], table_name, type_="unique")


def _seed_values(table_name: str, values: list[str]) -> None:
    for value in values:
        op.execute(
            sa.text(
                f"INSERT INTO {table_name} (clinic_id, name) "
                "SELECT id, :value FROM clinics"
            ).bindparams(value=value)
        )


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    for table_name in LOOKUP_TABLES:
        op.execute(sa.text(f"DELETE FROM {table_name}"))
        _drop_name_unique_constraints(inspector, table_name)
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.add_column(sa.Column("clinic_id", sa.Integer(), nullable=True))
            batch_op.create_foreign_key(
                f"fk_{table_name}_clinic_id_clinics",
                "clinics",
                ["clinic_id"],
                ["id"],
                ondelete="CASCADE",
            )

    _seed_values("lookup_va_meter", VA_METER_VALUES)
    _seed_values("lookup_va_decimal", VA_DECIMAL_VALUES)

    for table_name in LOOKUP_TABLES:
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.alter_column("clinic_id", existing_type=sa.Integer(), nullable=False)
            batch_op.create_unique_constraint(
                f"uq_{table_name}_clinic_name",
                ["clinic_id", "name"],
            )
            batch_op.create_index(
                f"ix_{table_name}_clinic_id",
                ["clinic_id"],
            )
            batch_op.create_index(
                f"ix_{table_name}_clinic_name",
                ["clinic_id", "name"],
            )
            batch_op.create_index(
                f"ix_{table_name}_clinic_id_id",
                ["clinic_id", "id"],
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    for table_name in LOOKUP_TABLES:
        op.execute(sa.text(f"DELETE FROM {table_name}"))
        indexes = {index["name"] for index in inspector.get_indexes(table_name)}
        uniques = {constraint["name"] for constraint in inspector.get_unique_constraints(table_name)}
        foreign_keys = {constraint["name"] for constraint in inspector.get_foreign_keys(table_name)}

        with op.batch_alter_table(table_name) as batch_op:
            for index_name in (
                f"ix_{table_name}_clinic_id_id",
                f"ix_{table_name}_clinic_name",
                f"ix_{table_name}_clinic_id",
            ):
                if index_name in indexes:
                    batch_op.drop_index(index_name)
            if f"uq_{table_name}_clinic_name" in uniques:
                batch_op.drop_constraint(f"uq_{table_name}_clinic_name", type_="unique")
            if f"fk_{table_name}_clinic_id_clinics" in foreign_keys:
                batch_op.drop_constraint(f"fk_{table_name}_clinic_id_clinics", type_="foreignkey")
            batch_op.drop_column("clinic_id")
            batch_op.create_unique_constraint(f"{table_name}_name_key", ["name"])
