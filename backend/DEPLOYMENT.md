# Backend Deployment Guide (Railway)

Last Updated: 2026-05-11

## Runtime

- Railway project: `opticai`
- Backend service: `opticai`
- Production SoftOptic worker service: `softoptic-migration-worker-Z2hA`
- Staging SoftOptic worker service: `softoptic-migration-worker`
- Production web service: `prysm-web`
- Staging web service: `prysm-web-staging`
- Environments:
  - `staging` -> Supabase `opticai`
  - `production` -> Supabase `opticai-prod`
- Production API: `https://api.prysm.co.il`
- Staging API: `https://staging-api.prysm.co.il`
- Staging web: `https://prysm-web-staging-staging.up.railway.app`

Railway builds the backend API and SoftOptic workers from `backend/`.
The API starts with `uvicorn main:app --host 0.0.0.0 --port $PORT`.
The SoftOptic workers start with `python -m workers.softoptic_migration_worker`.
Config-as-code for the API lives in `backend/railway.json`.
Config-as-code for the workers lives in `backend/railway.worker.json`; worker services must use that config file and must not run `safe_migrate.py`.

Production uses Supabase direct Postgres over IPv6 because the `opticai-prod` Supabase pooler endpoint timed out from Railway during migration. Keep `ipv6EgressEnabled` enabled in Railway config.

## Required Variables

Set these per Railway environment:

```text
APP_ENV
ACCESS_TOKEN_EXPIRE_MINUTES
DATABASE_URL
SECRET_KEY
TOKEN_ENCRYPTION_KEY
BACKEND_CORS_ORIGINS
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_KEY
SUPABASE_BUCKET
OPENAI_API_KEY
RAILPACK_PYTHON_VERSION
```

Google, WhatsApp, and Facebook variables are optional unless the release touches those integrations.

## Deploy Flow

- Pushes to `main` auto-deploy staging directly through Railway's GitHub integration.
- Staging auto-deploy is enabled for `opticai`, `softoptic-migration-worker`, and `prysm-web-staging`; watch paths prevent unrelated services from rebuilding.
- The `Backend CI` and `Web CI` workflows test pushes and pull requests but do not deploy.
- After Railway staging finishes, manually run `Verify Staging and Build Desktop` with the full tested Git SHA. It verifies all staging deployments and health endpoints before publishing the staging desktop prerelease.
- Production promotion is manual from `Promote Tested Commit to Production`. It requires the staging-verified SHA and confirmation of a fresh production database backup.
- Production deploy order is API (including Alembic), health checks, SoftOptic worker, then web. All services use the same tested commit.
- Desktop production releases remain tag-driven through `Release Build` and must only be tagged after the production promotion and smoke test succeed.
- Railway production services must not autodeploy from `main`; they are pinned to the non-working trigger branch `manual-production-only` so production only changes through explicit workflow dispatch.
- Keep Heroku live until Railway production and a new desktop build are verified.

Do not add `railway up` staging steps back to GitHub Actions while Railway staging auto-deploy is enabled. Running both mechanisms creates duplicate deployments, `SKIPPED` results, and misleading CI failures when Railway cannot stream logs.

Manual CLI deploys, when needed:

```bash
railway up --detach --project fb97ce50-fb72-4612-bfd1-c6d8a7bed9cb --environment staging --service opticai --message "Manual staging deploy"
railway up --detach --project fb97ce50-fb72-4612-bfd1-c6d8a7bed9cb --environment staging --service softoptic-migration-worker --message "Manual staging SoftOptic worker deploy"
railway up --detach --project fb97ce50-fb72-4612-bfd1-c6d8a7bed9cb --environment production --service opticai --message "Manual production deploy"
railway up --detach --project fb97ce50-fb72-4612-bfd1-c6d8a7bed9cb --environment production --service softoptic-migration-worker-Z2hA --message "Manual production SoftOptic worker deploy"
railway up --detach --project fb97ce50-fb72-4612-bfd1-c6d8a7bed9cb --environment staging --service prysm-web-staging --message "Manual staging web deploy"
railway up --detach --project fb97ce50-fb72-4612-bfd1-c6d8a7bed9cb --environment production --service prysm-web --message "Manual production web deploy"
```

## DNS

Add the DNS records Railway reports for:

```text
CNAME api         -> dhgajqlu.up.railway.app
CNAME staging-api -> c5mltt5v.up.railway.app
```

Railway ownership verification and certificates are active. If Railway asks to re-verify ownership, use:

```text
TXT _railway-verify.api         -> railway-verify=3e394d7df0f641c5b96081cd7f5f6db14ebfb5ec31e9c075e8efee0ab1b01e52
TXT _railway-verify.staging-api -> railway-verify=e4de5d0f06d0715934b29ff01014d133f3f2eac146a5ea7cee8adf4bb58cbdb9
```

If using Cloudflare, keep the records DNS-only until Railway certificates are active.

## Verification

```bash
curl https://staging-api.prysm.co.il/health
curl https://staging-api.prysm.co.il/health/database
curl https://api.prysm.co.il/health
curl https://api.prysm.co.il/health/database
```

SoftOptic worker verification:

```bash
railway logs --environment staging --service softoptic-migration-worker --lines 100 --json
railway logs --environment production --service softoptic-migration-worker-Z2hA --lines 100 --json
```

Worker logs should show `SoftOptic migration worker started id=...` and must not show `npm run start:web`.

Before production promotion:

1. Confirm a fresh Supabase production backup exists.
2. Confirm `Verify Staging and Build Desktop` succeeded for the exact SHA being promoted.
3. Confirm the current released desktop build works against staging.
4. Confirm migrations are backward-compatible.


## Shared order groups (0041)

Shared order groups and the redesigned workspace are available after migration
0041 is applied. `/order-groups/capabilities` checks the required tables and
columns before enabling the frontend; it never changes the schema. Until then,
the all-orders list retains its legacy paginated read path. This fallback does
not replace the migration required by the new backend models and write paths.
There is no environment flag to enable groups. Older Electron binaries keep their
individual-order UI and use the preserved legacy API contracts.

Before applying Alembic, confirm the database backend, host, database and username
without exposing credentials, and take a fresh backup. The migration preflights
duplicate/ambiguous invoice links and aborts before schema changes; resolve its
reported rows explicitly, without automatically merging invoices. It backfills
one group per historical order, preserving IDs, clinical JSON, inventory, trash,
notes, invoice currencies and payments. The migration was verified against an
isolated PostgreSQL database. Revision 0041 was applied to the staging `opticai`
project on 2026-10-18 after explicit authorization. Verification covered all
786,165 historical orders and unchanged original order, invoice, line-item, and
payment content. Production was not changed.

After migration, the group list also includes unlinked legacy/imported orders
in its filters, totals, and pagination without writing records during GETs. Opening
one uses the existing resolve endpoint to link its original order and invoice.

Deploy the additive migration and compatibility API first, including all import
workers that create orders. Smoke-test the currently released desktop version's
single-order writes, shared-group read access, and rejected shared-group writes.
Then ship the new frontend. Existing single-entry orders remain writable through
legacy APIs. Once an order group requires multi-order handling, older binaries
can read its selected order and shared billing, but incompatible writes are
rejected through their existing error handling. This protection remains even
after returning to one tab. A frontend rollback must retain the compatibility
backend/schema and these write protections. Do not downgrade/drop the shared
financial history.

Migration note: Required; additive tables/columns and historical single-order
backfill. Existing orders and invoices are not merged automatically.
