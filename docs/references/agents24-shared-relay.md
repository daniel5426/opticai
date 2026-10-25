# Clinic Artifact shared relay

Last Updated: 2026-10-25

Prysm's clinic tools run in its trusted Python backend. Electron and the browser use the authenticated BFF; they do not hold an organization key or create relays. One backend app profile serves the existing `clinic-tools` Artifact and its records, workflow and reporting Toolsets through one outbound WebSocket. No public Artifact URL or HTTP tunnel is required.

## Ownership and routing

`backend/agent/relay_host.py` owns the loopback Python Artifact server and the official Agents24 CLI. The CLI uses `@agents24/node/relay` for tickets, verification, multiplexing, heartbeat, reconnect, deadlines and cancellation. Prysm implements no WebSocket protocol or browser driver. Python handlers retain their existing signatures, authenticated clinic scope and approval receipts.

The stable client UUID lives under `PRYSM_AGENT_DATA_DIR/relay/<profile>/client.json`, outside conversation state. The profile includes platform URL and integration identity. Creation is atomic, files are private, and a host lock rejects duplicate owners. An explicit `AGENTS24_RELAY_CLIENT_ID` supports deployment-managed identity. API and worker processes share that identity through durable storage or the same explicit setting. Run one host instance for that profile, rather than one in every API replica.

The authenticated BFF resolver supplies the selected backend client to the official Python SDK. New conversations and older unselected conversations acquire that default on admission. A stored selection is preserved, including while its app is offline; another app connecting cannot take it over. Changing an existing selection requires the authorized platform conversation-selection API. Browser request fields cannot select a backend client. Background jobs select the same client only when first admitted; recovery attaches to the existing run without resubmitting it.

Readiness checks the exact client and the installed clinic Artifact registration, not global Artifact availability. A disconnect does not remove the shared contract or rewrite the tool catalog. Closing chat or cancelling a run does not stop the shared host. Network reconnect never resubmits uncertain business writes.

Python currently does not advertise cooperative handler cancellation. Stop cancels the Agent run, and the relay can abort forwarding; a handler already executing may finish. A cancellation acknowledgement is not proof that a business operation stopped. Existing immutable proposals, authenticated approval receipts and idempotent commits remain authoritative.

## Development

Normal startup remains `python main.py` from `backend` plus `npm run dev`. The local-only dependency supervisor starts one relay host and the existing scoped workers, passes the stable client ID back in its readiness receipt, and cleans up only its own children. Hosted/staging/managed startup never launches local development dependencies.

Managed service entry points replace the launcher process, so the supervisor owns the actual relay/worker PID. Relay hosts and workers exit if that direct supervisor disappears. Cleanup skips exited processes, checks process-group ownership, and continues stopping other children if one group cannot be signalled. Transient database connection/pool failures in worker polling close the failed session and retry durable queue polling with 5–30 second backoff; they do not replay dispatched operations directly or terminate the clinic relay. Programming/configuration errors remain fatal and visible in protected logs.

The synthetic launcher explicitly fixes its own data directory so backend environment defaults cannot select the real-clinic storage profile:

```sh
npm run dev:agent:demo
```

For individual synthetic services:

```sh
python3 scripts/agent-dev.py relay
python3 scripts/agent-dev.py relay-status
python3 scripts/agent-dev.py api --no-access-log
```

The host starts the server declared by the package's `development.base_url`, then calls official `agents24 dev ... --client-id ...`. Protected server/relay logs live next to its identity. Source validation/apply and the existing Ask-policy readiness check remain separate from connection readiness. Do not start a second manual `artifact` or `cli dev` process beside the host.

## Published serving

The editable Artifact declares `production.transport: relay`. Use the package workflow to verify an authorized draft and publish its contract. The existing local signing secret stays in the serving backend; relay publication needs neither that secret in the cloud nor an online customer fleet.

Install the coordinated Agents24 CLI/Python release, preserve the package installation state and profile storage, and configure the backend:

