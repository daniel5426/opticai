# Prysm clinic agent

Last Updated: 2026-10-25

## Ownership and scope

Agents24 owns model execution, tool orchestration, durable conversations, streaming and tool-review interrupts. Prysm owns staff authentication, clinic/patient authorization, business validation, approval receipts, records, originals and generated downloads. The editable resources live in `agents24/`; the consuming backend lives in `backend/agent/`. No organization key reaches the Electron renderer.

`PrysmAgentProvider` keeps one SDK session above the clinic workspace. The main assistant page and the existing patient sidebar share the active runtime and thread. Only the SDK session remounts when the authenticated user, selected clinic or patient scope changes. Clinic editors remain mounted. Thread IDs are remembered locally; message history comes from Agents24. Existing chats remain a read-only archive.

The BFF derives the acting user from the existing staff session and validates the selected clinic and optional fixed patient. The BFF registers the SDK-resolved customer principal against its validated staff session and clinic/patient scope. It resolves that principal once per context, retaining only the opaque reference. Conversations use stable staff identity and chat scope without an expiring session partition. Signed tools resolve the trusted principal/scope to an active registered staff session and recheck current permissions; model arguments never choose the acting user. Refresh transfers context bindings. Revoked/expired sessions cannot grant tool authority. The same staff member can reopen history and review unexpired owned proposals after login, with fresh authorization. Daily background briefs retain their separate read-only job authority.

## Shared Artifact relay

The clinic backend owns one stable app-profile relay for the existing Artifact and all three Toolsets. Electron remains an authenticated BFF client. Draft and published modes use the official CLI/Node relay with loopback forwarding, without a public Artifact URL. Conversations retain their selected backend client across reconnect/restart, while background jobs snapshot it only at first admission. See [ownership, commands and migration](../references/agents24-shared-relay.md).

## Search and report redesign

The current search/catalog, native attachment composer, contextual suggestions, versioned snapshot reports and staged patient-document library are described in [search and reports](agents24-search-reports.md). Its rollout and acceptance notes supersede the legacy ordinary-chat document-job path below.

## Capabilities

- Authorized patient lookup/history, actual exam-layout measurements, sourced exam comparisons and minus-cylinder equivalence; an order check uses the explicit staff-selected prescription component.
- Reviewable patient, exam, measurement-instance creation/update, appointment, medical-log, referral and regular/contact-lens order drafts. Order persistence uses the existing shared-order-group service in the same transaction as its receipt; legacy order provenance is retained.
- Duration-aware slots with opening hours, breaks, working days, calendar holiday exclusions, staff vacations and existing bookings. Manual appointment writes and agent commits share the clinic booking lock. Bulk rescheduling prepares and reviews each appointment separately.
- Follow-up tasks with an explicit assignee, due date, source, status, revision and event history. Staff manage their own tasks; managers can assign active staff in the selected clinic.
- Validated reports over the catalog’s clinic datasets. Natural-language requests resolve to supported fields and `all`/`any` filters, grouping, aggregates and sorting. Arbitrary SQL and invented fields are rejected. Patient age uses an explicit report date; unknown birthdays do not match age comparisons. Shared invoices have one payer/owner; cumulative paid amounts are not summed again with payment-history rows. Monetary totals remain separate by currency. Payment reports aggregate payment amounts rather than repeating invoice totals.
- Report previews have an exact count and 25 rows. Excel/CSV jobs export the complete query, preserve their definition, neutralize spreadsheet formulas and use authenticated downloads. Retry keys are bound to the exact definition.
- PDF/image OCR and native DOCX/text intake through managed upload sessions and published Agents24 pipelines. New measurements use an explicitly selected clinic template and the existing search index. Originals stay in Prysm, with authenticated downloads and seven-day retention. Completed processing returns full content and canonical source evidence; the agent prepares record drafts from it. Partial/blank extraction remains explicitly incomplete.
- A deep, read-only full-clinic brief is admitted once per clinic/date/language from 06:00 `Asia/Jerusalem`, including DST. It covers today’s patient preparation, clinical history, overdue orders, outstanding balances, due tasks and low stock. The empty main-chat screen shows concise icon bullets with expandable detail. Failed briefs can be retried explicitly.
- Sidebar insights keep the existing input, seven sections and visual presentation. Locale/fingerprint caching survives process restarts; concurrent requests in one API process share the same generation. No additional record categories were added to that sidebar input.

