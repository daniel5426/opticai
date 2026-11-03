# Hosted clinic agents

The API owns requested-work and summary subprocesses when both
`AGENTS24_ENABLED=true` and `PRYSM_HOSTED_AGENT_WORKERS=1`. Keep the API at one
replica and mount durable storage at `PRYSM_AGENT_DATA_DIR=/data/prysm-agent`.
Workers and authenticated downloads must see the same report/upload files.
Stopping the API terminates its workers; exited workers restart after five seconds.

Each environment has a separate private relay service built from the repository
root with `deploy/agents/Dockerfile`, Dockerfile builder, and start command
`python -m agent.relay_host`. Set one replica, IPv6 egress enabled, no HTTP health
check, no pre-deploy command, and restart on failure. No public domain is needed.
The image installs the locked public CLI on Node 22 and the backend's pinned
Python dependencies. Upload only a tracked-source snapshot; exclude root
`railway.json` from the relay upload because it configures the web service.

API, relay, and workers use the same published resource IDs, server-only API key,
Artifact signing secret and explicit `AGENTS24_RELAY_CLIENT_ID` within each
environment. Use distinct relay UUIDs and integration IDs (`prysm-staging` and
`prysm-production`), and the matching environment's database/auth configuration.
Keep the API disabled while configuring. Verify the exact relay's published
Artifact registration is connected, healthy and ready before enabling the API.
Never apply drafts or publish a new resource package as part of serving.

Runtime verification: API health, two worker processes, authenticated agent
availability, and exact-client published relay health. Perform clinical probes
read-only; use synthetic data for write/approval tests. On rollback disable
`AGENTS24_ENABLED` first, preserving durable files, relay identities and jobs.

Migration note: No database migration; this adds opt-in process ownership and
durable agent storage. Deploy the backend code before enabling hosted workers.
