# Backend Architecture Current

Last Updated: 2026-04-09

## Summary
The backend is an in-repo FastAPI application that acts as the system API, auth bridge, data layer, search layer, AI backend, and messaging/integration surface.

## Entry Points
- App bootstrap: [`backend/main.py`](/Users/danielbenassaya/Code/personal/opticai/backend/main.py)
- Config: [`backend/config.py`](/Users/danielbenassaya/Code/personal/opticai/backend/config.py)
- Database: [`backend/database.py`](/Users/danielbenassaya/Code/personal/opticai/backend/database.py)
- Models: [`backend/models.py`](/Users/danielbenassaya/Code/personal/opticai/backend/models.py)
- Schemas: [`backend/schemas.py`](/Users/danielbenassaya/Code/personal/opticai/backend/schemas.py)

## API Shape
- Auth, companies, clinics, users
- Clients, families, appointments, medical logs
- Exams, exam layouts, unified exam data
- Orders, billing, referrals, files
- Settings, work shifts, lookup tables
- Chats, AI assistant, AI sidebar helpers
- Campaigns, control-center analytics, search
- WhatsApp connection and webhook

## Runtime Behavior
- CORS is configured from backend settings.
- Tables are created at startup via `Base.metadata.create_all`.
- VA seed data is applied at startup.
- Health endpoints exist at `/health` and `/health/database`.

## Deployment Model
- Current docs still describe Heroku deployment and Supabase-backed Postgres.
- The production desktop app points at a hosted backend through `VITE_API_URL`.
- Backend deployment knowledge is present but not yet normalized into a current release runbook.

## Current Debt And Risks
- Startup side effects include table creation and seed logic.
- Deployment docs still need reconciliation against the real current production environment.
- The backend surface is broad, so launch confidence depends heavily on selective validation rather than blanket assumptions.
- AI, campaigns, analytics, and messaging endpoints increase scope beyond core clinic CRUD.
