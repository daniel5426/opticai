# Start OpticAI

Last Updated: 2026-11-03

Use `devdesk start opticai --wait --open` or **Start OpticAI.app**. Default: clinic web.

Profiles: `clinic-web`, `clinic-electron`, `demo-web`, `demo-electron`. Select with `--profile`.
Google sign-in uses separate web and desktop clients. Local web exchange needs
`GOOGLE_WEB_CLIENT_ID` and `GOOGLE_WEB_CLIENT_SECRET` in `backend/.env`; see
[Google OAuth configuration](docs/references/google-oauth.md) for exact callbacks
and desktop credentials. Restart the local instance after changing API env.
If the Google popup closes before the account chooser, check
`http://localhost:8000/api/v1/auth/google/oauth/config`. A `google_not_configured`
response means the web client ID or secret is missing from the running API;
setting the secret in the repository root `.env` alone does not configure it.
Run `devdesk doctor opticai` before diagnosing dependencies. App-owned workers, relay and renderer start and stop with OpticAI. The configured Agents24 API and hosted/shared clinic database are external dependencies and must already be available; they are never stopped with the app. The legacy demo database uses a shared native PostgreSQL host, which is an independent host prerequisite. App-exclusive local database services must declare automatic lifecycle commands in `devdesk.json`. Clinic mode uses `backend/.venv/bin/python` and protected `backend/.env`; demo uses `.venv-agent-dev/bin/python` and `.env.agent-dev`. Required variable names and the authoritative database, clinic, resource and Ask-policy checks are in [the local development runbook](docs/references/agents24-local-development.md).

Hosted Agents24 clinic ports: 8000, 8001, 4316, 5126. Legacy local-draft clinic mode uses Artifact port 4317. Demo ports: 8016, 4316, 5136. Ports stay fixed; conflicts report the owner. Do not kill another stack or silently change the port. The underlying entrypoint remains `scripts/clinic-dev.py up --browser` (omit `--browser` for Electron); demo uses `scripts/agent-dev.py`.

`devdesk status --json` identifies the instance and service health. `devdesk logs <instance>` shows bounded redacted launcher logs; protected per-service logs remain under `.agent-data`. `devdesk stop <instance>` and `devdesk restart <instance>` use the same ownership model. Closing the dashboard or Codex leaves the instance running. Repeated starts reuse it.

Startup does not migrate or seed a clinic database. Migrations remain explicit and require exact-target authority. Preserve the database allowlist, job authorization, queue separation, relay identity and installed Ask-policy checks. Local requested and summary workers serve all clinics in the configured database. Isolated demo data remains separate from clinic data. No shared database, platform resource publication or hosted change is authorized by Start.

Reinstall the Spotlight launcher with `devdesk shortcuts install opticai`. Worktrees register independently through `devdesk register <checkout>`; select the returned app key when multiple checkouts are registered. Existing profile validators deliberately enforce their fixed ports.

Existing sessions are detected by repository, launcher identity, listening ports, readiness and required child roles. Healthy sessions started outside DevDesk appear as Running; Start/Open reuses them without launching another stack. Historical blocked attempts stay in Activity. External sessions remain observed until you explicitly choose **Manage session**; that action allows Stop/Restart of the verified launcher and its children. App-owned services follow the app lifecycle; separate apps, hosted/shared databases and shared host engines remain independent. External logs remain with their original launcher.

## Manual table export consumer

Each API process owns an in-process `table_exports` consumer for leased `table_export` jobs. It starts and stops with the API already declared in `devdesk.json`; no additional service or Agents24 connection is required. API shutdown signals the consumer to stop; cooperative interruption requeues work, and abruptly terminated attempts recover through their leases. The automatic consumer stays off for in-memory SQLite; isolated tests invoke it explicitly with their own sessions. Generated Excel/CSV files use the existing protected `PRYSM_AGENT_DATA_DIR`, with seven-day expiry and API-owned cleanup. API replicas must share that durable directory, as with existing agent reports. Hosted/shared databases remain external; startup never applies an export migration.

## Campaign delivery consumer

The API owns campaign reconciliation and the leased delivery consumer. The
scheduler/submission path runs only when `CAMPAIGN_SENDING_ENABLED=true`; services
start/stop with the app and coordinate replicas in PostgreSQL. The disabled default sends nothing. Callback inbox reconciliation and the
worker heartbeat continue while sending is disabled. The owner catalog is a second delivery kill switch. Startup never
creates messaging tables or grants credit. Configure providers and apply Alembic
explicitly through the authorized migration/release workflow in `CI.md`.

For the local draft profile, enable `PRYSM_CAMPAIGN_AGENT_ENABLED=true` and add
the `campaigns` Toolset/instructions to the isolated clinic package. Verify all
four main-agent callable bindings are attached after applying; an Artifact manifest
alone is insufficient. All four text-generation settings and the local package
use GPT-6 Luna. OCR, embeddings and speech retain dedicated models.

Leave `PRYSM_CAMPAIGN_AGENT_ENABLED=false` while serving the existing published
agent manifest. Enabling the new campaign Toolset before publishing its matching
contract makes the published relay stale and prevents readiness. Authoring tests
can enable it explicitly; see the coordinated publication note in `CI.md`.

