# Clinic agent tests

Last Updated: 2026-11-05

## Shared local workers across clinics — 2026-11-02

Removed the clinic launcher's mandatory single-clinic filter and its environment requirement.
Requested and summary workers serve all clinics in the configured database. Optional explicit
clinic filters remain supported by the standalone worker CLI. Existing job/session/company/clinic
authorization, database target allowlist and separate requested/summary queues are unchanged.
The shared-claim regression covers jobs from two clinics; scoped-claim regressions remain intact.
Commands: `backend/.venv/bin/python -m pytest backend/tests/agent/test_local_setup.py backend/tests/agent/test_worker_queues.py -q`
— **23 passed**, three existing warnings. `backend/.venv/bin/python -m pytest backend/tests/agent/test_request_authorization.py -q` — **14 passed**, existing warnings.
The first live claims exposed a separate report compiler defect: nested financial/date filters rebuilt
invoice-ledger aliases. Query projection and filters now reuse the same bound field expressions.
`backend/.venv/bin/python -m pytest backend/tests/agent/test_search_reports_v2.py -q` — **22 passed**,
existing warnings; exact affected PostgreSQL queries also validated with zero-row reads.
Migration note: No schema or job migration is required. Restart local workers to pick up already
queued reports. Live recovery: both affected clinic-65 reports completed after the guarded retry;
XLSX, CSV and saved snapshots verified (one and two result rows). Only those failed exports
were requeued; no Agent/model request or business-record write was repeated.

## Hosted Prysm organization migration — 2026-11-02

Scope: allow only the official HTTPS production platform with published resources in the clinic
profile; preserve the database/clinic allowlist, reject remote draft mode and lookalike URLs,
verify exact installed write-tool Ask policy with read-only calls, and prohibit draft apply during
published serving. Synthetic mode remains local-only. Command:
`backend/.venv/bin/python -m pytest backend/tests/agent/test_local_setup.py backend/tests/agent/test_approval_setup.py backend/tests/agent/test_process_lifecycle.py backend/tests/agent/test_normal_startup.py -q`
— **57 passed**, two existing warnings. Web build passed. Live publication installed all nine
resources with four GPT-6 Luna Agents and three healthy toolset bindings. Standalone model probe
completed. Authenticated web chat called clinic_context successfully and returned Asia/Jerusalem;
reload restored the same conversation without another submission. All three published ingestion
executables passed input-schema checks; fresh OCR/speech/embedding execution was not repeated.
No database schema migration or business mutation is part of these checks.

## Worker disconnect and process ownership — 2026-10-25

Scope: transient database polling failures retry with capped 5/10/20/30-second backoff, successful polling resets backoff, failed sessions close before the next poll, and private DB details stay out of logs. Programming errors propagate. Managed worker/relay entry points exec the service, detect loss of their direct parent, skip stale process groups and continue cleanup after group permission errors. Command: `.venv-agent-dev/bin/python -m pytest -q backend/tests/agent/test_process_lifecycle.py backend/tests/agent/test_normal_startup.py backend/tests/agent/test_shared_relay.py backend/tests/agent/test_worker_queues.py --tb=short` — **45 passed**, three existing warnings. Live ordinary startup, full shutdown of seven owned processes, released ports/readiness receipt and a second clean startup passed. The existing platform API on 8026 stayed healthy. Database outage recovery is fault-injected; no remote database/network configuration was changed. No schema migration or hosted environment mutation.

## Updated Artifact contract — 2026-10-25

Scope: signed public SDK invocation, manifest/Toolsets, strict inputs, HMAC rejection before authorization, foreign patient and revoked-session denial, safe failed Artifact receipts, exact-once synthetic approval/commit replay, and nonblocking health while a worker holds a slow authorization operation. SQLAlchemy session creation and operation execute on the same worker thread. Command: `.venv-agent-dev/bin/python -m pytest -q backend/tests/agent/test_artifact_contract.py backend/tests/agent/test_shared_relay.py backend/tests/agent/test_approval_setup.py backend/tests/agent/test_runtime_recovery.py --tb=short` — **40 passed**, 35 existing warnings. New boundary file alone: **10 passed**. Agent UI suite after package refresh: **101 passed**; package validation and web build passed.

