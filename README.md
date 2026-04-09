# OpticAI

Last Updated: 2026-04-09

OpticAI is a Windows-first Electron desktop application for optical clinics. It combines a React/TanStack Router renderer, an Electron shell for desktop-only capabilities, and an in-repo FastAPI backend that owns the API, auth, data model, AI endpoints, and several integration workflows.

## What The App Covers
- Clinic operations: clients, appointments, exams, orders, referrals, files, settings
- Company/admin surfaces: control center dashboard, clinics, users, settings
- Assistive and growth surfaces: AI assistant, campaigns, worker stats
- Desktop-only capabilities: updater flow, Google OAuth callback handling, email/campaign schedulers, DOCX generation

## Architecture
- Renderer: React 19, TanStack Router, Tailwind 4, shadcn/ui
- Desktop shell: Electron 35 with preload IPC and `electron-updater`
- Backend: FastAPI app under [`backend/main.py`](/Users/danielbenassaya/Code/personal/opticai/backend/main.py)
- Auth: Supabase session + backend `/auth/me` + local clinic/user session state
- Data: backend API is the source of truth; frontend still contains some legacy/local abstractions

## Repo Entry Points
- Frontend app: [`src/App.tsx`](/Users/danielbenassaya/Code/personal/opticai/src/App.tsx)
- Route map: [`src/routes/routes.tsx`](/Users/danielbenassaya/Code/personal/opticai/src/routes/routes.tsx)
- Electron main: [`src/main.ts`](/Users/danielbenassaya/Code/personal/opticai/src/main.ts)
- Electron preload: [`src/preload.ts`](/Users/danielbenassaya/Code/personal/opticai/src/preload.ts)
- Backend app: [`backend/main.py`](/Users/danielbenassaya/Code/personal/opticai/backend/main.py)
- Canonical docs hub: [`docs/README.md`](/Users/danielbenassaya/Code/personal/opticai/docs/README.md)

## Scripts
- `npm run dev`: start renderer dev flow
- `npm run build`: production build + local packaging dir
- `npm run build:win`: Windows packaging build
- `npm run dist:win`: Windows distributable build
- `npm run test`: Vitest unit tests
- `npm run test:e2e`: Playwright Electron tests
- `npm run lint`: project-wide ESLint run

## Current Readiness Signals
- `npm run test`: passes, but only minimal unit coverage exists
- `npm run test:e2e`: not a valid gate yet; it still points at template-era assumptions and fails looking for `out/`
- `npm run build`: passes
- Build output shows a very large renderer bundle and ineffective exam component code-splitting
- Root docs and some test/tooling surfaces were still template-era until this docs pass

## Release Notes
- The current release pipeline is defined in [`.github/workflows/release.yml`](/Users/danielbenassaya/Code/personal/opticai/.github/workflows/release.yml)
- Windows is the primary launch target for next week
- macOS packaging works locally, but signing is currently skipped without a valid Developer ID identity

## Documentation
- Docs hub: [`docs/README.md`](/Users/danielbenassaya/Code/personal/opticai/docs/README.md)
- Current-state architecture: [`docs/design-docs/index.md`](/Users/danielbenassaya/Code/personal/opticai/docs/design-docs/index.md)
- Generated inventories and audit matrices: [`docs/generated/index.md`](/Users/danielbenassaya/Code/personal/opticai/docs/generated/index.md)
- Launch cleanup plan: [`docs/exec-plans/active/production_readiness_launch_plan.md`](/Users/danielbenassaya/Code/personal/opticai/docs/exec-plans/active/production_readiness_launch_plan.md)
