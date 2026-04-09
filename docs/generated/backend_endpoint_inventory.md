# Backend Endpoint Inventory

Last Updated: 2026-04-09

## Summary
Current FastAPI endpoint module count with explicit route decorators: 28.

| Module | Route Count | Purpose | Example Paths |
| --- | ---: | --- | --- |
| `auth.py` | 4 | Login and current-user auth bridge | `/auth/login`, `/auth/me` |
| `companies.py` | 7 | Company CRUD and public company create/list | `/companies`, `/companies/public` |
| `clinics.py` | 7 | Clinic CRUD and company/unique lookups | `/clinics`, `/clinics/company/{company_id}` |
| `users.py` | 15 | User CRUD, clinic/company lists, public lookups | `/users`, `/users/select`, `/users/company/{company_id}` |
| `clients.py` | 12 | Client CRUD, AI state fields, stats | `/clients`, `/clients/paginated`, `/clients/{client_id}/all-data-for-ai` |
| `families.py` | 9 | Family CRUD and member management | `/families`, `/families/{family_id}/members` |
| `appointments.py` | 10 | Appointment CRUD, stats, Google event id updates | `/appointments`, `/appointments/paginated` |
| `medical_logs.py` | 6 | Medical log CRUD | `/medical-logs`, `/medical-logs/client/{client_id}` |
| `orders.py` | 19 | Orders, contact lens orders, structured component data, upsert-full | `/orders`, `/contact-lens-orders`, `/orders/upsert-full` |
| `billing.py` | 13 | Billing and line items | `/billing`, `/order-line-items` |
| `referrals.py` | 12 | Referral CRUD plus componentized referral data | `/referrals`, `/referrals/{referral_id}/data` |
| `files.py` | 8 | File CRUD, pagination, download URL | `/files`, `/files/{file_id}/download-url` |
| `settings.py` | 7 | Settings CRUD and save-all | `/settings`, `/settings/save-all` |
| `work_shifts.py` | 10 | Shift CRUD and user/month stats | `/work-shifts`, `/work-shifts/user/{user_id}/stats/{year}/{month}` |
| `lookups.py` | 6 | Dynamic lookup CRUD by type | `/lookups/types`, `/lookups/{lookup_type}` |
| `exam_layouts.py` | 19 | Layout CRUD, groups, instances, reorder, defaults | `/exam-layouts`, `/exam-layouts/instances` |
| `unified_exam_data.py` | 5 | Unified exam data load/save per layout instance | `/unified-exam-data/{layout_instance_id}` |
| `exams.py` | 9 | Exam CRUD and enriched/page-data views | `/exams`, `/exams/{exam_id}/page-data` |
| `dashboard.py` | 1 | Home dashboard analytics | `/dashboard/home` |
| `control_center.py` | 10 | Company analytics and control-center lists | `/control-center/dashboard/{company_id}` |
| `search.py` | 1 | Global search endpoint | `/search` |
| `chats.py` | 10 | Chat/thread/message CRUD | `/chats`, `/chats/{chat_id}/messages` |
| `ai.py` | 2 | AI assistant chat and streaming chat | `/ai/chat`, `/ai/chat/stream` |
| `ai_sidebar.py` | 3 | AI sidebar generation helpers | `/ai-sidebar/generate-all-states/{client_id}` |
| `campaigns.py` | 9 | Campaign CRUD, execution, execution logs | `/campaigns`, `/campaigns/{campaign_id}/execute` |
| `email_logs.py` | 6 | Email log CRUD and appointment lookups | `/email-logs`, `/email-logs/appointment/{appointment_id}` |
| `whatsapp.py` | 1 | WhatsApp connect/config entrypoint | `/whatsapp/connect` |
| `whatsapp_webhook.py` | 2 | WhatsApp webhook verify/receive | `/whatsapp/webhook` |

## Notes
- The backend surface is broad relative to the current automated test confidence.
- Core launch focus should stay on the modules that back clinic workflows and Windows-first release behavior.