Live synthetic relay/history and approval passed; approval saved exactly one task, replay returned its receipt, and rejection saved zero. Initial rejection probes exposed a finite-stream assumption in the harness; bounded reattachment to the same admitted run now observes its paused snapshot, and earlier incomplete probes were cancelled. The approval date is now relative to the current clinic date instead of a fixed historical date. Actual-clinic browser check used only clinic_context and returned the correct date/time zone after a shared backend initial-history regression was repaired; no patient-record reads or business writes were requested. The shared owner regression file passed **17 tests**. Published-fleet rollout, cooperative Python cancellation and prolonged remote-database/network outages remain outside this qualification. No schema migration or hosted environment mutation.

## Shared Artifact relay — 2026-10-22

Scope: atomic stable backend identity, concurrent starters and platform/profile separation; duplicate-owner lock and occupied-port rejection; official draft/published serving modes and owned-child shutdown; selected-client readiness; trusted BFF/background admission and recovery without resubmission; shared SDK shutdown; synthetic data-directory isolation; receipt propagation through normal startup. Existing clinical authorization and approval tests remain unchanged.

Commands/results: `python3 scripts/agent-dev.py test --tb=short` — **183 passed, 1 skipped** (optional isolated PostgreSQL migration fixture; no new schema migration). `npm exec -- vitest run src/tests/unit/agent` — **101 passed**. `npm run build:web` and isolated Electron `PRYSM_DEV_DATA_DIR=/tmp/opticai-relay-electron-profile npm exec -- vite build` passed with existing bundle/import warnings. Canonical Agents24 Python BFF suite — **39 passed**, including 12 relay cases.

Real local synthetic qualification: `.venv-agent-dev/bin/python backend/tests/agent/live_local_acceptance.py relay` passed with clinic_context, patient_history and reporting tools, expected ILS 400, selected-client persistence and restored history; zero business writes. Duplicate host rejected while the original remained healthy; shutdown reported disconnected/zero ready registrations; restart reused the same client and restored readiness. Protected evidence: `.agent-data/shared-relay-acceptance.json`. Source package validate/plan/apply passed against the existing local Agents24 API; public publication and production serving were not performed.

Gaps: no production load or live published-clinic qualification. Python advertises no cooperative handler cancellation; uncertain in-flight writes are not replayed. Matching Agents24 SDK/backend release is required for production. See [relay ownership and migration](../../../docs/references/agents24-shared-relay.md).

Scope: staff/clinic/patient authorization and session revocation; immutable proposals, explicit approval, replay/stale/expired receipts; protected and unknown fields; create/update for patients, exams, appointments, medical logs, referrals and regular/contact orders; patient company ownership; partial referral updates; appointment overlap, vacations and booking boundaries; report filters, monetary semantics and formula-safe downloads; task/audit permissions; upload validation and expiry; canonical failure references; exact-run recovery after event retirement and completed snapshots without deltas; daily DST/deduplication; BFF streaming.

Approval installation readiness (2026-10-19): exact installed Artifact identity, a healthy synthetic copy masking the clinic copy, Ask versus Allow/Deny/missing policy, missing/duplicate Tools, paginated authorized reads, remote target rejection and safe read errors. Command: `.venv-agent-dev/bin/python -m pytest -q backend/tests/agent/test_approval_setup.py backend/tests/agent/test_local_setup.py backend/tests/agent/test_normal_startup.py --tb=short` — **44 passed**, two existing warnings. Existing UI regression: `npx vitest run src/tests/unit/agent/approval.test.tsx src/tests/unit/agent/submission.test.tsx` — **13 passed**. Synthetic live acceptance commands `...live_local_acceptance.py approve` and `... reject` both passed: exactly one saved task with same-key replay; zero tasks on rejection. Actual clinic's unchanged draft displayed the card, then a subsequent Electron approval completed with a saved receipt; verification did not click Approve. Gap: no deliberate normal-clinic restart while its user was working; the new policy read was executed directly against the live installation, and existing supervisor/ownership tests passed. No hosted changes or schema migration.

Local setup scope: synthetic mode rejects shared/remote databases; actual-clinic mode allows only the known nonproduction database and requires one explicit clinic. Both reject remote platform URLs, published targets, disabled integration, mismatched ports and missing credentials without echoing environment values. Worker tests cover separate requested/summary queues, expired-lease recovery, clinic-scoped claims/admission/retention, summary deduplication and an actual requested-worker XLSX export behind older briefs without scheduling more summaries.

