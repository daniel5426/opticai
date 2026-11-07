# AI integration setup

Last Updated: 2026-11-05

Prysm uses hosted Agents24 for the clinic agent, insights, daily briefs, supplier mapping,
OCR, document embeddings and speech recognition. Campaign generation and WhatsApp replies
retain the direct OpenAI API boundary. Disabling Agents24 also selects the retained direct
OpenAI assistant and insights. No model runs offline or on the clinic computer.

- Local lifecycle and environment: [Start.md](Start.md) and the
  [Agents24 runbook](docs/references/agents24-local-development.md).
- Editable workflows and model requirements: [agents24/agents24.yaml](agents24/agents24.yaml).
- Provider inventory, data controls and verification evidence:
  [Google verification](docs/ai/google-verification.md).
- Delivery and checks: [CI.md](CI.md). Implementing locally does not publish agents,
  deploy the API/website, or send the verification email.

Provider keys stay in protected server environments. Never add them to renderer variables,
Electron packages, URLs or logs. Use the existing environment files; do not overwrite them
with a one-variable setup command. Local startup never creates or migrates a clinic schema.

Automatic AI context uses explicit clinic-record projections and removes Google integration
metadata. The backend rejects browser model overrides. Direct OpenAI Responses use
`store=false`, `background=false` and no SDK retries. These flags are not a provider-wide
no-retention guarantee; account-level no-training and routing settings need separate evidence.

Migration note: Not needed; no schema, persisted record format or public endpoint was added.
