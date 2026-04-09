# Auth And Session Current

Last Updated: 2026-04-09

## Summary
Auth is a hybrid state machine:
- Supabase authenticates the top-level user identity
- backend `/auth/me` resolves the application user
- local storage preserves clinic and clinic-user context for day-to-day operation

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
- App boot checks Supabase session first.
- If Supabase exists, backend user lookup runs through `apiClient.getCurrentUser()`.
- CEO/control-center users can keep company context without a clinic.
- Clinic session is also persisted locally to support clinic/user selection behavior.
- OAuth callback routes are special-cased to avoid full app boot logic.

## Current Risks
- Several state transitions depend on local storage and path/context persistence.
- This flow needs packaged Windows verification for:
  - email login
  - Google login
  - callback handling
  - clinic selection
  - logout
- Auth complexity is a launch-critical area because it gates the rest of the app.
