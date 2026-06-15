"""recent clients prescription index merge

Revision ID: 0016_recent_search_merge
Revises: 0015_appointment_exam_layout_id
Create Date: 2026-06-15
"""
from __future__ import annotations

import json
from typing import Any, Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0016_recent_search_merge"
down_revision: Union[str, None] = "0015_appointment_exam_layout_id"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


PRESCRIPTION_CARD_TYPES = {
    "subjective",
    "final-subjective",
    "final-prescription",
    "compact-prescription",
    "addition",
    "old-refraction",
    "old-refraction-extension",
    "objective",
    "retinoscop",
    "retinoscop-dilation",
    "contact-lens-details",
    "contact-lens-exam",
    "old-contact-lenses",
    "over-refraction",
}
PRESCRIPTION_CARD_TYPE_PREFIXES = sorted(PRESCRIPTION_CARD_TYPES, key=len, reverse=True)


prescription_index_table = sa.table(
    "prescription_search_index",
    sa.column("source_type", sa.String),
    sa.column("source_id", sa.Integer),
    sa.column("client_id", sa.Integer),
    sa.column("clinic_id", sa.Integer),
    sa.column("exam_id", sa.Integer),
    sa.column("layout_instance_id", sa.Integer),
    sa.column("card_type", sa.String),
    sa.column("source_date", sa.Date),
    sa.column("eye", sa.String),
    sa.column("sph", sa.Float),
    sa.column("cyl", sa.Float),
    sa.column("ax", sa.Integer),
    sa.column("add", sa.Float),
    sa.column("va", sa.String),
    sa.column("pd", sa.Float),
)