```sh
# Backend environment: AGENTS24_RUNTIME_TARGET=published
# AGENTS24_BASE_URL, AGENTS24_API_KEY, AGENTS24_INTEGRATION_ID,
# AGENTS24_ARTIFACT_SIGNING_SECRET, resource IDs and durable PRYSM_AGENT_DATA_DIR.
cd backend
python -m agent.relay_host
```

Published mode calls official `agents24 serve`, never applies drafts or publishes resources. Run API and workers separately with the same profile configuration. Keep the host under the deployment's process supervisor. Node 22 or 24 and the CLI must be available; `AGENTS24_NODE` and the protected development-only `AGENTS24_DEV_CLI` can select their executables. Production defaults to the app's installed `node_modules/@agents24/cli`.

Existing public HTTP deployments can retain their explicit HTTP package configuration and set `AGENTS24_ARTIFACT_TRANSPORT=http`; they do not need a relay host.

## Package qualification and migration

The BFF addition is `AgentBffPrincipalResolution.relay_client_id` in the canonical Agents24 Python SDK. Local qualification uses a built `agents24` 0.7.20 wheel and the current CLI 0.3.30 bytes installed through `pnpm dev:agents24 -- --serve <isolated-consumer>`. These source versions are not evidence of public release availability. Deploy the matching coordinated SDK/backend train before a fresh production installation; do not replace it with copied package internals or workspace links.

Migration note: No clinic database migration is required. Persist the new profile identity independently of conversations. Older unselected threads bind on their next admitted message; selected threads and admitted runs retain their existing client. Remove legacy development relay processes before starting the profile host. Preserve historical session/audit data and existing package resource identities. No production deployment or remote clinic database mutation is part of this change.

Verification commands and historical acceptance remain in [local development](agents24-local-development.md) and `backend/tests/agent/test_state.md`. The read-only live probe is:

```sh
.venv-agent-dev/bin/python backend/tests/agent/live_local_acceptance.py relay
```

## Verified on 2026-10-22

The consumer backend suite passed **183 tests**, with one optional PostgreSQL migration fixture skipped; agent UI tests passed **101**. Web and Electron builds passed. The canonical Python BFF suite passed **39**, including 12 shared-relay cases. Local source-package validation, planning and draft apply passed. The real synthetic read-only probe returned ILS 400 through clinic tools and restored the same conversation/client selection. Duplicate-host rejection, offline status and restart with the same identity passed. No production rollout or live published-clinic test was performed.

## Artifact contract qualification — 2026-10-25

The current integration retains one Artifact with three Toolsets and the official CLI relay. Clinic exports are asynchronous SDK handlers. A bounded 16-operation thread pool creates, uses and closes each synchronous SQLAlchemy session inside its worker, so slow authorization or queries cannot block the Artifact health endpoint or unrelated relay requests. Python handlers still do not claim cooperative cancellation or rollback of dispatched writes.

Rejected authorization, invalid fields and unexpected clinic failures now raise the public SDK's `ArtifactInvocationError` with safe messages. They are failed Artifact invocations rather than successful invocations containing an application error dictionary. Existing successful receipts and approval/idempotency behavior retain their shape. No prompts, Toolset membership or export schemas changed.

Qualified local train: Python 0.7.21, CLI 0.3.31, Node 0.5.28, Client 0.2.19, React 0.2.24 and Chat React 0.5.37. JavaScript dependencies were installed from the canonical `pnpm dev:agents24 -- --serve` registry and the owning npm lockfile regenerated. Python was installed from a wheel built from the corresponding local SDK source. Stale `.agent-data/sdk-consumer` CLI overrides were removed from the two protected local environment files; normal startup uses the installed CLI. These locally built bytes do not establish public release availability. Coordinate release before deploying this train.

Focused backend contract/relay/policy/recovery tests: 40 passed. Agent UI tests: 101 passed. Source-package validation and web build passed. Synthetic live relay returned the expected balance through four clinic tools and restored its saved client/thread selection. Live approval saved once and replayed its receipt; rejection saved zero. The old acceptance fixture had a fixed date and assumed the HITL notification and paused snapshot arrived in one stream lease. It now uses a future clinic date and bounded attachment to the same admitted run; incomplete synthetic probes were cancelled. No actual-clinic business writes, schema migration, hosted staging, production operation or public package publication was included.
