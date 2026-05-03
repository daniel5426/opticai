# Landing Page App Overview

Last Updated: 2026-05-04

## Product Summary
Prysm, also called OpticAI in the repo, is a Windows-first desktop app for optical clinics and multi-clinic optical companies. It combines clinic operations, exam documentation, orders, referrals, files, staff management, AI assistance, and company-level administration in one Electron app backed by a FastAPI API.

## Landing Page Positioning
Prysm is best described as an operating system for optical clinics: manage patients, appointments, clinical exams, orders, documents, staff, and clinic growth from one connected workspace.

Primary audiences:
- Independent optical clinics that need daily scheduling, client records, exams, orders, and files.
- Multi-branch optical companies that need central visibility across clinics.
- Clinic managers who need user management, reporting, attendance, reminders, and integrations.

## Core Value Props
- One workspace for the daily clinic flow: schedule, client, exam, order, referral, file.
- Deep optometry exam tooling with custom layouts and reusable clinical components.
- Multi-clinic control center for company admins and managers.
- Built-in communication workflows for reminders, campaigns, email, SMS, Google Calendar, and WhatsApp.
- AI assistant for searching, summarizing, and acting on clinic data.
- Document generation for orders and referrals.

## Main App Areas

### Authentication And Clinic Entry
- Backend-owned email and Google login.
- Clinic selection and user handoff.
- Clinic entry PIN and trusted-device flow.
- Role-based access levels: viewer, worker, manager, CEO.
- Company/control-center users can work at company scope without a selected clinic.

### Clinic Dashboard And Scheduling
- Main clinic calendar with day, week, and month views.
- Create, edit, move, resize, and delete appointments.
- Appointment fields include client, examiner/user, date, time, duration, exam name, and notes.
- Staff color coding for appointments.
- Work hours, break time, and appointment duration are configurable from settings.
- Vacation-day checks prevent appointments on unavailable staff dates.
- Dashboard stats show today's appointments, available slots, and related schedule metrics.
- Global appointments list with search, date-scope filters, exam-type filters, sorting, and pagination.

### Client And Family Management
- Client database with paginated search, filters, sorting, and create/edit flows.
- Client records include identity, contact, address, health fund, status, pricing, discount, restrictions, notes, hidden notes, and profile image.
- Family management mode for family groups and member relationships.
- Client detail workspace with tabs for:
  - details
  - exams
  - medical records
  - orders
  - referrals
  - appointments
  - files
- Unsaved-change protection in editable client workflows.

### Exams And Clinical Documentation
- Exam creation and editing per client.
- Global exam list with search, test-name filters, sorting, and pagination.
- Layout-driven exam engine backed by unified exam data.
- Custom exam layout editor with rows, draggable cards, resizable cards, visibility controls, and reusable components.
- Layout types include global, glasses, and contact lens workflows.
- Exam components include:
  - old refraction
  - objective refraction
  - subjective refraction
  - addition
  - final subjective
  - final prescription
  - retinoscopy
  - dilation retinoscopy
  - uncorrected visual acuity
  - keratometer and full keratometer
  - corneal topography
  - Schirmer test
  - anamnesis
  - notes
  - contact lens diameters
  - contact lens exam
  - old contact lenses
  - over-refraction
  - fusion range
  - Maddox rod
  - stereo test
  - ocular motor assessment
  - cover test
  - diopter adjustment panel
- Exam card tooling supports clear, copy, paste, title changes, multi-instance cards, and optimized inputs for large clinical forms.

### Orders, Billing, And Documents
- Create and edit client orders.
- Supports regular glasses orders and contact lens orders.
- Order forms capture prescription, lens, supplier, material, coating, color, diameter, status, urgency, notes, supplier notes, and related contact lens exam data.
- Contact lens orders can reuse contact lens exam/details data.
- Billing tab with billing records and line items.
- Global orders list with search, order-kind filter, status filter, sorting, pagination, and inline status updates.
- DOCX export for regular and contact lens orders.

### Referrals
- Create and edit referrals from client context.
- Referral fields include date, type, recipient, urgency, clinical findings, compact prescription, and notes.
- Urgency levels include routine, urgent, and emergency.
- Global referrals list with search, urgency filter, referral-type filter, sorting, and pagination.
- DOCX export for referral documents.

### Files And Client Documents
- File upload from client detail or global files area.
- Global upload can prompt for client selection.
- Drag-and-drop upload support.
- File size guard at 25 MB.
- File metadata includes name, type, size, upload date, notes, and linked client.
- File actions include download, rename, and delete.
- Global files list supports search, category filters, sorting, and pagination.
- Backend stores files through Supabase Storage and returns signed download URLs.

