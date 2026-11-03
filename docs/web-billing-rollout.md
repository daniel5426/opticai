# Allpay billing and owner administration

Paid self-service checkout charges immediately; trials are never granted automatically. New workspaces can request a free trial at checkout for explicit owner review. Essential/Growth/Network cost ₪430/₪999/₪1,890 **including VAT** per month. Existing trials keep their remaining trial dates. Billing records are independent of clinic order payments.

## Configuration and credentials

- Allpay credentials belong only in the ignored `backend/.env` locally and backend/worker secret variables in production: `ALLPAY_API_LOGIN`, `ALLPAY_API_KEY`. Never put them in Next.js, desktop bundles, screenshots, or logs.
- `BILLING_CHARGING_ENABLED=false` is the safe default. It blocks payment-session creation, token charges, and refunds. Reconciliation remains available.
- `ALLPAY_TEST_MODE=true` is the default. Use separate test data; do not switch an existing attempt between test/live environments.
- `ALLPAY_LIVE_PAYMENTS_ENABLED=false` independently blocks live payment operations even if test mode is accidentally switched off. Sandbox runs may enable `BILLING_CHARGING_ENABLED` while this live gate stays off.
- Set `API_PUBLIC_URL` to the HTTPS FastAPI origin receiving `/api/v1/subscriptions/webhooks/allpay`, and `SITE_URL` to the website origin.
- Enable Hosted Fields in Allpay and allowlist the exact production/staging domains. Card-only checkout is intentional: recurring consent is collected before submitting the first payment. Saved card tokens are encrypted using `TOKEN_ENCRYPTION_KEY`.
- `OWNER_USER_IDS` is a comma-separated allowlist of immutable existing **application** user IDs. An empty or malformed value denies administration. Company CEO roles and editable email addresses do not grant platform access.
- `python scripts/resolve_owner_ids.py` performs a read-only lookup for the two approved owner emails against the configured database and prints its non-secret identity first. Run it separately for each environment. Supabase Auth IDs are not application user IDs.

## Deployment sequence

1. Inventory subscriptions and missing company rows against the exact target before applying migration `0047_allpay_billing`. Keep a backup. The migration is additive, preserves Stripe IDs/history, marks existing Stripe rows explicitly, and backfills missing pre-cutover companies as legacy. Review these classifications before enforcement. In the inspected Railway `opticai / production` database, the subscription table was absent; its full Alembic history must be established before this revision, rather than applying only the final revision.
2. Deploy the backend and apply the migration as part of the authorized rollout. Never start the new ORM against an unmigrated shared database. No startup-time schema mutation is introduced.
3. Configure owner IDs and Allpay secrets on the API and billing worker; leave charging disabled. Launch the worker with `python -m workers.billing_worker` using `backend/railway.billing-worker.json`.
4. Deploy the updated `prysm-web` checkout/account/admin screens and desktop subscription UI. `PRYSM_API_URL` must point to this backend. Replace the website’s trial and VAT-exclusive promises.
5. In an isolated test environment, enable charging with Allpay test mode on. Verify iframe capture, first payment, token retrieval, renewals, declines, retries, cancellation, refunds, webhook retries, and owner authorization.
6. Verify receipt/accounting integration in Allpay. Receipt links appear only when a document actually exists. Payment records are not presented as issued tax invoices.
7. For each old Stripe subscription, stop its external recurring billing and verify that stop before recording `stripe_billing_stopped` in the owner console. Customers must enter an Allpay card; Stripe payment methods cannot be copied. Legacy accounts are not automatically enrolled.
8. After explicit production acceptance, enable live charging and start with a controlled cohort. Never run Stripe and Allpay recurring charges for the same customer. The retired Stripe webhook is inert and cannot mutate entitlements.

## Operations and semantics

- `/admin` and `/api/v1/admin` require an allowlisted active owner on every request. Owner accounts cannot be disabled through the console.
- Full-access grants default to stopping billing; access and automatic charging are separate controls. Payment events preserve overrides and owner edits. An expired override falls back to subscription dates; clearing it is an explicit action.
- Exactly two optional modules are supported: AI and Campaigns. Campaigns gates campaign WhatsApp, email, and SMS; billing/recovery email is independent. API, agent authorization, queued WhatsApp work, and campaign email delivery recheck entitlement. New desktop campaign email sends use the backend; retire older desktop builds with cached direct SMTP credentials when enforcing the new policy. SMS transport is still the pre-existing dummy implementation, not a new SMS gateway.
- A confirmed first payment grants a calendar month; renewals preserve the original day-of-month, clamping February and other short months. Upgrade prorations below ₪5 carry to renewal. Downgrades are checked again against active usage at renewal.
- Financial owner edits supersede unsubmitted invoices; a payment settling across a changed contract pauses further automatic billing for owner review. Module-only changes leave billing and scheduled plan changes intact.
- The worker polls every 30 seconds. Renewal failure retries are days 1, 3, and 5; grace ends seven days after the original renewal date and never slides. Invalid cards stop automatic retries.
- A submitted/unknown charge must be reconciled before another attempt. Provider status `0` without definitive failure evidence remains uncertain. Do not clear it or create another order to work around a timeout. Use the owner reconciliation action and Allpay dashboard/support if needed.
- Refund requests are persisted and audited before submission. An uncertain refund blocks another refund until its outcome is reconciled. Cancellation stops future attempts; a charge already submitted may still settle and remains visible in history.
- Audit events are append-only at both API and PostgreSQL levels. Preserve payment/audit history during cancellation and suspension.

