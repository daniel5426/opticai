# Agent Instructions

- Be concise and to the point. Avoid long, repetitive descriptions.
- Always respond in English unless the user explicitly asks for another language.

## Production Compatibility And Migrations

- The app is in production and clients are actively using it. Treat every code edit as production-impacting.
- For every code edit, explicitly decide whether any migration or compatibility handling is needed.
- "Migration" means any change needed to keep existing production users and data working with the new code, including database schema changes, persisted JSON/form shape changes, API contract changes, cached/local storage changes, background job payload changes, uploaded file format changes, config/env changes, or one-time backfills/reshapes.
- If persisted app data changes shape, add a safe migration path such as a backfill, lazy read-time upgrade, first-save reshape, dual-read/dual-write compatibility, or explicit versioned transformer.
- Every final response after code edits must include a short migration note, even when no migration is needed.
  - Example: `Migration note: Not needed; no persisted data, API contract, config, cache, or schema compatibility changes.`
  - Example: `Migration note: Needed; added read-time form reshape for existing saved forms and an Alembic migration <revision>. Production rollout still needs approval.`

## Local Backend Database Migrations

- In local development, the backend reads `DATABASE_URL` through `backend/config.py`, usually from `backend/.env`.
- The current local backend is configured to use Supabase staging Postgres, not local SQLite.
- Before changing backend schema, verify the effective database target without printing credentials:

```bash
cd /Users/danielbenassaya/Code/personal/opticai
PYTHONPATH=backend backend/.venv/bin/python - <<'PY'
from sqlalchemy.engine import make_url
from config import settings
url = make_url(settings.DATABASE_URL)
print("backend:", url.get_backend_name())
print("driver:", url.drivername)
print("host:", url.host)
print("port:", url.port)
print("database:", url.database)
print("username:", url.username)
PY
```

- When editing SQLAlchemy models or Pydantic schemas in a way that changes the DB schema:
  - Add an Alembic migration under `backend/alembic/versions`.
  - Keep migrations production-safe: avoid destructive changes unless explicitly approved, prefer backward-compatible expand/migrate/contract steps, and call out any required production rollout order.
  - Run the migration against the configured staging DB:

```bash
cd /Users/danielbenassaya/Code/personal/opticai/backend
.venv/bin/python -m alembic current
.venv/bin/python -m alembic heads
.venv/bin/python -m alembic upgrade head
.venv/bin/python -m alembic current
```

- `backend/alembic/env.py` overrides `alembic.ini` and uses `config.settings.DATABASE_URL`, so Alembic targets the same DB as the backend.
- Do not add runtime schema mutation guards in app startup for normal schema changes. Let Alembic own schema state.
- If a column was manually added before Alembic ran, make the migration idempotent or stamp only after confirming the schema matches the migration.
