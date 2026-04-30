# How To Release Prysm

Last Updated: 2026-04-30

Use this runbook for production releases. Production uses:
- Backend: Heroku
- Database: Supabase Postgres
- Schema changes: Alembic only
- Desktop builds: GitHub Actions release workflow

Never commit real `.env*` files. Production desktop env files are generated from GitHub Actions secrets.

## 1. Preflight

From the repo root:

```bash
git status --short
npm run test
```

For backend DB/schema work, also run:

```bash
cd backend
python scripts/safe_migrate.py
cd ..
```

Before production deploy:
- Confirm Supabase has a fresh backup.
- Confirm Heroku config has `APP_ENV=production`.
- Confirm Heroku `DATABASE_URL` points to Supabase Postgres, not SQLite.
- Confirm GitHub Actions secrets include:
  - `VITE_API_URL`
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - Google/update secrets used by the Electron app

## 2. Deploy Backend

Deploy only the backend folder to Heroku:

```bash
git subtree push --prefix backend heroku main
```

If Heroku rejects the subtree push because history diverged:

```bash
git push heroku `git subtree split --prefix backend main`:main --force
```

Run migrations after deploy:

```bash
heroku run python scripts/safe_migrate.py -a prysm-backend
```

Verify backend:

```bash
curl https://prysm-backend.herokuapp.com/health
curl https://prysm-backend.herokuapp.com/health/database
heroku logs -n 100 -a prysm-backend
```

## 3. Smoke Test

Before tagging the desktop release, verify against production backend:

- Clinic session login
- User login / user selection
- Client create, edit, reload
- Exam create, save, reload
- Order create with billing line items
- Appointment create/edit
- File upload/read
- Search
- Logout and restart session restore

If any schema change was included, confirm app startup did not create/alter tables by itself. Schema changes must come from Alembic.

## 4. Tag Desktop Release

Bump version and create a tag:

```bash
npm version patch
git push origin main
git push origin --tags
```

Use `npm version minor` for meaningful feature releases and `npm version major` only for breaking release changes.

The tag must be `v*.*.*`; GitHub Actions builds the draft release from tags.

## 5. Publish Release

Watch the workflow:

- Actions: https://github.com/daniel5426/opticai/actions
- Releases: https://github.com/daniel5426/opticai/releases

When the workflow succeeds:

1. Open the draft GitHub release.
2. Confirm Windows and macOS artifacts are attached.
3. Review generated release notes.
4. Publish the release.

## 6. Rollback

Backend rollback:

```bash
heroku releases -a prysm-backend
heroku rollback v123 -a prysm-backend
```

Database rollback requires restoring the Supabase backup taken before migration. Do not run destructive downgrade migrations against production.

Desktop rollback:
- Keep the previous GitHub release available.
- If needed, publish a new patch release pointing users back to a known-good build.

## Release Rules

- Backup production DB before every release with migrations.
- Rotate exposed secrets immediately; never paste real keys into docs.
- Do not use wildcard CORS in production unless explicitly setting `ALLOW_WILDCARD_CORS_IN_PRODUCTION=true` as a temporary emergency measure.
- Do not edit production DB schema manually except for emergency recovery with a recorded SQL transcript.
- Do not ship a desktop build unless backend health checks and clinic smoke test pass.
