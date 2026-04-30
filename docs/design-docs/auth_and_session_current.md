# Auth And Session Current

Last Updated: 2026-04-30

## Summary
Auth is backend-owned. The OpticAI API issues access/refresh sessions and clinic trust tokens. Supabase is used for Postgres and Storage only.

## Main Components
- Auth state machine: [`src/lib/auth/AuthService.ts`](/Users/danielbenassaya/Code/personal/opticai/src/lib/auth/AuthService.ts)
- React auth context: [`src/contexts/UserContext.tsx`](/Users/danielbenassaya/Code/personal/opticai/src/contexts/UserContext.tsx)
- Route/layout enforcement: [`src/layouts/BaseLayout.tsx`](/Users/danielbenassaya/Code/personal/opticai/src/layouts/BaseLayout.tsx)

## Auth States
- `loading`
- `unauthenticated`
- `clinic_selected`
- `authenticated`
- `setup_required`

## Runtime Flow
- App boot restores only the backend access/refresh session through `/auth/me`.
- Clinic PIN validation creates a backend clinic trust token for the device.
- Clinic user selection uses backend quick/password/Google login endpoints.
- CEO/control-center users can keep company context without a clinic.
- Google OAuth tokens are sent to the backend for verification and encrypted storage.
- Local storage preserves only backend tokens, clinic trust, and UI context.

## Current Risks
- Several state transitions still depend on local storage and path/context persistence.
- This flow needs packaged Windows verification for:
  - email login
  - Google login
  - callback handling
  - clinic selection
  - logout
- Auth complexity is a launch-critical area because it gates the rest of the app.
