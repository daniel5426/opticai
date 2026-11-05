# Website signup and email verification

The public landing/account site is the `daniel5426/prysm-web` Next.js repository on Vercel. The clinic application is this repository's Railway web service (`app.prysm.co.il` in production). They have different routes and purposes. Signup and account APIs are owned by this repository's FastAPI service at `https://api.prysm.co.il`.

Vercel forwards signup requests; FastAPI sends verification email using `backend/services/transactional_email.py` and Resend's HTTPS API. Vercel's Resend credentials serve its newsletter features and are not available to Railway. Production API needs its own `RESEND_API_KEY` and a verified `EMAIL_FROM` sender. Without delivery configuration or when Resend rejects/times out, signup/resend returns `503 email_delivery_unavailable`, rolls back issuance, and never claims an email was sent. A failed resend preserves the preceding code.

New signup pages explicitly request `verification_method: code` and pass `language` (`he`, `en`, `fr`). Registration stays in the original signup tab. A six-digit code expires after ten minutes and allows five incorrect attempts. Codes are stored as keyed hashes bound to the signup and challenge; the browser's setup credential remains in the HttpOnly cookie maintained by the Vercel proxy. Verification rotates that credential and continues to company setup. Server metadata restores cooldown/expiry/attempt state on refresh.

Resends wait sixty seconds, enforced on the server for both registration restarts and the resend endpoint. Resending invalidates the prior challenge and starts a new attempt budget. PostgreSQL row/advisory locks serialize simultaneous verification, first registration and resend requests. Times are explicitly UTC across database session time zones.

Existing frontend versions that omit `verification_method` continue receiving links, and previously issued links remain valid until consumed, expired, or replaced. The new resend form opts into codes even for older link-based sessions. Replacing pending signup credentials clears earlier verification and drafts; it never inherits proof from an earlier password/account setup.

## Release order and configuration

1. Apply additive Alembic `0055_email_verification_codes` after its existing predecessors, before the new API selects `auth_action_tokens.failed_attempts`. This initializes existing rows to zero without invalidating existing links or changing account records.
2. Configure production Railway API with `SITE_URL=https://prysm.co.il`, `RESEND_API_KEY`, and the verified `EMAIL_FROM`. Keep `SITE_URL` on the landing/account site, never on the clinic app. Staging password-reset and hosted-payment return URLs also need a staging landing-site origin if those flows are tested there.
3. Deploy the backend, then the Vercel website. Production Vercel deployments and canonical `prysm.co.il` / `www.prysm.co.il` requests pin API traffic to `https://api.prysm.co.il`, including server-rendered plan requests. Correct the old production `PRYSM_API_URL` variable to that same origin for clarity. Previews require an explicit separate API origin and refuse the production API.
4. Existing staging signup sessions do not become production accounts. Restart test signup on the production site after rollout; copying staging records is a separate data operation.

This change was developed with disposable local databases and intercepted email delivery. It does not authorize changing hosted variables, migrating shared staging/production databases, or sending test mail. Those belong to the subsequently requested release.

## Focused verification

Use `scripts/devdesk-check.mjs --fast --files ... --tests ...` with `backend/tests/test_web_email_verification.py`, `backend/tests/test_web_email_verification_postgres.py`, and the retained backend-owned auth suite. The PostgreSQL cases create and stop their own disposable local cluster and never use the configured clinic database.

The adjacent `prysm-web` repository includes proxy/origin regression tests and `scripts/signup-browser.test.mjs`. Its browser harness starts a test-owned Next.js server and `backend/tests/web_signup_browser_fixture.py` on loopback ports 3010/3011, using in-memory SQLite and captured email instead of real Resend delivery. It verifies real browser → Vercel proxy → FastAPI → database → code → onboarding behavior in Hebrew RTL and English/French LTR.

Migration note: Additive Alembic 0055 is required before backend rollout; no historical signup/account rewrite or shared-database mutation was performed locally.