For real campaign-email tests on the local clinic app, set
`PRYSM_CAMPAIGN_CALLBACKS_ENABLED=true` in `backend/.env` and install the official
`cloudflared` CLI. DevDesk owns the opt-in callback service, its loopback gateway
on 8020, and its temporary Cloudflare tunnel. Only signed Resend/Allpay callbacks, secret-path Micropay JSON POST callbacks and
tokenized long/compact unsubscribe routes pass through; the normal API is not exposed.
Startup configures/reuses a Resend webhook and saves its secret locally; shutdown
disables that webhook and stops both child processes. Protected state/logs live
in `.agent-data/campaign-callbacks`. The public hostname changes after restart;
old test-email unsubscribe URLs work only while their original tunnel is running.
Use a stable public API origin for staging/production. This helper is never
started automatically in production and does not enable campaign sending.

## Phone barcode scanner

The browser build serves the isolated phone app at `/scanner/`. Set
`SCANNER_ENABLED=true` only after Alembic 0060. Configure the server-only
`SCANNER_NOTIFY_DATABASE_URL` for the same database using session pooling on
5432 or a direct connection; leave normal queries on `DATABASE_URL`.
The API owns one notification listener and retention cleanup task per process;
no separate scanner service or local database is started. Stop/restart uses
DevDesk as usual. The `/api/v1/scanner/status` response reports flag/listener
readiness to signed-in users. Scanner endpoints reject delivery while the
listener is unavailable. Pair phones through Recent scans or scanner settings.

Local phone camera testing needs a reachable HTTPS frontend/API; localhost HTTP
works only on the same machine. Do not expose the normal clinic API through the
campaign callback tunnel. Test installed iPhone/Android storage and cameras on
the staging HTTPS application before enabling production scanning.

For packaged nonproduction Electron builds, set `VITE_SCANNER_URL` to the matching
HTTPS scanner frontend. The app refuses to pair staging/local credentials through
the production phone page. Production defaults to `https://app.prysm.co.il/scanner/`.

## Local campaign qualification

Campaign allowances require Alembic `0061_campaign_allowances` after
`0060_phone_scanner`, followed by `0062_messaging_checkout` for payment identity snapshots. Each active clinic covered by a paid subscription adds
1,000 emails and 200 Micropay billing units to the company's monthly pool. Trials
do not grant these allowances. Managed accounts require an explicit monthly anchor.
Marketing consent is recorded separately from general notification preferences in
Settings → Messaging usage & billing → Marketing consent. No existing preference
is automatically converted into marketing consent.

`MESSAGING_TOPUPS_ENABLED=true` enables manual wallet checkout independently of
`BILLING_CHARGING_ENABLED`; automatic subscription collection can remain off. Local
qualification uses a separate redirect integration: `MESSAGING_ALLPAY_API_LOGIN`,
`MESSAGING_ALLPAY_API_KEY`, `MESSAGING_ALLPAY_CHECKOUT_MODE=redirect`, and
`MESSAGING_ALLPAY_TEST_MODE=true`. Keep `ALLPAY_LIVE_PAYMENTS_ENABLED=false`.
The subscription credentials and Hosted Fields integration remain unchanged.
Legacy pending top-ups retain their original integration identity and mode.
Hosted Fields require an approved real domain; use the redirect flow locally.

For isolated local AI campaign testing, the existing local Agents24 app must be
running. Fork the reviewed package using the official CLI into
`.agent-data/clinic-campaign-package`, then set
`PRYSM_CLINIC_CAMPAIGN_DRAFT=true`, `PRYSM_CAMPAIGN_AGENT_ENABLED=true`,
`AGENTS24_RUNTIME_TARGET=draft`, and
`AGENTS24_INTEGRATION_ID=prysm-campaign-staging` with that fork's Agent bindings.
The clinic launcher serves this isolated package on its declared loopback 4316
port. Apply drafts only; do not publish. Configure the fork's `commit_change` tool
to Ask in Tool governance; startup verifies it without changing that policy.
Production/published resource settings remain separate.

The local callback helper configures Resend and the signed Allpay callback origin.
Micropay's temporary JSON callback must be registered for qualification and its
original settings restored afterward. Restarting changes the temporary hostname;
queued SMS with an old unsubscribe origin are released rather than sent with a
broken link. The account portal is a separate DevDesk app in adjacent `prysm-web`,
with its own `Start.md`; stopping OpticAI does not stop that portal.

The phone scanner offers home-screen installation once on mobile browsers.
Supported browsers use their native install prompt after an explicit tap;
iPhone shows Safari Share → Add to Home Screen instructions. The offer is
hidden in standalone mode and can be reopened from the connection drawer.
Dismissing it stores only a device-local preference; pairing tokens are unchanged.

## Google Calendar consumer

The API owns Calendar export and the optional Google rescheduling worker. They
start and stop with the app and use the same database. Apply Alembic through
`0068_calendar_pull` before running the updated API. Startup never mutates the
schema. See the [Google OAuth runbook](docs/references/google-oauth.md) for
credentials, reconnect handling and Calendar settings.