## Verification

Run `pytest tests/test_allpay_billing.py tests/test_subscription_foundation.py` plus auth, scope, agent-authorization, and production-hardening suites. The Allpay suite mocks provider I/O; it does not create real payments. Validate actual Hosted Fields only with test-mode merchant configuration before live acceptance.

## Owner-reviewed trial requests

- Apply additive migration `0048_trial_requests` after `0047` and before deploying the updated API/website. It adds one request per company with row-level security; existing subscriptions are unchanged. Older desktop versions continue to use the existing trial and access fields.
- The checkout button sends an authenticated company-owner request. Pending and rejected requests grant no access and leave paid checkout available. Customers can refresh status; pending pages also poll for a decision. Internal review notes stay private.
- `/admin` shows a pending review queue with customer details, an exact trial-end date, approval, and rejection. Every decision requires an internal reason and records an append-only audit event. Approval immediately starts the selected plan's trial with automatic billing disabled; expiry makes access read-only. The account page shows the trial end and offers paid checkout after expiry.
- Previously trialed/paid workspaces cannot request another trial. Active manual restrictions or unresolved/payable checkout attempts block approval. Subscription locks and a company uniqueness constraint prevent duplicate requests and double approvals. The owner can still extend an existing trial with the manual subscription controls.
- Trial requests and decisions do not send email notifications. Requests are visible in the owner queue and customer status page; no card or payment is required for approval.
- Staging validation on 2026-10-26: migration `0048` applied after backup, with all 31 pre-existing subscription rows unchanged. The deployed checkout created a pending request with zero payment attempts, and confirmed owner ID `161` approved it through the real owner console with a custom expiry. The customer then saw full trial access, the chosen end date, and automatic billing disabled. The synthetic user/clinic were deactivated and their sessions revoked afterward; request/audit history is retained. Rejection and Hebrew/English/French layouts were also verified in isolated local browsers. All 66 backend/PostgreSQL checks, website type checks, targeted lint, and the production website build passed. Production and live charging were not enabled.

## Staging validation — 2026-10-26

- Railway project `opticai`, environment `staging`: API `https://staging-api.prysm.co.il`; portal `https://prysm-web-staging-staging.up.railway.app`; dedicated service `allpay-billing-worker-staging`.
- Migration `0047_allpay_billing` applied to `db.eoyqvffwzllggemzfxaw.supabase.co/postgres` after schema/subscription backups. All original fields on the 30 pre-existing subscription rows were verified unchanged. Production was not migrated or deployed.
- Both API and worker use `ALLPAY_TEST_MODE=true`, `BILLING_CHARGING_ENABLED=true`, and `ALLPAY_LIVE_PAYMENTS_ENABLED=false`. Allpay's merchant integration also has test mode enabled, with the exact staging portal domain allowed for Hosted Fields. Owner ID `161` resolves to the confirmed account in this environment.
- Isolated synthetic company `39` exercised embedded checkout, signed webhook activation, encrypted token recovery, zero-charge card replacement, a ₪568.99 prorated upgrade, worker renewal with a scheduled downgrade, invalid-token failure, fixed seven-day grace/read-only expiry, card replacement and customer retry, cancellation, partial/full refunds, duplicate webhooks, invalid signatures, retired Stripe callbacks, and manual override precedence during a refund. Module and user/clinic deactivation were checked through authenticated APIs. Dates were advanced only on this fixture to exercise renewals and expiry.
- Sandbox testing caught and fixed missing customer details on token charges under Hosted Fields. Card replacement now returns to billing. The Allpay regression suite passes 33 tests, and all three Railway deployments are successful with healthy API/website probes.
- The billing worker requires the API's database, encryption, and required Supabase configuration, plus IPv6 egress for this Supabase host. Sandbox billing emails were deliberately disabled; accounting integrations are not configured, so payment records correctly have no issued-receipt links. Timed retries, concurrency/crash cases, and missing-token recovery are covered by automated tests rather than waiting real billing days.
- The synthetic user and clinic were deactivated, fixture sessions revoked, and automatic billing stopped after validation. Financial and audit records remain available for inspection.
- These deployments use CLI-uploaded source snapshots. Before enabling Git-triggered deployments or using a variable-triggered rebuild, ensure the connected Git source contains migrations `0047`/`0048` and the new application code; an older Git revision cannot migrate this schema. Use the worker-specific deployment configuration rather than the API start command.

Migration note: additive schema migration and explicit per-environment owner IDs are required. Shared database migration, service configuration, and live charges are separate rollout actions.
