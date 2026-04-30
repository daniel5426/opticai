"""Run Alembic safely against empty or existing production databases."""
from __future__ import annotations

from pathlib import Path
import sys

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from database import engine  # noqa: E402
from models import Base  # noqa: E402

BASELINE_REVISION = "0001_baseline_current_schema"
ALLOWED_BASELINE_DRIFT = {
    "clinics": {"entry_pin_hash", "entry_pin_version"},
}


def _alembic_config() -> Config:
    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "alembic"))
    return cfg


def _app_tables(inspector) -> set[str]:
    ignored = {"alembic_version"}
    return set(inspector.get_table_names()) - ignored


def _verify_existing_schema(inspector) -> None:
    expected_tables = set(Base.metadata.tables.keys())
    existing_tables = _app_tables(inspector)
    missing_tables = sorted(expected_tables - existing_tables)
    if missing_tables:
        raise RuntimeError(
            "Existing database is missing model tables; refusing to stamp baseline: "
            + ", ".join(missing_tables[:20])
        )

    missing_columns: list[str] = []
    for table_name, table in Base.metadata.tables.items():
        existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
        allowed = ALLOWED_BASELINE_DRIFT.get(table_name, set())
        for column_name in table.columns.keys():
            if column_name not in existing_columns and column_name not in allowed:
                missing_columns.append(f"{table_name}.{column_name}")
    if missing_columns:
        raise RuntimeError(
            "Existing database has schema drift outside the launch guard migration: "
            + ", ".join(missing_columns[:30])
        )


def main() -> None:
    cfg = _alembic_config()
    inspector = inspect(engine)
    app_tables = _app_tables(inspector)
    has_alembic_version = "alembic_version" in inspector.get_table_names()

    if not app_tables:
        print("Database has no app tables; running full Alembic upgrade.")
        command.upgrade(cfg, "head")
        return

    if not has_alembic_version:
        print("Existing app schema has no Alembic version; verifying and stamping baseline.")
        _verify_existing_schema(inspector)
        command.stamp(cfg, BASELINE_REVISION)

    print("Running Alembic upgrade to head.")
    command.upgrade(cfg, "head")


if __name__ == "__main__":
    main()
