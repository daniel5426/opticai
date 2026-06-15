# Calendar And Appointment Feature Phases

Last Updated: 2026-06-15

## Summary

This plan groups the requested appointment and calendar work into implementation phases. Phase 1 and Phase 2 improve calendar appointment creation, copy/move behavior, layout selection, and starting exams from appointments.

## Phase Roadmap

- **Phase 1: Calendar appointment actions** - Add empty-slot actions, new appointment from existing/new client, appointment copy/paste, right-click menu, and click-to-move mode.
- **Phase 2: Appointment exam layout + Start Exam** - Persist selected active exam layout on appointments and start an exam from the appointment.
- **Phase 3: Global search extensions** - Add recent clients and prescription search panels inside the global search dropdown.
- **Phase 4: Merge clients** - Add merge mode in the clients table and a transactional backend merge endpoint.
- **Phase 5: Save UX** - Add Ctrl/Cmd+S and unsaved indicators for exams, orders, and referrals.
- **Phase 6: Exam input navigation** - Add auto-advance, keyboard navigation, type-to-select dropdowns, and decimal typing helpers.
- **Quick fix** - Fix Addition card signs so only FCC shows plus/minus formatting.

## Phase 1 Implementation

- Empty calendar slot click opens a small menu with paste, new from existing client, and new from new client.
- Copy stores appointment data in frontend state and paste creates a new appointment at the clicked slot without copying `id` or `google_calendar_event_id`.
- Move mode updates the existing appointment on the next calendar slot click, shows a light yellow calendar ring, and cancels on outside click.
- Appointment right-click menu includes Start Exam, Copy, Move, and Delete.
- Appointment overlaps remain allowed.

## Phase 2 Implementation

- Add nullable `exam_layout_id` to appointments.
- Appointment exam type becomes an active exam layout dropdown.
- Saving stores both `exam_layout_id` and `exam_name` for backward-compatible display.
- Existing appointments without `exam_layout_id` remain editable; Start Exam is disabled until a layout is selected.
- Appointment modal client name links to the client page.
- Start Exam navigates to `/clients/$clientId/exams/new?layoutId=$examLayoutId`.

## Migration And Compatibility

- Add an Alembic migration for nullable `appointments.exam_layout_id`.
- Existing appointments remain compatible because the new field is optional.
- No appointment-to-exam traceability column is added in this phase.
