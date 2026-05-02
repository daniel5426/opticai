# How To Release Prysm

Last Updated: 2026-05-02

Production uses Railway for the backend, Supabase Postgres/Storage for data, Alembic for schema changes, and GitHub Actions for desktop release builds.

Never commit real `.env*` files. Production desktop env files are generated from GitHub Actions secrets.

## 1. Preflight

From the repo root:

```bash
git status --short
npm run test
```

For backend/schema work, also run locally against the intended non-production database first:

```bash
cd backend
python scripts/safe_migrate.py
cd ..
```

Before production backend deploy:

- Confirm Supabase `opticai-prod` has a fresh backup.
- Confirm Railway production variables point to Supabase `opticai-prod`.
- Confirm staging points to Supabase `opticai`, not production data.
- Confirm the current released desktop build still works against staging.
- Confirm GitHub Actions secrets include `VITE_API_URL=https://api.prysm.co.il/api/v1`.

## 2. Deploy Backend

Pushes to `main` deploy backend changes to Railway `staging` through `.github/workflows/backend-railway.yml`.

Production backend deploy is manual:

1. Open GitHub Actions.
2. Run `Backend Railway Deploy`.
3. Choose `production`.
4. Verify:

```bash
curl https://api.prysm.co.il/health
curl https://api.prysm.co.il/health/database
```

Staging verification:

```bash
curl https://staging-api.prysm.co.il/health
curl https://staging-api.prysm.co.il/health/database
```

## 3. Smoke Test

Before tagging the desktop release, verify against production backend:

- Clinic session login
- User login / user selection
- CEO password login and Google login
- Client create, edit, reload
- Exam create, save, reload
- Order create with billing line items
- Appointment create/edit
- File upload/read
- Search
- Google calendar connect/sync if that release touches Google auth
- Logout and restart session restore

Schema changes must come from Alembic. App startup must not create or alter tables.

## 4. Tag Desktop Release

```bash
npm version patch
git push origin main
git push origin --tags
```

Use `npm version minor` for meaningful feature releases and `npm version major` only for breaking release changes.

The tag must be `v*.*.*`; GitHub Actions builds the draft release from tags.

## 5. Publish Release

Watch:

- Actions: https://github.com/daniel5426/opticai/actions
- Releases: https://github.com/daniel5426/opticai/releases

When the workflow succeeds, confirm artifacts are attached, review notes, then publish the release.

## 6. Rollback

Backend rollback:

- Redeploy the previous known-good Railway deployment.
- If needed, temporarily keep existing clients on Heroku until the next desktop patch release.

Database rollback requires restoring the Supabase backup taken before migration. Do not run destructive downgrade migrations against production.

Desktop rollback:

- Keep the previous GitHub release available.
- If needed, publish a new patch release pointing users back to a known-good backend.

## Release Rules

- Backend changes must remain compatible with the currently installed desktop version.
- Backup production DB before every release with migrations.
- Rotate exposed secrets immediately; never paste real keys into docs.
- Do not use wildcard CORS in production unless `ALLOW_WILDCARD_CORS_IN_PRODUCTION=true` is set as a temporary emergency measure.
- Do not edit production DB schema manually except for emergency recovery with a recorded SQL transcript.
- Do not ship a desktop build unless backend health checks and clinic smoke test pass.
