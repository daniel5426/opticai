# Agents24 local development

Last Updated: 2026-11-03

Current Artifact transport and migration: [shared clinic relay](agents24-shared-relay.md).


## Prysm organization on hosted Agents24

The clinic development profile can use the official `https://api.agents24.dev` with
`AGENTS24_RUNTIME_TARGET=published`. It retains the existing nonproduction clinic database
allowlist. Shared requested/summary workers serve all clinics in that configured database. Synthetic demo mode remains local-only and retains
its own key, resources and data. The organization key is stored only in protected backend/package
environment files, never renderer or Electron-packaged environment files.

The clinic launcher uses the canonical `agents24` package for hosted serving, its declared Artifact
port 4316, one stable `prysm-production` relay identity, and the new organization resource IDs.
Published startup serves the existing contract and checks explicit Ask on `commit_change`;
it does not apply drafts or publish resources. Use DevDesk's clinic profile to start the complete
consumer stack. Core backend startup alone still does not supervise remote-platform dependencies.

For an intentional resource release, `devdesk start opticai --profile prysm-authoring --wait`
starts only the local contract-authoring relay. Apply and publish remain explicit official CLI
actions. Stop that instance before starting clinic serving because both use port 4316.
All four chat Agents share the explicit GPT-6 Luna model binding. OCR, embeddings and Scribe v2
speech retain their separate capabilities. The document settings contain published executable IDs,
not editable pipeline IDs.

Migration note: Resource publication recreates the package in the target organization; it does
not copy historical conversations, ingestion results, business data or knowledge records. Existing
source-organization resources remain intact. No database schema migration or hosted OpticAI
application deployment is included. Existing signed-in accounts with principal bindings to the old
organization should sign out and sign in to establish a fresh application session; old context
records are preserved. Verified hosted chat used clinic_context and restored its conversation.

## Normal backend and Electron startup

Agents24 is experimental and optional. Set `AGENTS24_ENABLED=false` in
`backend/.env` to run the core application without an Agents24 connection. Use
the normal commands below; do not use `dev:agent` or `dev:agent:demo` for this
setup. With the integration enabled and a trusted staff scope available, navigation, chat and drafts remain mounted through temporary connection failures. The shared SDK lifecycle handles bootstrap recovery; authoritative denial or identity changes clear access. Temporary recovery never resubmits a chat message. Existing AI data is preserved.

For integrated AI development, start the existing Agents24 backend on 8026.
Use the normal commands in separate terminals:

```sh
cd backend
source .venv/bin/activate
python3 main.py
```

```sh
npm run dev
```

The normal API and Electron/browser defaults now agree on port 8000. The backend no longer silently changes ports. With Agents24 enabled against the local draft runtime, backend lifespan owns `clinic-dev.py services`: Artifact 4317, one shared app-profile relay host, and separate requested/summary workers serving all clinics in the configured database. If the optional platform is offline or local dependency startup fails, the core API still starts. Successful integrated startup waits for local tool readiness. Stopping the backend stops only its children; the existing Agents24 API and separately started Electron remain independent. The supervisor also checks its backend owner's PID so an abruptly killed backend does not leave dependencies behind. Logs/readiness receipts are protected under `.agent-data/clinic-services/`.

Automatic supervision is disabled for production/staging application environments, Railway contexts, remote Agents24 origins, disabled integrations and explicitly managed API children. The dependency launcher still validates the exact allowlisted nonproduction database and clinic scope before starting anything. It does not migrate or seed the clinic database or publish resources; it only applies existing local draft bindings when necessary.

Electron can start first: the host retries failed network/server bootstrap with a bounded backoff and provides an explicit retry button. It does not retry authentication/policy denial automatically or repeat a chat message. All startup copy is translated in Hebrew, English and French.

## Combined development launcher

