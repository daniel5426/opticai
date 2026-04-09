# Operations And Integrations Current

Last Updated: 2026-04-09

## Summary
The core operational surface combines clinic workflows with desktop-only integration helpers.

## Operational Domains
- Scheduling and dashboard
  - Appointments, calendar views, drag/resize workflows, Google calendar sync hooks
- Orders and referrals
  - Order and referral detail pages, structured component data APIs, DOCX export for orders
- Files
  - File CRUD plus backend download URL support
- Settings
  - Clinic settings, profile, company data, email settings, lookup tables, user admin

## Integration Surfaces
- Google OAuth and Google Calendar
- SMTP email reminders and campaign email sending
- SMS campaign sending
- WhatsApp connection/webhook on the backend
- AI assistant endpoints and AI sidebar generation flows
- Auto-updater and app version checks

## Current Risks
- SMS service in the renderer is still a dummy implementation.
- Email and campaign execution rely on real config correctness and need launch validation.
- Google OAuth/calendar flows depend on Electron callbacks and packaged desktop behavior.
- AI assistant and campaigns are broad, higher-risk surfaces compared with core clinic CRUD.
- Updater/install confidence is especially important because next week’s release is Windows-first.
