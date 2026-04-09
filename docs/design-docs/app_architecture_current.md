# App Architecture Current

Last Updated: 2026-04-09

## Summary
OpticAI is a desktop app with three runtime layers:
- Electron main process for app lifecycle, updater, Google OAuth/calendar IPC, and scheduler helpers
- React renderer for all app UI and workflow orchestration
- FastAPI backend in the same repo for auth, core CRUD, AI endpoints, control-center analytics, and integration-facing APIs

## Main Runtime Layers
- Electron shell
  - Entrypoints: [`src/main.ts`](/Users/danielbenassaya/Code/personal/opticai/src/main.ts), [`src/preload.ts`](/Users/danielbenassaya/Code/personal/opticai/src/preload.ts)
  - Responsibilities: window creation, env loading, updater, desktop IPC, Google calendar operations, campaign/email scheduler wiring
- Renderer app
  - Entrypoints: [`src/renderer.tsx`](/Users/danielbenassaya/Code/personal/opticai/src/renderer.tsx), [`src/App.tsx`](/Users/danielbenassaya/Code/personal/opticai/src/App.tsx), [`src/routes/routes.tsx`](/Users/danielbenassaya/Code/personal/opticai/src/routes/routes.tsx)
  - Responsibilities: routing, auth-aware layout switching, clinic workflows, settings, AI UI, exam editing
- API backend
  - Entrypoint: [`backend/main.py`](/Users/danielbenassaya/Code/personal/opticai/backend/main.py)
  - Responsibilities: data model, API surface, auth, CRUD, search, AI assistant endpoints, control-center metrics, WhatsApp webhook

## Main UI Surfaces
- Control center and first-run setup
- Clinic dashboard/calendar
- Clients and family context
- Exams and exam layouts
- Orders and DOCX output
- Referrals and files
- Settings and integrations
- AI assistant, campaigns, worker stats

## Current Architectural Characteristics
- TanStack Router drives the full renderer route surface.
- Layout selection is largely path-based in [`src/layouts/BaseLayout.tsx`](/Users/danielbenassaya/Code/personal/opticai/src/layouts/BaseLayout.tsx).
- The frontend uses `apiClient` for most backend access, but there are still legacy abstractions and some stale IPC exposure.
- Production env loading is split between Electron runtime env files and backend env files.

## Current Debt And Risks
- Root docs and README were stale until this pass.
- `BrowserWindow` keeps `devTools: true` in production.
- Preload still exposes server-mode APIs and chat APIs that are not part of the current primary path.
- Renderer bundle size is large; build output shows ineffective lazy-loading for exam components because several tabs are imported both statically and dynamically.
- The app surface is broader than the current automated test confidence.