`npm run dev:agent` uses `scripts/clinic-dev.py` and protected `backend/.env`: the allowlisted nonproduction database, local Agents24 draft runtime, frontend 5126, APIs 8000/8001, and Artifact tools 4317. No single-clinic worker setting is required. Use `-- --no-renderer` to retain an existing frontend. Logs live under `.agent-data/clinic-stack`; the API and workers share `.agent-data/clinic-data`.

Startup launches independent `requested` (reports/documents) and `summaries` (daily briefs) workers. Both serve all clinics, including job recovery and retention. Each job retains its own authenticated clinic/company authority. Requested workers never schedule daily summaries. Older daily briefs cannot block requested reports.

The worker CLI accepts `--queue requested` (default) or `--queue summaries`, with repeatable `--clinic-id` arguments. Omitting clinic arguments serves the configured database globally; the clinic launcher omits clinic arguments to use the shared pool. Existing rows and leases remain compatible; no schema migration is needed. Do not retain an old combined worker. No hosted services are changed by local startup.

Use `npm run dev:agent:demo` for the separate synthetic profile documented below. Historical verification in this document refers to that synthetic profile.

## Isolated environment

Run from the OpticAI repository. `scripts/agent-dev.py` loads a protected, gitignored `.env.agent-dev` and rejects a remote database or remote Agents24 API. The development database is `opticai_agent_dev`; the API uses port 8016, the signed Artifact server 4316, and the Electron renderer 5136. Production/shared database settings in `backend/.env` are not the development target.

Required server settings: `DATABASE_URL`, the application’s authentication secrets, `AGENTS24_ENABLED=true`, `AGENTS24_BASE_URL=http://127.0.0.1:8026`, `AGENTS24_API_KEY`, `AGENTS24_INTEGRATION_ID=prysm-local`, `AGENTS24_RUNTIME_TARGET=draft`, `AGENTS24_ARTIFACT_SIGNING_SECRET`, `AGENTS24_AGENT_ID`, `AGENTS24_INSIGHTS_AGENT_ID`, `AGENTS24_BRIEF_AGENT_ID`, `AGENTS24_DOCUMENT_PIPELINE_ID`, `AGENTS24_NATIVE_DOCUMENT_PIPELINE_ID`, and optional durable `PRYSM_AGENT_DATA_DIR`. Set `VITE_API_URL=http://localhost:8016/api/v1` and include the renderer’s origins in `BACKEND_CORS_ORIGINS`. Keep keys and session files private; never commit their values.

Use published dependencies from `backend/requirements.txt` and `package-lock.json`. For unpublished Agents24 packages, use the platform repository’s canonical `pnpm dev:agents24` registry, with an isolated consumer under `.agent-data/sdk-consumer`; set `AGENTS24_DEV_CLI` to that consumer’s CLI executable. Do not copy package internals or use workspace/file links.

## Commands

With the existing local Agents24 backend running, start the complete OpticAI stack from the repository root:

```sh
npm run dev:agent:demo
# Browser interface instead of Electron:
npm run dev:agent:demo -- --browser
```

This loads `.env.agent-dev`, checks the isolated database and draft target, starts the Artifact server/API/relay, reapplies the existing local resource package, waits for all three clinic Toolsets to become healthy, then starts separate requested-work and summary workers and the interface on `http://localhost:5136`. The existing Agents24 backend is reused. Ctrl+C stops only the launched OpticAI processes. Duplicate launches and occupied ports fail explicitly. Private service logs are under `.agent-data/local-stack/`; their contents may contain diagnostics and must not be shared unredacted. When available, the launcher uses the bundled Node 24 runtime for the CLI and frontend commands.

For initial database preparation, or individual service debugging, use the granular commands below. Database migration and synthetic seeding remain explicit; startup does not alter shared database configuration or automatically apply migrations.

```sh
python3 scripts/agent-dev.py migrate
python3 scripts/agent-dev.py seed
python3 scripts/agent-dev.py relay
python3 scripts/agent-dev.py cli prepare agents24 --json
python3 scripts/agent-dev.py cli apply agents24 --integration bff --agent main --yes --json
python3 scripts/agent-dev.py relay-status
python3 scripts/agent-dev.py api --reload --no-access-log
python3 scripts/agent-dev.py worker --queue requested
python3 scripts/agent-dev.py worker --queue summaries
python3 scripts/agent-dev.py web
```