### Settings And Personalization
- Clinic profile and document-facing clinic details.
- Company profile, logo, and brand colors.
- User profile image, contact details, appointment color, theme preference, VA display format, and cylinder format.
- Workday settings, VA test distance, and appointment duration.
- Email reminder settings: enable reminders, days before, and send time.
- SMTP email setup for Gmail, Outlook/Hotmail, Yahoo, or custom SMTP.
- Email connection testing.
- Field-data management for lookup lists such as suppliers, clinics, order types, referral types, lens models, colors, materials, coatings, manufacturers, contact lens types, cleaning solutions, labs, advisors, and VA values.
- About/app information area.

### Staff, Users, And Attendance
- User management for clinic and company scopes.
- Role-aware permissions for sensitive areas.
- User create, edit, delete, search, filter, and pagination.
- Worker attendance page with daily shifts and monthly stats.
- Shift create/delete flows.
- Stats include total shifts, total minutes, and average minutes.
- Personal vacation dates integrate with scheduling.

### Control Center For Multi-Clinic Companies
- Company dashboard with:
  - total clinics
  - active clinics
  - total users
  - monthly appointments
  - monthly revenue
  - activity trends
  - appointments by clinic
  - order-type distribution
  - users and clients per clinic
  - top revenue centers
- Company-level user management.
- Clinic management with branch details, active/inactive state, manager info, contact details, document identity, entry PIN, and unique clinic ID.
- Company settings for profile, branding, personal profile, users, WhatsApp, and app info.

### AI Assistant
- Streaming AI chat UI with saved chat history.
- Supports file attachments and speech input in the prompt composer.
- Tool progress is shown inside assistant responses.
- AI tools can search, list, create, and update:
  - clients
  - appointments
  - exams
  - medical logs
- Supports fuzzy search, recent client lists, client summaries, appointment conflict checks, and bulk create/update operations.
- Assistant messages are saved to backend chat threads.
- Separate AI sidebar helpers exist for generating client state summaries across exams, orders, referrals, contact lenses, appointments, files, and medical records.

### Campaigns And Growth Tools
- Campaign management page for marketing and operational outreach.
- Audience filters by personal data, contact info, family status, client status, dates, activity, exams, appointments, and orders.
- Filters support text, number, date, boolean, and select operators with AND/OR logic.
- Channels include email and SMS content.
- Campaign recurrence can be daily, monthly, yearly, or custom day intervals.
- Optional once-per-client execution.
- Campaigns can be activated, deactivated, run manually, and tracked by sent counts.
- AI campaign creation from a natural-language prompt.
- Backend campaign and WhatsApp services also support WhatsApp Cloud API-oriented execution paths.

### Integrations And Desktop Capabilities
- Google OAuth and Google Calendar connection.
- Calendar sync controls and automatic sync toggle.
- SMTP email sending for reminders and campaigns.
- SMS campaign flow exists in the renderer.
- WhatsApp Cloud API connection and webhook backend.
- Auto-updater/version-check behavior through the Electron shell.
- DOCX generation through local templates.

## Backend Scope
The FastAPI backend owns the main data and integration surface:
- auth, sessions, clinic device trust
- companies, clinics, users
- clients, families, appointments, medical logs
- exams, exam layouts, unified exam data
- orders, contact lens orders, billing, referrals
- files and signed download URLs
- settings and lookup tables
- work shifts and stats
- dashboard and control-center analytics
- search
- chats, AI, AI sidebar
- campaigns and email logs
- WhatsApp connection and webhook

## Landing Page Feature Buckets
Recommended public-facing buckets:
- Clinic CRM: clients, families, files, medical history.
- Smart Scheduling: calendar, reminders, staff availability, Google Calendar.
- Clinical Exams: custom optometry layouts, prescriptions, contact lens workflows.
- Orders And Billing: glasses orders, contact lens orders, line items, DOCX exports.
- Referrals And Documents: referral workflows and professional document output.
- Team And Branch Management: users, roles, attendance, multi-clinic control center.
- AI And Automation: AI assistant, client summaries, campaigns, communication flows.
- Integrations: email, SMS, WhatsApp, Google Calendar, Supabase-backed files.

## Notes For Landing Page Copy
- Use the product name `Prysm` publicly unless the brand decision changes.
- Avoid overpromising full automation; the current implementation includes strong workflow support, with some communication and campaign features dependent on real integration configuration.
- The strongest differentiator is the combination of deep optical exam workflows plus daily clinic operations in one desktop product.