Last command: `python3 scripts/agent-dev.py test --tb=short -x`.
Result: **124 passed, 1 skipped**, 39 existing dependency/auth-clock warnings, 2026-10-18. SQLite unit database; optional PostgreSQL migration test skipped. Focused queue/setup command: `.venv-agent-dev/bin/python -m pytest -q backend/tests/agent/test_worker_queues.py backend/tests/agent/test_local_setup.py --tb=short -x` — **24 passed**.

Actual-clinic report recovery: existing queued report `017da1c6-2195-4b59-85dd-1061988e7880` was consumed by the separate clinic-scoped requested worker and completed with 116 rows. Its XLSX opened successfully with Records and Definition sheets and 116 data rows, matching a fresh scoped query. The signed-in Electron report card showed Ready; its download button saved `prysm-report-2026-10-18.xlsx` with 116 rows and an identical SHA-256 to the worker output. Evidence: `.agent-data/report-worker-verification.json`. The clinic launcher rejected an attempted `--clinic-id 999` override. Actual-clinic evidence is separate from the historical synthetic checks below; no hosted service deployment or production change occurred.

Current local API acceptance: **14/14 passed** in one uninterrupted round, evidence `.agent-data/acceptance-8b5ca527.json`. Tool-backed patient balances, exam comparison, Hebrew/French, scheduling, missing data, exact-once approval, rejection, authorized CSV download, reconnect, cancellation and an explicit hostile-request refusal passed. Separate native text and PNG OCR jobs completed with the expected sphere/cylinder/axis values; evidence `.agent-data/local-setup-documents.json`. `python3 scripts/agent-dev.py migrate` completed successfully against the existing local `opticai_agent_dev` database with no pending revision to apply. No shared/production mutation.

Real-model acceptance: `.venv-agent-dev/bin/python backend/tests/agent/live_local_acceptance.py` (run from repository root; opt-in synthetic writes on guarded local PostgreSQL/API). It covers bootstrap, patient balance/exams, Hebrew/French, slots, unknown patient/field, approval/rejection/replay, authenticated CSV downloads, disconnection/reattachment, cancellation and hostile requests. Evidence is protected under `.agent-data/acceptance-*.json`; see the canonical acceptance record for final results. The harness follows finite stream lifetimes by reattaching with the cursor to the same run; it never resubmits the prompt.

Separate live checks: Electron approval saved exactly one synthetic task and native rejection saved zero; restored cards show the exact proposal. Clean PNG/scanned PDF/DOCX processing completed; a corrupt PNG failed with a safe platform support reference. Scheduled Hebrew/English/French briefs completed with six items each, after explicit local 06:00 clock simulation; a restarted worker recovered the original Hebrew run without creating another run. No production writes.

Gaps: production/multi-worker PostgreSQL races, large-clinic load, difficult handwritten/multipage clinical OCR, exhaustive medical correctness and physical network/process interruption coverage. Hostile prompts have produced both an explicit refusal and safe upstream MODEL_INVOCATION_FAILED, with zero business writes. A provider failure does not establish conversational refusal quality.


Final live round (`acceptance-4b197120.json`): **12/14 passed**. The initial patient-balance and exam-comparison calls encountered unavailable clinic tools during concurrent local platform reloads and returned explicit unavailable-data answers. Both passed targeted rechecks without a product-code change: balance run `7fbd95aa-c0da-47f2-ad19-35826bcc6a08`, exam run `b0c3a3c5-2ecb-4c49-8328-c8051fdde683`. Thus every scenario has a passing live observation across the rounds; this is not a clean 14/14 uninterrupted final run or a production reliability claim. The final reconnect/cancel/export/approval/rejection cases passed; hostile input failed safely upstream with zero writes. Earlier runs also include a verified explicit refusal. Canonical evidence stays protected under `.agent-data/`.

## HITL submission receipts — 2026-10-18

Scope: fresh joined session/user and clinic/context/patient authorization; two-SELECT warm budget and no read-path writes; revoked/expired sessions, inactive staff, company and clinic isolation, maintenance, foreign/deleted patients; context creation race; closed connection during remote principal resolution and fresh reauthorization; slow DB does not block async requests; canonical company fallback. Existing synthetic approval/commit and worker tests remain included.

Command: `PYTHONPATH=backend backend/.venv/bin/python -m pytest -q backend/tests/agent` — **142 passed, 1 skipped**. The 14 focused authorization cases passed. Real clinic authentication latency comparison is pending staff sign-in; no cross-request authorization cache was introduced. No database migration.

