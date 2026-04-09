# Documentation System

Last Updated: 2026-04-09

This directory is the canonical internal documentation hub for OpticAI.

## Purpose
- Separate docs by intent, not by random subsystem notes.
- Make current architecture, generated inventories, and active launch work easy to find.
- Reduce drift between the Electron app, the in-repo backend, and release/runbook knowledge.

## Sections
- `design-docs/`
  - Current-state architecture and implementation shape.
- `product-specs/`
  - Current user-facing behavior and launch scope by domain.
- `exec-plans/active/`
  - Active implementation and launch cleanup plans.
- `exec-plans/completed/`
  - Historical plans kept after work is done.
- `generated/`
  - Machine-derived or audit-derived inventories and matrices.
- `references/`
  - Stable supporting material such as release checklists and doc conventions.

## Canonical Entry Points Right Now
- [`docs/design-docs/app_architecture_current.md`](/Users/danielbenassaya/Code/personal/opticai/docs/design-docs/app_architecture_current.md)
- [`docs/design-docs/backend_architecture_current.md`](/Users/danielbenassaya/Code/personal/opticai/docs/design-docs/backend_architecture_current.md)
- [`docs/design-docs/auth_and_session_current.md`](/Users/danielbenassaya/Code/personal/opticai/docs/design-docs/auth_and_session_current.md)
- [`docs/design-docs/exam_layout_engine_current.md`](/Users/danielbenassaya/Code/personal/opticai/docs/design-docs/exam_layout_engine_current.md)
- [`docs/design-docs/operations_integrations_current.md`](/Users/danielbenassaya/Code/personal/opticai/docs/design-docs/operations_integrations_current.md)
- [`docs/generated/production_readiness_matrix.md`](/Users/danielbenassaya/Code/personal/opticai/docs/generated/production_readiness_matrix.md)
- [`docs/generated/launch_blocker_matrix.md`](/Users/danielbenassaya/Code/personal/opticai/docs/generated/launch_blocker_matrix.md)
- [`docs/exec-plans/active/production_readiness_launch_plan.md`](/Users/danielbenassaya/Code/personal/opticai/docs/exec-plans/active/production_readiness_launch_plan.md)

## Documentation Rules
- Every edited Markdown file must include a `Last Updated` date.
- Prefer one canonical doc per concern. Do not duplicate the same current-state summary in multiple places.
- Put temporary launch work and cleanup sequencing in `exec-plans/active/`, not in long-lived architecture docs.
- Put generated inventories and audit matrices only under `generated/`.
- If a section gains more than a few docs, keep an index file in that section.

## Current State
- This repo already had a small `docs/` directory, but it was not a full documentation system.
- The root `README.md` was still template-era.
- Existing detailed docs are still useful, especially:
  - [`docs/EXAM_CARD_ARCHITECTURE.md`](/Users/danielbenassaya/Code/personal/opticai/docs/EXAM_CARD_ARCHITECTURE.md)
  - [`docs/feature_designs/MISSING_AXIS_WARNING.md`](/Users/danielbenassaya/Code/personal/opticai/docs/feature_designs/MISSING_AXIS_WARNING.md)

## Legacy Detail Policy
- Keep existing focused docs if they still describe real implementation detail.
- Prefer the new current-state docs as the top-level orientation layer.
- Do not move existing templates or binary assets just to satisfy the docs layout.
