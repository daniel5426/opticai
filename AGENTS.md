# Agent Instructions

- Be concise and respond in English unless the user asks otherwise.
- Preserve unrelated work. Do not run formatters or make formatting-only edits unless requested.
- Before UI changes, read only the relevant parts of `design.md` and reuse its page, toolbar, table, dialog, and RTL conventions.

## Internationalization And Direction

- Ship every changed user-visible string in Hebrew (`he`), English (`en`), and French (`fr`) through stable i18n keys.
- Verify affected UI intentionally in Hebrew RTL and English/French LTR. Prefer logical alignment and spacing classes; use physical directions only when the position is truly physical.
- Keep centered content centered across locales. Keep machine-readable values locally LTR when that improves readability.
- Pass the active direction to portalled or order-sensitive controls when their layout depends on it.

## Production Compatibility

- The application has active production users. For behavior or data changes, determine whether existing persisted data, APIs, caches, jobs, uploads, configuration, or schemas need compatibility handling.
- When a persisted shape changes, implement the smallest safe migration path and state the rollout requirements.
- After code edits, include one concise migration note. Use `Migration note: Not needed; ...` when no persisted or public contract changed.

## Database Migrations

- `backend/config.py` reads `DATABASE_URL`, usually from `backend/.env`. The configured target may be a shared Supabase database; inspect its backend, host, database, and username without printing credentials before any schema mutation.
- SQLAlchemy or Pydantic changes that alter the database schema require an Alembic migration under `backend/alembic/versions`.
- Keep migrations production-safe and prefer expand/migrate/contract sequencing for destructive changes.
- Do not automatically apply migrations to a shared or remote database merely because a migration was authored. Apply only when the requested task includes that environment mutation and the exact target is established.
- Let Alembic own schema state; do not add normal startup-time schema mutation guards. If schema state was changed manually, verify it before using an idempotent migration or stamp.
