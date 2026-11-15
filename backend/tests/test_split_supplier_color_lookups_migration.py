import importlib.util
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "development-secret-for-tests-only")
os.environ.setdefault("TOKEN_ENCRYPTION_KEY", "development-encryption-key-for-tests")

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, text


def _migration():
    path = BACKEND_DIR / "alembic/versions/0069_split_supplier_color_lookups.py"
    spec = importlib.util.spec_from_file_location("split_lookups_migration", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_existing_clinics_get_their_shared_lists_in_both_new_lists_and_keep_the_old_ones(tmp_path):
    migration = _migration()
    engine = create_engine("sqlite:///" + str(tmp_path / "migration.sqlite"))
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE clinics (id INTEGER PRIMARY KEY)"))
        for table in ("lookup_supplier", "lookup_color"):
            connection.execute(text(f"CREATE TABLE {table} (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, created_at DATETIME, clinic_id INTEGER NOT NULL)"))
        connection.execute(text("INSERT INTO clinics VALUES (1), (2)"))
        connection.execute(text("INSERT INTO lookup_supplier (name, clinic_id) VALUES ('Hoya', 1), ('Bausch', 1), ('Shamir', 2)"))
        connection.execute(text("INSERT INTO lookup_color (name, clinic_id) VALUES ('Brown', 1)"))

        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            rows = lambda table: sorted(connection.execute(text(f"SELECT clinic_id, name FROM {table}")).all())
            for table in ("lookup_frame_supplier", "lookup_contact_lens_supplier"):
                assert rows(table) == [(1, "Bausch"), (1, "Hoya"), (2, "Shamir")]
            for table in ("lookup_frame_color", "lookup_contact_lens_color"):
                assert rows(table) == [(1, "Brown")]
            # The glasses lens lists are untouched.
            assert rows("lookup_supplier") == [(1, "Bausch"), (1, "Hoya"), (2, "Shamir")]
            assert rows("lookup_color") == [(1, "Brown")]

            migration.downgrade()
            assert "lookup_frame_supplier" not in inspect(connection).get_table_names()
            assert rows("lookup_supplier") == [(1, "Bausch"), (1, "Hoya"), (2, "Shamir")]


def test_the_new_tables_match_the_models():
    from database import Base
    import models  # noqa: F401

    for table in ("lookup_frame_supplier", "lookup_contact_lens_supplier", "lookup_frame_color", "lookup_contact_lens_color"):
        model = Base.metadata.tables[table]
        assert [column.name for column in model.columns] == ["id", "name", "created_at", "clinic_id"]
        assert {constraint.name for constraint in model.constraints if constraint.name} >= {f"uq_{table}_clinic_name"}
        assert {index.name for index in model.indexes} == {f"ix_{table}_id", f"ix_{table}_clinic_id", f"ix_{table}_clinic_name", f"ix_{table}_clinic_id_id"}