## Normal startup — 2026-10-19

Scope: development-only automatic dependency ownership, exclusion of production/staging/Railway/remote/managed targets, readiness before API traffic, shutdown cleanup, local launch target/clinic guards and consistent port 8000. `backend/.venv/bin/python -m pytest -q backend/tests/agent` — 158 passed, 1 skipped. Real normal-command startup reached 3/3 healthy Toolsets with one relay; actual-clinic conversation restored and its pending request resumed. A duplicate normal backend exited with code 3 without disturbing the original API, relay or ready receipt. Owner/shutdown behavior is covered by focused lifespan tests; production and staging lifespan tests prove no local subprocess is invoked. The user continued a live question and draft with working clinic tools, so no additional request or restart interrupted their work. No database migration or hosted change.

## Search, contextual chat and report snapshots — 2026-10-25

Shared catalog/search, measurement component identity and versioned similarity; source/deletion/merged/patient authorization; resumable backfill readiness; partial/zero/equivalent values and both-eye pairing; stable relevance pagination; nested same-record relationships and distinct counts; local timestamp boundaries; formula-safe immutable snapshots and full exports; currency-separated charts, numeric derived metrics and zero denominators; private saved definitions/revisions; authenticated report pages/exports/expiry; staged permanent-file revision/session reauthorization.

Commands: `.venv-agent-dev/bin/python -m pytest backend/tests/agent backend/tests/test_prescription_search_index.py backend/tests/test_unified_search_details.py backend/tests/test_analytics_foundation.py -q` — **233 passed, 1 skipped**. `npx vitest run src/tests/unit/agent` — **118 passed**. Web build passes with existing chunk warnings. Workspace `tsc --noEmit` still reports unrelated existing/dependency errors; no diagnostics reference the changed agent components/context/tests.

Local synthetic migration 0045 and per-source prescription backfill passed, with `ready=true` and zero pending rows. No shared or remote database was migrated/backfilled. Native SDK screenshot acceptance run `b5367899-1700-4f39-8acb-8b4dcf1a3b3d` extracted both eyes, found Adam Synthetic, ranked the exact exam before its older nearby alternative and restored attachment history. Browser production composer/runtime testing preserved the selected image while filling/selecting a prompt blank, submitted through native attachment processing, and rendered the structured patient result. Hebrew dark/narrow and English/French presentation were inspected using synthetic fixtures.

Live report run `7d64ed46-8853-444b-b908-38f69a3c21a0` called clinic_context, report_catalog, run_report and read_report; completed with seven metrics and ILS 400 outstanding. The worker used PostgreSQL and both authenticated XLSX (6,843 bytes) and CSV (628 bytes) exports passed. Protected evidence is under `.agent-data/native-search-*` and `.agent-data/live-report-acceptance-*`.

Full-package draft apply is blocked by inclusion of the subsequent `document-search` resource despite passing remote validation; omitting only that resource in a protected validation copy permits core draft acceptance. Permanent-library live ingestion/retrieval is not qualified. A separate Electron fixture was launched, but native-window targeting was ambiguous with the user's existing Electron instance; no native UI actions were performed against that instance. Electron transport unit coverage passes; a complete new native UI flow remains a rollout check. See [implementation and rollout](../../../docs/design-docs/agents24-search-reports.md) and [platform reproduction](../../../docs/agents24-feedback.md).

## Response-owned reports and declarative report visuals — 2026-10-25

New report presentation schema validates chart kinds/column aliases/labels, separates currencies, generates stat cards only from one aggregate row per currency, preserves snapshots on rerun/export, and normalizes older definitions for idempotent retries. Job metadata requests return name/download/status without the large result and retain clinic/patient ownership checks; the existing default job response is unchanged.

Checks: full agent plus analytics/prescription/unified-search backend selection — **235 passed, 1 skipped**. Full agent UI — **127 passed**; web build and local/remote resource validation pass. Workspace TypeScript still has existing unrelated errors; no errors reference the new report UI components/helpers. New tests cover report placement after final answer text, receipt deduplication/legacy names, two named downloads without a Ready badge in he/en/fr, expiry, invalid pie distributions, validated presentation, safe KPI totals and old-definition retries.

