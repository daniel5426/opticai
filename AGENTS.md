# Agent Instructions

- Be concise and to the point. Avoid long, repetitive descriptions.
- Always respond in English unless the user explicitly asks for another language.

## Local Backend Database And Migrations

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
