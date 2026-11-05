# Start OpticAI

Last Updated: 2026-11-03

Use `devdesk start opticai --wait --open` or **Start OpticAI.app**. Default: clinic web.

Profiles: `clinic-web`, `clinic-electron`, `demo-web`, `demo-electron`. Select with `--profile`.
Google sign-in uses separate web and desktop clients. Local web exchange needs
`GOOGLE_WEB_CLIENT_ID` and `GOOGLE_WEB_CLIENT_SECRET` in `backend/.env`; see
[Google OAuth configuration](docs/references/google-oauth.md) for exact callbacks
and desktop credentials. Restart the local instance after changing API env.
Run `devdesk doctor opticai` before diagnosing dependencies. App-owned workers, relay and renderer start and stop with OpticAI. The configured Agents24 API and hosted/shared clinic database are external dependencies and must already be available; they are never stopped with the app. The legacy demo database uses a shared native PostgreSQL host, which is an independent host prerequisite. App-exclusive local database services must declare automatic lifecycle commands in `devdesk.json`. Clinic mode uses `backend/.venv/bin/python` and protected `backend/.env`; demo uses `.venv-agent-dev/bin/python` and `.env.agent-dev`. Required variable names and the authoritative database, clinic, resource and Ask-policy checks are in [the local development runbook](docs/references/agents24-local-development.md).

Hosted Agents24 clinic ports: 8000, 8001, 4316, 5126. Legacy local-draft clinic mode uses Artifact port 4317. Demo ports: 8016, 4316, 5136. Ports stay fixed; conflicts report the owner. Do not kill another stack or silently change the port. The underlying entrypoint remains `scripts/clinic-dev.py up --browser` (omit `--browser` for Electron); demo uses `scripts/agent-dev.py`.

`devdesk status --json` identifies the instance and service health. `devdesk logs <instance>` shows bounded redacted launcher logs; protected per-service logs remain under `.agent-data`. `devdesk stop <instance>` and `devdesk restart <instance>` use the same ownership model. Closing the dashboard or Codex leaves the instance running. Repeated starts reuse it.

Startup does not migrate or seed a clinic database. Migrations remain explicit and require exact-target authority. Preserve the database allowlist, job authorization, queue separation, relay identity and installed Ask-policy checks. Local requested and summary workers serve all clinics in the configured database. Isolated demo data remains separate from clinic data. No shared database, platform resource publication or hosted change is authorized by Start.

Reinstall the Spotlight launcher with `devdesk shortcuts install opticai`. Worktrees register independently through `devdesk register <checkout>`; select the returned app key when multiple checkouts are registered. Existing profile validators deliberately enforce their fixed ports.

Existing sessions are detected by repository, launcher identity, listening ports, readiness and required child roles. Healthy sessions started outside DevDesk appear as Running; Start/Open reuses them without launching another stack. Historical blocked attempts stay in Activity. External sessions remain observed until you explicitly choose **Manage session**; that action allows Stop/Restart of the verified launcher and its children. App-owned services follow the app lifecycle; separate apps, hosted/shared databases and shared host engines remain independent. External logs remain with their original launcher.

## Manual table export consumer

Each API process owns an in-process `table_exports` consumer for leased `table_export` jobs. It starts and stops with the API already declared in `devdesk.json`; no additional service or Agents24 connection is required. API shutdown signals the consumer to stop; cooperative interruption requeues work, and abruptly terminated attempts recover through their leases. The automatic consumer stays off for in-memory SQLite; isolated tests invoke it explicitly with their own sessions. Generated Excel/CSV files use the existing protected `PRYSM_AGENT_DATA_DIR`, with seven-day expiry and API-owned cleanup. API replicas must share that durable directory, as with existing agent reports. Hosted/shared databases remain external; startup never applies an export migration.