Real-model synthetic run `55954e54-cf5a-4008-9c97-44b20d93fcbf` completed two report executions: Payment mix selected a pie chart; Clinic totals selected a bar chart and two stat cards, including recorded ILS 400 outstanding. Both returned matching report-name/download metadata. Protected evidence: `.agent-data/generative-live-events.json`. Browser inspection verifies area/donut/stats presentation and equal-width download cards at the end of the response, with no composer report rail, including narrow Hebrew RTL/dark and English/French LTR.

The owner subsequently authorized staging only. Supabase `opticai` (`eoyqvffwzllggemzfxaw`, verified against deployment configuration) was upgraded through 0045/0046 with Alembic. The approximately 9.2-million-row prescription table received its component index concurrently; verification confirms a valid/ready index, nullable column, private RLS-protected tables and zero readiness/document-mapping rows. The API, Artifact relay and workers were restarted; current report/attachment workflow and assistant instructions were applied to the existing local clinic draft. API/database/Artifact health, metadata-only job parameter, presentation manifest, relay readiness and 3/3 healthy Toolsets passed. Final backend selection with isolated PostgreSQL enabled: **238 passed**; migration upgrade/retry/downgrade checks passed on both SQLite and PostgreSQL. No production mutation, backfill, permanent-document ingestion or publication occurred.

## Durable report completion integration — 2026-11-02

Isolated integration checkout only. Focused Agent backend selection: **35 passed**. `backend/.venv/bin/python -m pytest backend/tests/agent/test_report_completion.py -q --tb=short`: **3 passed**, including uncertain callback retry reusing the exact saved payload despite later job-result changes. Report helpers return explicit pending work; worker-owned callback leases/backoff release DB sessions before HTTP. Trusted principal binding reauthorizes membership and snapshots current locale/clinic/user facts. Existing clinic routing baseline remains untouched. Additive `0050_agent_report_completion` applied only to disposable `prysm_integration_latency_test`; legacy empty-bootstrap index collision is documented in the platform integration record. Real authenticated clinic/report qualification against the new backend remains outstanding.


## Published lifecycle adoption — 2026-11-03

Applied the resolved integration to the existing dirty main checkout, preserving unrelated changes and shared clinic workers. Public `agents24[fastapi]==0.7.25` installed; dependency check passes. Command: `APP_ENV=test DATABASE_URL=sqlite:///:memory: PYTHONPATH=backend backend/.venv/bin/python -m pytest backend/tests/agent/test_runtime_recovery.py backend/tests/agent/test_request_authorization.py backend/tests/agent/test_artifact_contract.py backend/tests/agent/test_report_completion.py -q --tb=short` — **33 passed**, 78 existing warnings, 2.17 s. Scenarios include principal binding/denial, trusted facts, explicit pending results, immutable completion retry and report authorization.

The owner applied staging prerequisite 0049. Guarded Alembic upgrade to `0050_agent_report_completion` then succeeded only on staging project `eoyqvffwzllggemzfxaw`; revision and both new columns verified. No unrelated transaction was terminated. Updated main Agent instructions and the SDK-derived Artifact contract were applied/published through the official CLI, then DevDesk clinic-web reached readiness with both APIs, Artifact/relay and both worker queues. Ask policy, existing GPT-6 Luna binding and generation limits were preserved.

Live browser verification: trusted business date/timezone answered correctly; a new aggregate-only inventory report completed after a reload during the active run, without resubmission. One report job, one completion reference, one delivery attempt, delivered=true, blocked=false, no retry deadline. XLSX export saved and opened with openpyxl (5,634 bytes, two sheets). Empty inventory produced an honest zero-row report. No patient/billing query or business mutation was requested. Navigation/history remained mounted. Earlier clinic-selection load emitted a routing-depth error before the authenticated session became available; subsequent authenticated reload and report recovery passed. Full signed-out auth/routing qualification and fresh OCR/speech/embedding execution were not repeated. No Prysm production schema/application deployment.


## Supply inventory acceptance — 2026-11-03

Commands: `APP_ENV=test DATABASE_URL=sqlite:///:memory: PYTHONPATH=backend backend/.venv/bin/python -m pytest backend/tests/agent/test_supply_intake.py backend/tests/agent/test_supply_routes.py -q --tb=short` — **22 passed**, 3.24 s; separate inventory collection `backend/tests/test_inventory_file_import.py backend/tests/test_inventory_v1.py` with the same environment — **22 passed**, 3.06 s. `npm exec -- vitest run src/tests/unit/agent/supply-review.test.tsx src/tests/unit/agent/supply-message-results.test.ts src/tests/unit/agent/manual-inventory-import.test.tsx` — **26 passed**, 2.88 s. Existing deprecation warnings only. Scope includes extraction, quantities, approval/apply idempotency, pricing/count semantics, authorization, duplicate rows, worksheet/formula validation, locale presentation and saved receipts.

