# Clean Authentication System

Last Updated: 2026-04-30

OpticAI auth is backend-owned. The backend is the only authority for users, sessions, refresh tokens, clinic trust, and Google login verification.

## Core Flow

- Clinic entry: clinic unique ID + PIN creates a `clinic_device_trusts` token.
- Clinic login: selected users log in through quick, password, or Google endpoints.
- Control center login: CEO users log in through password or Google without clinic trust.
- Signup: `/auth/register/start` creates a pending setup token; `/auth/register/complete` creates company, first clinic, CEO user, and session.
- Session restore: frontend restores only backend tokens through `/auth/me`.

## Supabase Role

Supabase is used for Postgres and Storage only. The frontend must not use Supabase client auth APIs, Supabase anon auth sessions, or Supabase user creation.

## Required Production Secrets

- `SECRET_KEY`
- `TOKEN_ENCRYPTION_KEY`
- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_KEY`
- `GOOGLE_DESKTOP_CLIENT_ID`
- `GOOGLE_DESKTOP_CLIENT_SECRET`
