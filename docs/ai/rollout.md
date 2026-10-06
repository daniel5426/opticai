# AI upgrade and Google review readiness

Implementation date: October 6, 2026. Changes are local; production deployment, public publication and account-settings verification remain pending.

## Routing and boundary

| Feature | Direct OpenAI model | Reasoning |
| --- | --- | --- |
| Assistant, both routes | gpt-6.1-sol | low |
| Client/medical insights | gpt-6.1-sol | medium |
| Campaign creation | gpt-6-luna | none |
| WhatsApp | gpt-6-luna | none |

Existing Prysm subscriptions retain their existing access rules. No tier, gateway, hosted tool, tracing integration or provider fallback is added. SDK is pinned to openai==3.24.0. Base URL is fixed to https://api.openai.com/v1. All requests use foreground Responses, store=false and SDK retries disabled. Conversation state is application-managed, bounded, scoped by company/clinic/user/chat/locale, and starts empty on process restart. Assistant runs are limited to eight rounds. Tool writes run sequentially, validated before execution; identical writes in one run are reused. Completed tool results remain in recovery context after failures/disconnections.

AI input projections allow clinic-entered client/family, appointment, exam headers, order/referral clinical JSON, medical-log and file metadata fields. They exclude Google identifiers, OAuth secrets, Google profile/account fields and integration objects, staff names/usernames/emails, and saved AI summaries. Tool output and exception paths use explicit projections and generic errors. Clinical JSON remains extensible with integration keys removed. This is a boundary around automatic integration data, not an origin detector for arbitrary clinic notes, chat, campaign descriptions or WhatsApp text entered by users. Calendar/auth code is unchanged. Independently clinic-entered appointment details remain eligible when exported to Calendar.

Database schema, campaign JSON filters and ai_* insight text columns remain compatible. Insight responses add locale and states without removing success. The updated frontend uses a client/locale cache to avoid rendering saved summaries in the wrong language. Existing clients can still use the routes. Chat persistence remains in the existing frontend APIs; no historical purge is performed.

## Evidence

- Backend: 80 release-gate tests passed (new AI suite plus existing production/files/layout/migration gates), and 56 tests passed across AI Responses, clinic scope, appointment writes, and backend-owned auth. New AI suite is wired into backend CI and production-promotion workflows. Includes captured requests, credential/profile/event markers, tool read/write validation, cross-company denials, multi-round recovery, interrupted streams, generator closure, duplicate-write suppression, timeout/error logging, refusal, persisted insight/campaign shapes and locales.
- App: build:web passed; 13 stream-contract/sidebar-cache/locale unit tests passed. Repository-wide tsc currently reports unrelated existing dependency/JSX and application typing errors; changed AI files produced no diagnostics in that run.
- Public policy: TypeScript passed. Browser verification loaded Hebrew RTL and English/French LTR with all 11 policy sections, no framework error overlay. Hebrew desktop/mobile screenshots inspected; policy content has no overflow at 390px. No authenticated assistant UI/end-to-end production test was performed.
- Live API: both target models accessible. All 15 target synthetic cases passed (three locales x five cases, including live tool-call streaming). Twelve available baseline cases passed; the former streaming baseline gpt-5-chat-latest returned NotFoundError in all three locales. Thirty requests were attempted; an unavailable baseline is not a passing comparison. No database or outbound message writes occurred. Results: synthetic-evaluation.json. Run: DATABASE_URL=sqlite:///:memory: python backend/tests/evaluate_ai_upgrade.py --run.

| Feature | Baseline mean ms / USD | Target mean ms / USD |
| --- | --- | --- |
| Assistant tool action | 3109 / 0.003734 | 2436 / 0.003468 |
| Streaming tool action | Unavailable (NotFoundError) | 2324 / 0.003468 |
| Empty-record insights | 1171 / 0.000373 | 3919 / 0.000630 |
| Campaign filter | 1927 / 0.001666 | 2620 / 0.000169 |
| WhatsApp draft | 1412 / 0.000443 | 1442 / 0.000020 |

Costs are Standard uncached estimates from usage, not billing reconciliation. Baselines use the former model IDs through Responses, not the old LangChain pipeline. Each feature has only three samples per version; latency/cost comparisons are directional. Automated checks cover the requested action/filter and empty-record fact restraint. Broader representative clinical review and generated-language quality evaluation are still release gates; these smoke results cannot establish clinical quality.

## Rollout requirements

1. Review broader synthetic clinical cases for grounded findings, correct tool actions and campaign filters in all locales. Verify authenticated assistant, tool progress, stop/disconnect behavior and sidebar locale changes in staging. Keep patient data out of evals.
2. Deploy backend first. The privacy projection is always enforced regardless of model env overrides. For staged model rollout, set AI_ASSISTANT_MODEL/AI_INSIGHTS_MODEL/AI_CAMPAIGN_MODEL/AI_WHATSAPP_MODEL and corresponding AI_*_REASONING to compatible direct OpenAI baseline models, then switch to table values after checks. Model rollback changes these settings only; never restore old AI endpoint/privacy code. Restart all workers to start fresh memory.
3. Output limits: AI_ASSISTANT_OUTPUT_TOKENS=8192, AI_INSIGHTS_OUTPUT_TOKENS=8192, AI_CAMPAIGN_OUTPUT_TOKENS=4096, AI_WHATSAPP_OUTPUT_TOKENS=1024. AI_TIMEOUT_SECONDS=90. AI_MAX_ROUNDS is fixed at eight. Do not set gateway base URLs.
4. Install backend pinned dependencies; no Alembic step. Deploy app frontend after backend compatibility verification. Publish prysm-web privacy changes after backend verification.
5. Record deployment IDs/commit, verify actual model routing from sanitized usage logs, Google sign-in and Calendar operations, chat/tool shapes and public /he/privacy, /en/privacy, /fr/privacy.
6. Verify OpenAI paid API billing/service and optional training-sharing settings in the actual organization/project. User confirmation is on record; account dashboard evidence has not been inspected. Record actual retention setting (standard abuse monitoring, approved MAM or approved ZDR), region and any contract exception. store=false disables stored response state; it is not evidence of ZDR. Retention currently unverified, not assumed.
7. Only then finalize completed-action wording in google-review-reply.md and reply to the existing Google thread manually. No new demo was created, no mail was sent, no approval timing is promised.

Sources: [Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [pricing](https://developers.openai.com/api/docs/pricing), [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data), [Google policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy).

Migration note: Not needed; database and persisted formats remain compatible. No shared database mutation or historical purge is included.