def _json_payload(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


def _to_float(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_int(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _to_text(value: Any) -> str | None:
    if value in (None, ""):
        return None
    return str(value)


def _iter_components(payload: Any):
    payload = _json_payload(payload)
    for key, value in payload.items():
        if not isinstance(value, dict):
            continue
        key_text = str(key)
        card_type = next(
            (prefix for prefix in PRESCRIPTION_CARD_TYPE_PREFIXES if key_text == prefix or key_text.startswith(f"{prefix}-")),
            key_text,
        )
        explicit_type = value.get("type")
        if isinstance(explicit_type, str):
            card_type = explicit_type
        has_prescription_keys = any(
            f"{eye}_{field}" in value
            for eye in ("r", "l")
            for field in ("sph", "cyl", "ax", "add", "ad", "va", "pd")
        )
        if card_type in PRESCRIPTION_CARD_TYPES or has_prescription_keys:
            yield card_type, value


def _component_rows(component: dict[str, Any], base: dict[str, Any]) -> list[dict[str, Any]]:
    rows = []
    for prefix, eye in (("r", "R"), ("l", "L")):
        row = {
            **base,
            "eye": eye,
            "sph": _to_float(component.get(f"{prefix}_sph")),
            "cyl": _to_float(component.get(f"{prefix}_cyl")),
            "ax": _to_int(component.get(f"{prefix}_ax")),
            "add": _to_float(component.get(f"{prefix}_add") if component.get(f"{prefix}_add") is not None else component.get(f"{prefix}_ad")),
            "va": _to_text(component.get(f"{prefix}_va")),
            "pd": _to_float(component.get(f"{prefix}_pd")),
        }
        if any(row[field] is not None for field in ("sph", "cyl", "ax", "add", "va", "pd")):
            rows.append(row)
    return rows


def _insert_chunks(bind, rows: list[dict[str, Any]], chunk_size: int = 1000) -> None:
    for index in range(0, len(rows), chunk_size):
        bind.execute(prescription_index_table.insert(), rows[index : index + chunk_size])


def _backfill_json_source(bind, sql: str, payload_key: str, base_for_row, batch_size: int = 500) -> None:
    last_id = 0
    while True:
        batch = bind.execute(sa.text(sql), {"last_id": last_id, "limit": batch_size}).mappings().all()
        if not batch:
            return

        rows: list[dict[str, Any]] = []
        for row in batch:
            for card_type, component in _iter_components(row[payload_key]):
                rows.extend(_component_rows(component, {**base_for_row(row), "card_type": card_type}))
        _insert_chunks(bind, rows)
        last_id = batch[-1]["row_id"]


def _backfill_referral_eye(bind, batch_size: int = 500) -> None:
    last_id = 0
    while True:
        batch = bind.execute(sa.text("""
            SELECT re.id AS row_id, re.*, r.client_id, r.clinic_id, r.date
            FROM referral_eye re
            JOIN referrals r ON r.id = re.referral_id
            WHERE re.id > :last_id AND r.client_id IS NOT NULL AND r.clinic_id IS NOT NULL
            ORDER BY re.id
            LIMIT :limit
        """), {"last_id": last_id, "limit": batch_size}).mappings().all()
        if not batch:
            return

        rows = []
        for row in batch:
            rows.append({
                "source_type": "referral",
                "source_id": row["referral_id"],
                "client_id": row["client_id"],
                "clinic_id": row["clinic_id"],
                "exam_id": None,
                "layout_instance_id": None,
                "card_type": "referral-eye",
                "source_date": row["date"],
                "eye": "R" if str(row["eye"]).upper().startswith("R") else "L",
                "sph": row["sph"],
                "cyl": row["cyl"],
                "ax": row["ax"],
                "add": row["add_power"],
                "va": str(row["va"]) if row["va"] is not None else None,
                "pd": row["pd"],
            })
        _insert_chunks(bind, rows)
        last_id = batch[-1]["row_id"]


def _backfill_prescription_index() -> None:
    bind = op.get_bind()

    _backfill_json_source(bind, """
        SELECT ei.id AS row_id, ei.id AS layout_instance_id, ei.exam_id, ei.exam_data, e.client_id, e.clinic_id, e.exam_date
        FROM exam_layout_instances ei
        JOIN optical_exams e ON e.id = ei.exam_id
        WHERE ei.id > :last_id AND e.client_id IS NOT NULL AND e.clinic_id IS NOT NULL
        ORDER BY ei.id
        LIMIT :limit
    """, "exam_data", lambda row: {
        "source_type": "exam",
        "source_id": row["layout_instance_id"],
        "client_id": row["client_id"],
        "clinic_id": row["clinic_id"],
        "exam_id": row["exam_id"],
        "layout_instance_id": row["layout_instance_id"],
        "source_date": row["exam_date"],
    })

    _backfill_json_source(bind, """
        SELECT o.id AS row_id, o.id, o.order_data, o.client_id, o.clinic_id, o.order_date
        FROM orders o
        WHERE o.id > :last_id AND o.client_id IS NOT NULL AND o.clinic_id IS NOT NULL
        ORDER BY o.id
        LIMIT :limit
    """, "order_data", lambda row: {
        "source_type": "order",
        "source_id": row["id"],
        "client_id": row["client_id"],
        "clinic_id": row["clinic_id"],
        "exam_id": None,
        "layout_instance_id": None,
        "source_date": row["order_date"],
    })

    _backfill_json_source(bind, """
        SELECT o.id AS row_id, o.id, o.order_data, o.client_id, o.clinic_id, o.order_date
        FROM contact_lens_orders o
        WHERE o.id > :last_id AND o.client_id IS NOT NULL AND o.clinic_id IS NOT NULL
        ORDER BY o.id
        LIMIT :limit
    """, "order_data", lambda row: {
        "source_type": "contact_lens_order",
        "source_id": row["id"],
        "client_id": row["client_id"],
        "clinic_id": row["clinic_id"],
        "exam_id": None,
        "layout_instance_id": None,
        "source_date": row["order_date"],
    })

    _backfill_json_source(bind, """
        SELECT r.id AS row_id, r.id, r.referral_data, r.client_id, r.clinic_id, r.date
        FROM referrals r
        WHERE r.id > :last_id AND r.client_id IS NOT NULL AND r.clinic_id IS NOT NULL
        ORDER BY r.id
        LIMIT :limit
    """, "referral_data", lambda row: {
        "source_type": "referral",
        "source_id": row["id"],
        "client_id": row["client_id"],
        "clinic_id": row["clinic_id"],
        "exam_id": None,
        "layout_instance_id": None,
        "source_date": row["date"],
    })

    _backfill_referral_eye(bind)


def upgrade() -> None:
    op.add_column("clients", sa.Column("merged_into_client_id", sa.Integer(), nullable=True))
    op.add_column("clients", sa.Column("merged_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("clients", sa.Column("merged_by_user_id", sa.Integer(), nullable=True))
    op.add_column("clients", sa.Column("merge_snapshot", sa.JSON(), nullable=True))
    op.create_foreign_key("fk_clients_merged_into_client_id_clients", "clients", "clients", ["merged_into_client_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_clients_merged_by_user_id_users", "clients", "users", ["merged_by_user_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_clients_merged_into_client_id", "clients", ["merged_into_client_id"])

    op.create_table(
        "recent_client_visits",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("clinic_id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("visited_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_recent_client_visits_user_clinic_visited", "recent_client_visits", ["user_id", "clinic_id", "visited_at"])
    op.create_index("uq_recent_client_visits_user_clinic_client", "recent_client_visits", ["user_id", "clinic_id", "client_id"], unique=True)

    op.create_table(
        "prescription_search_index",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_type", sa.String(), nullable=False),
        sa.Column("source_id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("clinic_id", sa.Integer(), nullable=False),
        sa.Column("exam_id", sa.Integer(), nullable=True),
        sa.Column("layout_instance_id", sa.Integer(), nullable=True),
        sa.Column("card_type", sa.String(), nullable=True),
        sa.Column("source_date", sa.Date(), nullable=True),
        sa.Column("eye", sa.String(), nullable=False),
        sa.Column("sph", sa.Float(), nullable=True),
        sa.Column("cyl", sa.Float(), nullable=True),
        sa.Column("ax", sa.Integer(), nullable=True),
        sa.Column("add", sa.Float(), nullable=True),
        sa.Column("va", sa.String(), nullable=True),
        sa.Column("pd", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["exam_id"], ["optical_exams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["layout_instance_id"], ["exam_layout_instances.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_prescription_search_client", "prescription_search_index", ["client_id"])
    op.create_index("ix_prescription_search_clinic_eye_values", "prescription_search_index", ["clinic_id", "eye", "sph", "cyl", "ax"])
    op.create_index("ix_prescription_search_source", "prescription_search_index", ["source_type", "source_id"])
    # Historical indexing is intentionally handled by the dedicated maintenance
    # script so this production schema migration stays quick and low-risk.


def downgrade() -> None:
    op.drop_index("ix_prescription_search_source", table_name="prescription_search_index")
    op.drop_index("ix_prescription_search_clinic_eye_values", table_name="prescription_search_index")
    op.drop_index("ix_prescription_search_client", table_name="prescription_search_index")
    op.drop_table("prescription_search_index")
    op.drop_index("uq_recent_client_visits_user_clinic_client", table_name="recent_client_visits")
    op.drop_index("ix_recent_client_visits_user_clinic_visited", table_name="recent_client_visits")
    op.drop_table("recent_client_visits")
    op.drop_index("ix_clients_merged_into_client_id", table_name="clients")
    op.drop_constraint("fk_clients_merged_by_user_id_users", "clients", type_="foreignkey")
    op.drop_constraint("fk_clients_merged_into_client_id_clients", "clients", type_="foreignkey")
    op.drop_column("clients", "merge_snapshot")
    op.drop_column("clients", "merged_by_user_id")
    op.drop_column("clients", "merged_at")
    op.drop_column("clients", "merged_into_client_id")
