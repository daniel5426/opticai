# Route Inventory

Last Updated: 2026-04-09

## Summary
Current renderer route count: 35.

| Path | Page | Surface | Notes |
| --- | --- | --- | --- |
| `/` | `ControlCenterPage` | Entry/Auth | Root entry resolves to control-center style landing |
| `/dashboard` | `HomePage` | Clinic Core | Main calendar/dashboard surface |
| `/control-center` | `ControlCenterPage` | Entry/Auth | Login, register, setup entry |
| `/control-center/dashboard` | `ControlCenterDashboardPage` | Admin | Company dashboard |
| `/control-center/users` | `ControlCenterUsersPage` | Admin | Company user management |
| `/control-center/clinics` | `ControlCenterClinicsPage` | Admin | Company clinic management |
| `/control-center/settings` | `ControlCenterSettingsPage` | Admin | Company settings |
| `/user-selection` | `UserSelectionPage` | Auth | Clinic/user handoff |
| `/second-page` | `SecondPage` | Legacy/Template | Not part of main nav |
| `/clients` | `ClientsPage` | Clinic Core | Client list |
| `/clients/new` | `NewClientPage` | Clinic Core | Client create |
| `/clients/$clientId` | `ClientDetailPage` | Clinic Core | Client detail tabs |
| `/clients/$clientId/exams/$examId` | `ExamDetailPage` | Exams | Existing exam detail |
| `/clients/$clientId/exams/new` | `ExamCreatePage` | Exams | Exam create |
| `/clients/$clientId/orders/$orderId` | `OrderDetailPage` | Orders | Existing order detail |
| `/clients/$clientId/orders/new` | `OrderCreatePage` | Orders | Order create |
| `/clients/$clientId/contact-lenses/$contactLensId` | `ExamDetailPage` | Contact Lens | Reuses exam detail pathing |
| `/clients/$clientId/contact-lenses/new` | `ContactLensCreatePage` | Contact Lens | Contact lens create |
| `/clients/$clientId/referrals/$referralId` | `ReferralDetailPage` | Referrals | Existing referral detail |
| `/clients/$clientId/referrals/new` | `ReferralDetailPage` | Referrals | Referral create/edit reuse |
| `/exams` | `AllExamsPage` | Exams | Global exam list |
| `/orders` | `AllOrdersPage` | Orders | Global order list |
| `/referrals` | `AllReferralsPage` | Referrals | Global referral list |
| `/appointments` | `AllAppointmentsPage` | Scheduling | Global appointments list |
| `/files` | `AllFilesPage` | Files | Global files list |
| `/users` | `AllUsersPage` | Admin/Clinic | Global user list |
| `/settings` | `SettingsPage` | Settings | Clinic and user settings |
| `/ai-assistant` | `AIAssistantPage` | Assistive | AI chat surface |
| `/exam-layouts` | `ExamLayoutsPage` | Exams | Layout list |
| `/exam-layouts/new` | `ExamLayoutEditorPage` | Exams | Layout create |
| `/exam-layouts/$layoutId` | `ExamLayoutEditorPage` | Exams | Layout edit |
| `/worker-stats` | `WorkerStatsPage` | Assistive/Operations | Staff time/attendance |
| `/campaigns` | `CampaignsPage` | Growth | Campaign management |
| `/auth/callback` | `AuthCallbackPage` | Auth | Supabase callback |
| `/oauth/callback` | `GoogleAuthCallbackPage` | Auth/Google | Google OAuth callback |
