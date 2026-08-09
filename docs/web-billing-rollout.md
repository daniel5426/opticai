# Web signup and billing rollout

The database migration is additive and backfills every pre-existing company as `legacy_active` with unlimited clinic and staff limits. Do not change those rows when enabling Stripe.

## Deployment order

1. Deploy FastAPI with `SUBSCRIPTION_ENFORCEMENT_MODE=off` and `WEB_SIGNUP_REQUIRED=false`.
2. Apply Alembic revision `0029_web_signup_billing` and verify company/subscription counts match.
3. Configure Resend, Google web identity, exact production/staging CORS origins, and all Stripe variables.
4. Create Stripe sandbox products/prices and a portal configuration. Disable portal plan switching.
5. Register `/api/v1/subscriptions/webhooks/stripe` and subscribe to Checkout, subscription, invoice paid/failed, and trial-ending events.
6. Deploy the Vercel portal with only `PRYSM_API_URL`, site URL, Google public client ID, and newsletter Resend variables.
7. Exercise signup, trial, payment recovery, cancellation, upgrade, downgrade, and duplicate webhook deliveries in Stripe sandbox.
8. Set enforcement to `shadow`, release the desktop status UI, and verify an older desktop build against a legacy company.
9. Reconnect Stripe tooling, create live resources, and repeat the sandbox acceptance suite.
10. Switch `WEB_SIGNUP_REQUIRED=true`, then move enforcement to `enforce` only after monitoring shadow results.

The Next.js site must never receive Stripe secrets or database credentials. Checkout success pages poll FastAPI and never activate access directly.
