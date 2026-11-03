"""The worker must remain usable before the API's newer migrations deploy."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "isolated-worker-compatibility")

from sqlalchemy import create_engine, text
from models import Base
from workers import softoptic_migration_worker as worker


def test_old_schema_keeps_existing_import_queue_running(monkeypatch):
    engine = create_engine("sqlite:///:memory:")
    try:
        queues = worker.available_optional_queues(engine)
        calls = []
        def forbidden(_):
            raise AssertionError("An unmigrated queue must not be polled")
        monkeypatch.setattr(worker, "run_trash_once", forbidden)
        monkeypatch.setattr(worker, "run_catalog_discovery_once", forbidden)
        monkeypatch.setattr(worker, "run_prune_once", lambda name: False)
        monkeypatch.setattr(worker, "run_once", lambda name: calls.append(name) or True)
        assert worker.poll_once("old-schema-worker", queues)
        assert calls == ["old-schema-worker"]
        # Discovery's first table alone does not make the entire queue ready.
        with engine.begin() as connection:
            connection.execute(text("CREATE TABLE catalog_discovery_runs (id INTEGER PRIMARY KEY)"))
        assert "catalog" not in worker.available_optional_queues(engine)
    finally:
        engine.dispose()


def test_restarted_worker_polls_new_queues_after_migrations(monkeypatch):
    engine = create_engine("sqlite:///:memory:")
    try:
        Base.metadata.create_all(engine)
        queues = worker.available_optional_queues(engine)
        calls = []
        for method in ("run_trash_once", "run_prune_once", "run_catalog_discovery_once", "run_once"):
            monkeypatch.setattr(worker, method, lambda name, method=method: calls.append(method) or False)
        assert not worker.poll_once("migrated-worker", queues)
        assert calls == ["run_trash_once", "run_prune_once", "run_catalog_discovery_once", "run_once"]
    finally:
        engine.dispose()
