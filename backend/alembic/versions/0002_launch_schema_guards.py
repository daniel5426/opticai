"""launch schema guards

Revision ID: 0002_launch_schema_guards
Revises: 0001_baseline_current_schema
Create Date: 2026-04-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002_launch_schema_guards"
down_revision: Union[str, None] = "0001_baseline_current_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


INDEXES: tuple[tuple[str, str, tuple[str, ...]], ...] = (
    ("ix_families_company_clinic_id", "families", ("company_id", "clinic_id", "id")),
    ("ix_families_company_clinic_name", "families", ("company_id", "clinic_id", "name")),
    ("ix_families_clinic_name", "families", ("clinic_id", "name")),
    ("ix_clients_clinic_id", "clients", ("clinic_id",)),
    ("ix_clients_family_id", "clients", ("family_id",)),
    ("ix_clients_family_id_id", "clients", ("family_id", "id")),
    ("ix_referrals_clinic_id", "referrals", ("clinic_id",)),
    ("ix_referrals_client_id", "referrals", ("client_id",)),
    ("ix_referrals_user_id", "referrals", ("user_id",)),
    ("ix_orders_clinic_id", "orders", ("clinic_id",)),
    ("ix_orders_client_id", "orders", ("client_id",)),
    ("ix_orders_user_id", "orders", ("user_id",)),
    ("ix_contact_lens_orders_clinic_id", "contact_lens_orders", ("clinic_id",)),
    ("ix_contact_lens_orders_client_id", "contact_lens_orders", ("client_id",)),
    ("ix_contact_lens_orders_user_id", "contact_lens_orders", ("user_id",)),
    ("ix_files_clinic_id", "files", ("clinic_id",)),
    ("ix_files_client_id", "files", ("client_id",)),
    ("ix_appointments_clinic_id", "appointments", ("clinic_id",)),
    ("ix_appointments_client_id", "appointments", ("client_id",)),
    ("ix_appointments_user_id", "appointments", ("user_id",)),
    ("ix_families_clinic_id", "families", ("clinic_id",)),
    ("ix_users_clinic_id", "users", ("clinic_id",)),
    ("ix_users_is_active", "users", ("is_active",)),
    ("ix_settings_clinic_id", "settings", ("clinic_id",)),
    ("ix_exam_layout_instances_exam_id", "exam_layout_instances", ("exam_id",)),
    ("ix_exam_layout_instances_exam_id_is_active", "exam_layout_instances", ("exam_id", "is_active")),
    ("ix_exam_layout_instances_exam_id_order", "exam_layout_instances", ("exam_id", "order")),
    ("ix_optical_exams_clinic_id", "optical_exams", ("clinic_id",)),
    ("ix_optical_exams_type", "optical_exams", ("type",)),
    ("ix_optical_exams_clinic_type_date", "optical_exams", ("clinic_id", "type", "exam_date")),
    ("ix_migration_source_links_source", "migration_source_links", ("source_system", "source_table", "clinic_id")),
    ("ix_migration_source_links_target", "migration_source_links", ("target_model", "target_id")),
)

DESC_INDEX_SQL: tuple[tuple[str, str], ...] = (
    ("ix_clients_clinic_id_id_desc", "CREATE INDEX IF NOT EXISTS ix_clients_clinic_id_id_desc ON clients (clinic_id, id DESC)"),
    ("ix_referrals_clinic_date", "CREATE INDEX IF NOT EXISTS ix_referrals_clinic_date ON referrals (clinic_id, date DESC)"),
    ("ix_orders_clinic_date", "CREATE INDEX IF NOT EXISTS ix_orders_clinic_date ON orders (clinic_id, order_date DESC)"),
    ("ix_contact_lens_orders_clinic_date", "CREATE INDEX IF NOT EXISTS ix_contact_lens_orders_clinic_date ON contact_lens_orders (clinic_id, order_date DESC)"),
    ("ix_files_clinic_upload_date", "CREATE INDEX IF NOT EXISTS ix_files_clinic_upload_date ON files (clinic_id, upload_date DESC)"),
    ("ix_appointments_clinic_date", "CREATE INDEX IF NOT EXISTS ix_appointments_clinic_date ON appointments (clinic_id, date DESC)"),
    ("ix_appointments_clinic_date_time", "CREATE INDEX IF NOT EXISTS ix_appointments_clinic_date_time ON appointments (clinic_id, date, time)"),
    ("ix_families_clinic_created", "CREATE INDEX IF NOT EXISTS ix_families_clinic_created ON families (clinic_id, created_date DESC)"),
)


def _has_column(table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def _has_index(table_name: str, index_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return index_name in {index["name"] for index in inspector.get_indexes(table_name)}


def upgrade() -> None:
    if not _has_column("clinics", "entry_pin_hash"):
        op.add_column("clinics", sa.Column("entry_pin_hash", sa.String(), nullable=True))
    if not _has_column("clinics", "entry_pin_version"):
        op.add_column(
            "clinics",
            sa.Column("entry_pin_version", sa.Integer(), nullable=False, server_default="1"),
        )
        op.alter_column("clinics", "entry_pin_version", server_default=None)

    for index_name, table_name, columns in INDEXES:
        if not _has_index(table_name, index_name):
            op.create_index(index_name, table_name, list(columns))

    existing_by_table = {
        table_name: {index["name"] for index in sa.inspect(op.get_bind()).get_indexes(table_name)}
        for table_name in {
            "appointments",
            "clients",
            "contact_lens_orders",
            "families",
            "files",
            "orders",
            "referrals",
        }
    }
    for index_name, sql in DESC_INDEX_SQL:
        table_name = sql.split(" ON ", 1)[1].split(" ", 1)[0]
        if index_name not in existing_by_table.get(table_name, set()):
            op.execute(sa.text(sql))


def downgrade() -> None:
    pass
