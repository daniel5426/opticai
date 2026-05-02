# Backend Deployment Guide (Railway)

Last Updated: 2026-05-02

## Runtime

- Railway project: `opticai`
- Service: `opticai`
- Environments:
  - `staging` -> Supabase `opticai`
  - `production` -> Supabase `opticai-prod`
- Production API: `https://api.prysm.co.il`
- Staging API: `https://staging-api.prysm.co.il`

Railway builds only `backend/`. Config-as-code lives in `backend/railway.json`.

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

- Pushes to `main` deploy backend changes to Railway `staging` through GitHub Actions.
- Production deploys are manual from the `Backend Railway Deploy` workflow.
- Keep Heroku live until Railway production and a new desktop build are verified.

Manual CLI deploys, when needed:

```bash
railway up --ci --project fb97ce50-fb72-4612-bfd1-c6d8a7bed9cb --environment staging --service opticai --message "Manual staging deploy"
railway up --ci --project fb97ce50-fb72-4612-bfd1-c6d8a7bed9cb --environment production --service opticai --message "Manual production deploy"
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

Before production deploys with migrations:

1. Confirm a fresh Supabase production backup exists.
2. Confirm the current released desktop build works against staging.
3. Confirm migrations are backward-compatible.