Live running staging-backed web acceptance is **not passing end to end**: XLSX selection is blocked by the shared composer before Prysm's submit-time conversion. Manual XLSX preview succeeds. A separate diagnostic using parser-produced text reaches the Agent, but loses required frame fields/source coordinates and creates two invalid proposals. Manual correction revalidation fails; actual-route isolated reproduction confirms missing JSON content type returns 422 while explicit JSON returns 200. See `docs/agents24-feedback.md` for exact owners and reproduction. No shared inventory apply, model/resource change, deployment or migration. Protected test files/screenshots/diagnostics: `/tmp/prysm-supply-verification/`.


## Excel supply repairs and full approval acceptance — 2026-11-03

Fixed host spreadsheet input-contract projection only when the actual runtime permits text files; converted output still goes through the original runtime/server contract. Added the real composer -> authenticated extraction -> text submission regression. Central agentJson marks string JSON bodies, preserving multipart boundaries. Added typed Tool source/value/row schemas, flat frame specifications, mandatory source evidence, missing-frame rejection and explicit model instructions. No inventory authorization or financial owner changed.

Commands: `APP_ENV=test DATABASE_URL=sqlite:///:memory: PYTHONPATH=backend backend/.venv/bin/python -m pytest backend/tests/agent/test_artifact_contract.py backend/tests/agent/test_supply_routes.py backend/tests/agent/test_supply_intake.py -q --tb=short` — **33 passed**, 3.92 s; `npm exec -- vitest run src/tests/unit/agent/composer-suggestions.test.tsx src/tests/unit/agent/client.test.ts src/tests/unit/agent/supply-review.test.tsx` — **25 passed**, 2.45 s. `npm run build:web` passed, 18.70 s, existing chunk warnings. Generated release-input check and diff whitespace check pass. The new composer test supplies jsdom's missing File.arrayBuffer with synthetic bytes; production code uses the browser API normally.

Official resource apply/publish refreshed the typed Artifact manifest and assistant instructions. Local DevDesk clinic stack reached readiness. Real original XLSX upload produced one valid receipt proposal (`5fd7e9a9-fb33-48c9-b6cb-8a4c661b7a96`), preserving Delivery rows 2/3, leading-zero barcodes, SKUs, colors, eye sizes and quantities 2/3. Editing retail 100 -> 101 disabled approval until server revalidation succeeded. Reload preserved the reviewed revision and value; no variants existed before approval. Explicit UI approval created only the two synthetic variants (958/959) in the verified staging clinic 65, with stock 2/3 and reviewed prices 101/150. Production inventory was untouched. Receipt/reload evidence is under `/tmp/prysm-supply-verification/`.

Migration note: No schema migration. Existing jobs, receipts and inventory remain intact; deploy the compatible consumer backend/Artifact contract and host UI together. No Prysm production application deployment or SDK publication was performed.

Final post-approval reload restored the committed “2 items applied” receipt; a second read-only staging audit confirmed exactly two variants and unchanged stock 2/3 (no replay). Screenshot: `/tmp/prysm-supply-verification/excel-approved-restored.jpg`.

## Named transcript output integration — 2026-11-05

Python `agents24[fastapi]==0.7.27` supplies the scoped output routes; no local proxy implementation is added. `node scripts/devdesk-check.mjs --fast --files backend/tests/agent/test_workflow_outputs.py --tests backend/tests/agent/test_workflow_outputs.py` — **5 passed**. Tests cover additive/idempotent graph configuration, preserved unrelated draft data/exports, conflicting or missing producers, both BFF result routes with server-owned principal/clinic scope despite hostile query parameters, and unauthenticated denial before result access. Existing request-authorization tests own the clinic/user isolation policy.

`backend/.venv/bin/python scripts/configure-agent-outputs.py --apply` applied the single programmatic transcript mapping to the configured hosted Agent and validation passed. It preserved pre-existing speech-model/canvas draft edits. No database schema changes, migration, historical backfill, application deployment or unrelated resource publication.
