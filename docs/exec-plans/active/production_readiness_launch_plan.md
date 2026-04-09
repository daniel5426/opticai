# Production Readiness Launch Plan

Last Updated: 2026-04-09

## Summary
This is the one-week cleanup plan for a Windows-first client launch. It is driven by the generated readiness matrix and blocker matrix, not by code ownership alone.

## Must Fix Before Launch
- Release tooling and Windows packaging
  - Replace the current false-confidence test/release baseline.
  - Acceptance:
    - Windows packaging command succeeds on the intended release path.
    - Installer/update flow is smoke-tested on Windows.
    - release notes and asset expectations in GitHub Actions match the actual build output.
- Auth, session, and first-run entry
  - Validate email auth, Google auth, callback handling, clinic selection, logout, and control-center entry in packaged app context.
  - Acceptance:
    - no auth dead-end on `/control-center`, `/auth/callback`, `/oauth/callback`, or `/user-selection`
    - session restore behaves predictably after restart
- Core clinic workflows
  - Validate clients, appointments, exams, orders, referrals, files, settings.
  - Acceptance:
    - every primary workflow can create, edit, save, reload, and navigate back safely
    - failure states and missing-data cases do not strand the operator
- Exam and document generation path
  - Validate exam detail/edit flows, layout instance behavior, and regular/contact order DOCX output.
  - Acceptance:
    - exam save/load is reliable
    - order document generation works with packaged templates
- Backend and environment reconciliation
  - Confirm backend deployment docs, runtime env assumptions, and production endpoint expectations.
  - Acceptance:
    - release checklist lists the real env inputs and backend dependencies
    - health checks and launch-critical endpoints are verified

## Guard Or Reduce Scope
- Campaigns
  - If messaging configuration is incomplete, keep campaign UI but disable production execution or clearly restrict channels.
- AI assistant
  - If clinic-safe behavior is not validated, keep it internal-only or gate it behind role/access messaging.
- Worker stats
  - Hide or down-rank if not validated as launch-critical.
- SMS
  - Do not present SMS as production-ready while renderer service remains dummy-backed.
- Non-essential desktop/server-mode surfaces
  - Hide settings or controls that rely on stale IPC if they are not part of the client launch path.

## Post Launch Follow-Up
- Replace template-era Playwright coverage with route-aware app smoke coverage.
- Reduce renderer bundle size and clean up fake lazy-loading in exam surfaces.
- Remove dead IPC exposure and legacy/template remnants.
- Normalize deployment/runbook docs for backend and updater operations.

## Acceptance Criteria
- Every major surface in [`docs/generated/production_readiness_matrix.md`](/Users/danielbenassaya/Code/personal/opticai/docs/generated/production_readiness_matrix.md) has a launch action.
- Every `P0` and `P1` blocker in [`docs/generated/launch_blocker_matrix.md`](/Users/danielbenassaya/Code/personal/opticai/docs/generated/launch_blocker_matrix.md) is assigned to either fix or explicit guard/scope reduction.
- Windows-first packaging, updater, and auth flows are treated as top release gates.