After the relay reports connected, run the apply command again to bind its verified Toolsets. Keep the API, relay host and worker running in separate terminals. The host owns its Artifact server and the official CLI; do not start duplicate Artifact/relay processes. The Electron command uses a separate development profile under `.agent-data/electron-profile`. `seed --session` creates another protected synthetic staff session for probes. `browser` starts the browser-only renderer for debugging.

Both Vite configurations use the same normalized `VITE_API_URL` as the native/client transport, including inherited process settings. Without an override they consistently default to port 8000; the isolated launcher supplies port 8016. The dedicated renderer uses strict port selection so it cannot silently move away from the configured Electron URL.

The isolated Electron main/preload build lives in `.agent-data/electron-build`, separate from the ordinary development session's `dist-electron`. Backend, docs, launcher scripts, test files and private local data are excluded from frontend watching so edits there do not reload a live conversation.

## Current setup verification — 2026-10-18

`npm run dev:agent:demo` and its `--browser` variant both reached readiness against the already-running Agents24 API. All three Toolsets were healthy. A controlled supervisor shutdown closed ports 8016/4316/5136 while leaving Agents24 on 8026 and the pre-existing backends on 8000/8001 running; restart succeeded. Duplicate startup failed explicitly without stopping the existing stack.

Fresh automated checks: 109 backend tests and 27 frontend integration/configuration tests passed; the web build passed with existing bundle/import warnings. The final watcher-only changes also passed the six focused configuration cases, and the isolated Electron development build completed.

Live API acceptance passed **14/14** in one round (`.agent-data/acceptance-8b5ca527.json`). Native text and PNG OCR jobs completed with expected measurements (`.agent-data/local-setup-documents.json`). Real Electron chat, history reload, approval saving exactly one task and rejection saving none passed with zero page errors (`.agent-data/local-setup-ui.json`); screenshots use the `local-setup-` prefix. All three current-day briefs completed through the worker. All business writes and uploads were synthetic and local. No shared database or production resources were changed.

Migration note: No new migration is required. `python3 scripts/agent-dev.py migrate` completed against the existing local `opticai_agent_dev` database with no pending revision to apply.

The native/text and OCR ingestion pipelines require published executable IDs. Compile/publish these only on the local platform through its canonical authoring API or resource lifecycle, then obtain their current executable IDs through the public SDK. The main, brief and insight agents remain on the local draft target. Configure **Ask** for the `commit_change` tool belonging to each installed `clinic-tools` Artifact through Tool governance; the product also requires its own authenticated approval receipt. Synthetic and actual-clinic packages have separate Artifact/Tool identities even when they share an organization and tool name. Configuring the synthetic copy does not configure the clinic copy.

Both supervised startup paths now verify the installed Artifact's exact `commit_change` policy through the authorized local Tool API after bindings become healthy and before declaring agent readiness. A missing, ambiguous, unreadable or non-Ask policy stops setup with an explicit configuration error. This check only reads policy; it never grants approvals, overrides a Deny policy or changes platform defaults. Resource package apply and relay health alone do not prove that a review gate is configured.

## Verification

```sh
python3 scripts/agent-dev.py test --tb=short
npm exec -- vitest run src/tests/unit/agent
npm run build:web
npm exec -- vite build
.venv-agent-dev/bin/python backend/tests/agent/live_local_acceptance.py
```

Use Node 22+ for Agents24’s JavaScript packages. The local migration command completed through `0043_agent_principal_binding` on the isolated database. Historical migrations expected local `anon`/`authenticated` roles; these were created as NOLOGIN roles in the local cluster. No shared or remote migration was applied. Fresh migration through 0042 was also verified against an empty disposable database; the additive 0043 principal-binding migration completed on both isolated databases.

