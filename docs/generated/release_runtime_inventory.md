# Release And Runtime Inventory

Last Updated: 2026-04-30

## Build And Release Commands
- `npm run build`
  - Observed result: passes
  - Notes: renderer bundle is large; exam lazy-loading warnings appear; macOS packaging runs locally
- `npm run build:win`
  - Intended Windows packaging command for local verification
- `npm run dist:win`
  - Intended Windows distributable path
- GitHub release workflow
  - File: [`.github/workflows/release.yml`](/Users/danielbenassaya/Code/personal/opticai/.github/workflows/release.yml)
  - Current intent: build release artifacts from version tags and publish GitHub release assets

## Runtime Env Inputs Observed
- Desktop env files:
  - [`.env.development`](/Users/danielbenassaya/Code/personal/opticai/.env.development)
  - [`.env.production`](/Users/danielbenassaya/Code/personal/opticai/.env.production)
- Backend env/docs:
  - [`backend/.env`](/Users/danielbenassaya/Code/personal/opticai/backend/.env)
  - [`backend/DEPLOYMENT.md`](/Users/danielbenassaya/Code/personal/opticai/backend/DEPLOYMENT.md)
  - [`backend/setup.md`](/Users/danielbenassaya/Code/personal/opticai/backend/setup.md)

## Key Runtime Assumptions
- Electron production loads `.env.production` from app resources.
- Renderer uses `VITE_API_URL` to reach the hosted backend.
- Desktop env files contain `VITE_API_URL` and Google desktop OAuth credentials only.
- Supabase credentials are backend-only for Postgres/Storage.
- Auto-updater is configured against GitHub releases.

## Baseline Check Results
| Check | Result | Notes |
| --- | --- | --- |
| `npm run test` | Pass | Minimal unit coverage only |
| `npm run test:e2e` | Fail | Template-era Playwright test expects `out/` and template UI strings |
| `npm run build` | Pass | Build warnings around bundle size and exam lazy-loading |
| `npm run lint` | Not a reliable quick gate yet | Project-wide run did not return promptly after build; current config is extremely broad and minimal |

## Packaging Notes
- Local macOS packaging completes, but code signing is skipped when no valid Developer ID identity is present.
- Next week’s launch target is Windows first, so installer and updater validation on Windows should outrank macOS polish.