## Every business write is reviewed

`prepare_change` stores an immutable proposal, its before state and expiry. It does not change a business record. Agents24’s `commit_change` tool must be configured to **Ask** in Tool governance. The product approval card fetches the saved proposal and shows the affected patient and before/after values.

An authenticated staff click records approval for that exact proposal, then resumes the platform interrupt. The signed commit independently requires that receipt, rechecks current permissions, subscription access, patient identity, revision/snapshot, expiry and booking constraints, and commits the business write plus its receipt atomically. Repeating the same committed proposal returns the same receipt. Rejection, cancellation and stale proposals do not imply successful writes. Reads and report generation need no business-write approval.

## Local acceptance and rollout

Use the isolated commands in [local development](../references/agents24-local-development.md). Migrations `0042_prysm_agents24` and `0043_agent_principal_binding` are additive. They introduce application contexts, immutable changes, follow-up tasks/events, jobs, insight caches and the trusted principal binding; existing clinical records and old conversations are preserved.

Verified locally on 2026-10-16: tool-backed balance (ILS 400), sourced exam comparison, Hebrew/French chat, scheduling, unknown patient/unsupported field, explicit approval and idempotent save, rejection without a write, protected CSV/Excel exports, disconnection/reattachment to the same run and cancellation. Electron approval saved exactly one synthetic task; rejection saved none; restored review cards show the exact proposal without a false error. Sidebar warm requests measured approximately 11 ms in the earlier local probe. PNG/scanned PDF/DOCX processing returned complete synthetic content; a corrupt PNG failed safely with a platform failure reference. Hebrew/English/French daily briefs completed with six source-checked items each after explicit local 06:00 simulation. A restarted worker recovered the original Hebrew run through canonical history after event retirement.

Automated checks: **99 Optical backend**, **21 frontend** and **46 focused Agents24 backend** tests passed. Web build passed with existing bundle/dynamic-import warnings. Earlier resource validation and Electron build passed; the workspace-wide TypeScript check has unrelated existing diagnostics. The final full live round passed 12/14; two tool-unavailable responses during concurrent platform reloads passed targeted rechecks afterward. Every scenario has a passing observation across rounds, with no claim of an uninterrupted 14/14 run. The opt-in harness and protected evidence locations are documented in the local-development reference; later results supersede historical provider-blocked acceptance notes.

The robustness fixes live at their owners: Agents24 persists exact reviewed arguments before dispatch and hydrates pause/terminal/history consistently, publishes the trusted call link, safely classifies streamed provider errors and captures bounded OCR correlation. Prysm accepts valid SDK-encoded interrupt IDs while rejecting unsafe paths, uses exact call identity for approval cards, preserves canonical failure references, recovers background output from completed snapshots/history, retains server-owned patient company identity, avoids appointment self-conflicts and permits partial referral edits.

Remaining acceptance: representative production/large-clinic concurrency and latency, difficult handwritten/multipage OCR, exhaustive medical accuracy and broad process/network-kill fault injection. Hostile prompts produced an explicit refusal in one completed round and safe upstream MODEL_INVOCATION_FAILED in others, with zero business writes; broader refusal quality remains unverified. The earlier clean OCR HTTP 400 did not reproduce on unchanged inputs/settings; its historical provider reason was not retained. Current successful scans do not prove universal extraction quality.

Production rollout is not performed by this work. Before enabling `AGENTS24_ENABLED`, apply both migrations through the authorized production workflow, publish the coordinated SDK/CLI train and resources, publish the verified relay Artifact contract, configure its local signing secret and start one shared backend relay host, set the commit tool’s Ask policy, configure the executable pipeline IDs and usable provider routes, and start the worker. API and worker must share durable `PRYSM_AGENT_DATA_DIR` storage. Current local filesystem delivery is suitable for a shared host/volume; separate production replicas need a canonical shared-storage integration. There is no startup schema mutation, provider fallback, campaign change or WhatsApp change.

Known integration findings are recorded in [Agents24 feedback](../agents24-feedback.md).