The synthetic fixture includes a boy under 18 referred by “Agent X” after the signed approval probe, an incomplete ILS invoice, previous/current exam layouts, an overdue order, an appointment, a clinical note and a follow-up. Its invoice total is 500, cumulative paid is 100 and outstanding is 400; the separate payment-history row is not added again. Reports must export all matches, not just the preview.

## Boundaries

Originals and reports expire after seven days. Managed indexed evidence has a cleanup job; removal is asynchronous. Downloads always require fresh staff authorization. Original documents are not automatically added to permanent clinic files. Clinical conclusions and recall dates require practitioner input.

Keep provider billing/authentication blocks explicit. A successful upload or resource installation does not prove a live model run, successful OCR or clinically reliable extraction. See [the implementation acceptance record](../design-docs/agents24-clinic-agent.md) and [developer feedback](../agents24-feedback.md).

## Robustness round — 2026-10-16

The live harness is opt-in and asserts the exact local PostgreSQL database, loopback Agents24 API and synthetic demo account before running. It creates synthetic conversations/tasks/exports and writes protected evidence under `.agent-data/acceptance-*.json`. Select `approve`, `reject`, `report`, `reconnect`, `cancel` or `hostile` for a focused live case. Refresh tokens remain in the protected local session file. Finite observations reconnect by cursor to the same run; submission is never repeated.

The daily-brief check explicitly simulated admission at 06:00 Asia/Jerusalem on the local synthetic database. It is not evidence of wall-clock scheduler admission. The Hebrew job was reclaimed after a controlled worker restart/expired local lease and recovered its original completed Agents24 run; English/French also completed. Model output was inspected against synthetic facts (including ILS 400 and five-day overdue order), with missing clinical data left explicit.

Migration note: No new database migration is needed for these robustness fixes. Approval review input is retained in existing gate JSON; older already-paused gates lacking those arguments must be recreated. The public presentation adds an optional tool-call reference. Consumer job errors retain only safe platform references in existing result JSON; old generic failures remain generic. Deploy the Agents24 backend fix with the Prysm consumer fix before repeating the approval acceptance checks. No package release is needed for these backend/consumer-only changes.

## Shared-clinic reports — 2026-11-02

The clinic launcher no longer supplies a single-clinic filter. Both worker queues serve all clinics
in the configured nonproduction database; requested jobs retain their original session and clinic
permissions. The database target allowlist remains in force. Single-clinic worker arguments remain
available for deliberate operator runs, but are not a prerequisite for normal startup.

Financial report filters and date ranges reuse the query's original bound field expressions. They
must not rebuild independent ledger subqueries with the same SQL alias. Migration note: No schema
migration is needed; restart local workers after this compiler fix. Recovery of the two affected
exports is restricted to those existing failed report jobs, with their definitions unchanged.


## Coordinated published integration — 2026-11-03

Main now uses public Node/browser SDK train client 0.2.22, React 0.2.27, Chat React 0.5.41, CLI 0.3.35 and Python `agents24[fastapi]==0.7.25`. Install with the checked-in registry lock and requirements; release-input provenance is regenerated through `scripts/devdesk-release-inputs.mjs`. No package-internal copies or local links are required.

Apply additive `0050_agent_report_completion` after prerequisite 0049 on the explicitly authorized database before activating report callbacks. It adds callback evidence/retry state to existing jobs; startup never migrates automatically. The November 3 local activation used staging only and preserved production. The report worker sends stable idempotent completion receipts rather than asking the model to poll.

An SDK update that changes the Artifact manifest requires an intentional official CLI apply/publish from the authoring profile before published serving can pass its contract check. Stop authoring through DevDesk before clinic-web startup; wait for owned children to drain. A stale manifest or occupied port must fail clearly, without bypassing validation or moving ports. Current published serving and all six local service roles passed readiness. Browser chat, mid-run reload, callback completion and valid report export passed against the staging clinic database.
