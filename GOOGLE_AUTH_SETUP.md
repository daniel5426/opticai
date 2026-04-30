# Google Auth Setup

Last Updated: 2026-04-30

OpticAI no longer uses Supabase Auth. Google login is verified by the backend through `/auth/login/google`, and Supabase remains Postgres/Storage only.

Use [GOOGLE_SETUP.md](/Users/danielbenassaya/Code/personal/opticai/GOOGLE_SETUP.md) for the current Google OAuth setup.

Required runtime variables:

```env
GOOGLE_DESKTOP_CLIENT_ID=your-desktop-client-id.apps.googleusercontent.com
GOOGLE_DESKTOP_CLIENT_SECRET=your-desktop-client-secret
TOKEN_ENCRYPTION_KEY=generate-a-strong-secret
```
