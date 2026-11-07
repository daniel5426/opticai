# Agent consumer tests

Last Updated: 2026-11-05

## Shared relay consumer regression — 2026-10-22

`npm exec -- vitest run src/tests/unit/agent` — **101 passed**, including existing Electron native transport, authenticated client, startup recovery, approval and thread/submission behavior. Web and isolated Electron builds passed with existing bundle/import warnings. Relay ownership/routing remains on the backend; no renderer-side organization key or socket was added. Live read-only synthetic BFF tools/history passed; this round did not click through a new Electron UI session.

Scope: exact saved proposal values; product receipt before platform resume; receipt-denial/rejection; order-independent tool-call linkage with multiple commits; missing pending link fails closed; resolved history has no false missing-link error; public metadata; sender/frame/origin/header controls; SDK-encoded approval/rejection IDs; traversal, double encoding, encoded separators/control bytes, malformed escapes and fragments.

Local configuration scope: both Electron and browser Vite proxies honor an inherited API URL, normalize a wildcard host to localhost and share the client's default origin.

Last command: `npm exec -- vitest run src/tests/unit/agent`.
Result: **27 passed**, 2026-10-18. `npm run build:web` passed with existing chunk/dynamic-import warnings. The Electron development build and live local startup completed successfully.

Current native verification: actual Electron tool-backed balance answer, history restoration after reload, approval saving exactly one synthetic task and rejection saving none passed with zero page errors. Evidence: `.agent-data/local-setup-ui.json`, screenshots `.agent-data/local-setup-*.png`. The setup tests also verified duplicate launch rejection, restart, and shutdown preserving the existing Agents24 API. Six focused configuration cases passed again after isolating build output and excluding non-app files from watching.

Electron live checks: approval saved one task; rejection saved none; restored resolved card shows proposal values without an error. Earlier locale smoke covered Hebrew RTL / English-French LTR. This change introduces no new strings or layout.

Gaps: production load/backpressure, every locale/action permutation and OS/network-kill recovery. These component tests mock transport; native Electron approval/rejection were checked separately against the actual local backend.

## HITL submission receipts — 2026-10-18

Scope: host approval prerequisite passed to shared submission ownership; denial stops platform resume, rejection grants no receipt, failed custom and generic approvals restore focus; generic question keyboard submission, draft restoration, checking/retry controls and he/en/fr status copy. Native transport boundary tests remain included.

Command: `npm exec -- vitest run src/tests/unit/agent` — **68 passed**; `npm run build:web` passed with existing chunk-size warnings. Added the testing library's DOM peer explicitly so the npm lockfile installs the test harness reproducibly.

Live synthetic client/BFF/Agents24 continuation passed: approved task saved once, rejected task saved zero times, duplicate decision/replay kept the same receipt. Evidence: `.agent-data/hitl-synthetic-verification.json`. Browser fixture feedback painted in 23.2 ms Hebrew RTL, 20.2 ms English keyboard, 16.3 ms French LTR; acceptance settled with stream held; failure restored the answer and text-input focus; lost acknowledgement recovered from authorized history without another send. Evidence: `.agent-data/hitl-browser-verification.json` and `.agent-data/hitl-browser-accepted.png`.

Remaining: actual-clinic authenticated Electron question and the 40% warm authorization improvement target await staff sign-in. Reduced-motion preference emulation and load/fault-soak testing were not run. No hosted staging/production changes or public publication.

## Normal startup — 2026-10-19

Scope: unified default API origin on 8000, bounded bootstrap retry, ready/unmount cleanup, manual retry and no automatic retries of definitive policy/authentication denials. Only bootstrap is repeated; chat submission is never repeated. Localized unavailable/retry presentation uses established primitives. `npm exec -- vitest run src/tests/unit/agent` — 101 passed; web build passed. The signed-in actual clinic restored history and answered through native Electron with the compiled agent origin on 8000. No hosted changes.

## Contextual composer and structured results — 2026-10-25

Full agent UI suite: **118 passed** across 12 files. New real-SDK cases cover exactly three localized clinic/patient suggestions, focused selected blanks, one-line default expansion, attachment preservation/submission, scope/new-chat reset, original prescription values/differences/source navigation in en/he/fr, snapshot pagination/download/save and explicit disabled document coverage. Browser inspection covers English/French LTR, Hebrew RTL/dark/narrow, report charts/table/export controls and a real synthetic screenshot search through the production composer/runtime. Workspace type-check retains unrelated existing errors; changed agent files have none. Permanent retrieval and complete Electron UI qualification remain gated as documented in the backend test state.

## Live suggestion click and stale SDK cache — 2026-10-25

Reproduced a no-op suggestion click in the ordinary Electron window: its versioned optimized SDK URL served the old `AgentChatComposer` without `ref`/`useImperativeHandle`, while the installed same-version package already contained the handle. Separate Vite cache directories for Electron and browser, and explicitly prebundle the public Chat React UI/runtime entries. After the development app refresh, the ordinary renderer serves the public handle from its new cache URL. The user filled the selected blank and submitted a report request; verification did not submit that request or interrupt it. Added StrictMode prefill and shared-cache isolation regression coverage. Focused checks: 13 passed. No migration or persisted/public API changes.

## Sidebar suggestion placement — 2026-10-25

Compact sidebar suggestions render before the composer in DOM/keyboard order, with the composer anchored at the panel bottom. Suggestion rows can scroll in short panels. Main-page placement stays below the composer. Existing real-SDK composer tests: **6 passed**, including selected blanks, attachments, StrictMode and scope reset. Browser geometry verified suggestions above the composer and composer bottom equal to panel bottom at 380px width in Hebrew RTL/dark and English/French LTR. No strings, persisted data or public contracts changed.

## Response reports and generated visual blocks — 2026-10-25

**127 agent UI tests passed**. Named legacy/native report receipts deduplicate at the end of their own assistant response. Download cards use two equal-width columns and contain only the name and download control; no floating composer activity rail. Declarative stat cards, bar/line/area/pie/donut charts use snapshot data and shared palette, with an accessible data table and explicit invalid-distribution state. Alternate exports/save remain in report details. Browser inspection covers narrow Hebrew RTL/dark and English/French LTR; no horizontal page overflow. Report definitions accept optional presentation without converting older saved definitions or snapshots. After owner authorization, backend migrations 0045/0046 were applied on staging and the ordinary local API/Artifact/workers and clinic agent draft were refreshed. Health/schema/relay/Toolset checks passed; production remains unchanged.

## Shared connection lifecycle adoption — 2026-11-02

Four focused integration suites: **15 passed** (`prysm-ui-final.log`). Availability/navigation uses shared connection lifecycle and stays mounted through transient trouble; denial/expiry retain explicit behavior. Removed obsolete host-owned startup retry code/tests. Active locale supplies Accept-Language, and optional preview negotiation is enabled after repeated platform paired measurements; client-focused rerun **1 passed**. Agent instructions use admitted server facts and no report polling. GPT-6 Luna, authored limits, approvals and original worker fixes remain unchanged. The earlier accidental broad Vitest invocation exposed unrelated preexisting failures; these are not counted as a passing full application suite. No production resource publication.


## Published SDK and live recovery — 2026-11-03

Main checkout uses public client 0.2.22, React 0.2.27 and Chat React 0.5.41. Command: `npm exec -- vitest run src/tests/unit/agent/availability.test.tsx src/tests/unit/agent/client.test.ts src/tests/unit/agent/global-panel.test.tsx src/tests/unit/agent/page-context.test.tsx src/tests/unit/agent/submission.test.tsx` — **18 passed**, five suites, 3.14 s. `npm run build:web` passed (9.05 s; existing bundle warnings). Generated public release-input provenance check and diff whitespace check passed. Unrelated dirty main edits remain preserved.

Real Hebrew browser chat used trusted date/timezone, restored the same conversation after reload during a report run, and rendered the final zero-row report and named download once. Export verified as a valid 5,634-byte XLSX. Screenshot: protected `prysm-report-reload-verified.jpg` in the integration delivery evidence directory. Callback delivery audited server-side once; earlier model/tool results were not resubmitted by the browser. Fresh native Electron, all locale permutations, fresh ingestion and sustained hosted load are not claimed by this acceptance.


## Supply inventory acceptance — 2026-11-03

Commands: `APP_ENV=test DATABASE_URL=sqlite:///:memory: PYTHONPATH=backend backend/.venv/bin/python -m pytest backend/tests/agent/test_supply_intake.py backend/tests/agent/test_supply_routes.py -q --tb=short` — **22 passed**, 3.24 s; separate inventory collection `backend/tests/test_inventory_file_import.py backend/tests/test_inventory_v1.py` with the same environment — **22 passed**, 3.06 s. `npm exec -- vitest run src/tests/unit/agent/supply-review.test.tsx src/tests/unit/agent/supply-message-results.test.ts src/tests/unit/agent/manual-inventory-import.test.tsx` — **26 passed**, 2.88 s. Existing deprecation warnings only. Scope includes extraction, quantities, approval/apply idempotency, pricing/count semantics, authorization, duplicate rows, worksheet/formula validation, locale presentation and saved receipts.

Live running staging-backed web acceptance is **not passing end to end**: XLSX selection is blocked by the shared composer before Prysm's submit-time conversion. Manual XLSX preview succeeds. A separate diagnostic using parser-produced text reaches the Agent, but loses required frame fields/source coordinates and creates two invalid proposals. Manual correction revalidation fails; actual-route isolated reproduction confirms missing JSON content type returns 422 while explicit JSON returns 200. See `docs/agents24-feedback.md` for exact owners and reproduction. No shared inventory apply, model/resource change, deployment or migration. Protected test files/screenshots/diagnostics: `/tmp/prysm-supply-verification/`.


## Excel supply repairs and full approval acceptance — 2026-11-03

Fixed host spreadsheet input-contract projection only when the actual runtime permits text files; converted output still goes through the original runtime/server contract. Added the real composer -> authenticated extraction -> text submission regression. Central agentJson marks string JSON bodies, preserving multipart boundaries. Added typed Tool source/value/row schemas, flat frame specifications, mandatory source evidence, missing-frame rejection and explicit model instructions. No inventory authorization or financial owner changed.

Commands: `APP_ENV=test DATABASE_URL=sqlite:///:memory: PYTHONPATH=backend backend/.venv/bin/python -m pytest backend/tests/agent/test_artifact_contract.py backend/tests/agent/test_supply_routes.py backend/tests/agent/test_supply_intake.py -q --tb=short` — **33 passed**, 3.92 s; `npm exec -- vitest run src/tests/unit/agent/composer-suggestions.test.tsx src/tests/unit/agent/client.test.ts src/tests/unit/agent/supply-review.test.tsx` — **25 passed**, 2.45 s. `npm run build:web` passed, 18.70 s, existing chunk warnings. Generated release-input check and diff whitespace check pass. The new composer test supplies jsdom's missing File.arrayBuffer with synthetic bytes; production code uses the browser API normally.

Official resource apply/publish refreshed the typed Artifact manifest and assistant instructions. Local DevDesk clinic stack reached readiness. Real original XLSX upload produced one valid receipt proposal (`5fd7e9a9-fb33-48c9-b6cb-8a4c661b7a96`), preserving Delivery rows 2/3, leading-zero barcodes, SKUs, colors, eye sizes and quantities 2/3. Editing retail 100 -> 101 disabled approval until server revalidation succeeded. Reload preserved the reviewed revision and value; no variants existed before approval. Explicit UI approval created only the two synthetic variants (958/959) in the verified staging clinic 65, with stock 2/3 and reviewed prices 101/150. Production inventory was untouched. Receipt/reload evidence is under `/tmp/prysm-supply-verification/`.

Migration note: No schema migration. Existing jobs, receipts and inventory remain intact; deploy the compatible consumer backend/Artifact contract and host UI together. No Prysm production application deployment or SDK publication was performed.

Final post-approval reload restored the committed “2 items applied” receipt; a second read-only staging audit confirmed exactly two variants and unchanged stock 2/3 (no replay). Screenshot: `/tmp/prysm-supply-verification/excel-approved-restored.jpg`.


## Continuous localized activity — 2026-11-03

Initial thinking and provider/external waiting render in the assistant timeline, not above the composer. The last Tool group displays its trailing model-planning phase while preserving disclosure state; earlier chunks do not retain the current activity. Hidden node/Tool notes do not suppress fallback. Pending approvals remain inline and do not receive a generic waiting label. Command against the canonical packed development train in the isolated consumer: `npm exec -- vitest run src/tests/unit/agent/tool-activity.test.tsx src/tests/unit/agent/submission.test.tsx` — **49 passed**, including he/en/fr initial/planning activity, capacity wait, terminal clearing and external-work versus approval behavior. No provider limits, historical holds, backend calls or prompts changed.

Public-package acceptance: installed `@agents24/react@0.2.28` and `@agents24/chat-react@0.5.42`; the same focused command passed **49 tests** (1.58 s). `npm run build:web` passed (9.61 s; existing chunk warnings); generated public release inputs were prepared and checked successfully. Local DevDesk clinic stack reached readiness after restart. Browser acceptance is blocked before chat by the initial navigation `Maximum update depth exceeded` loop; this repair does not alter authentication/routing. Production Agents24 playground smoke passed. No database migration.

## Selective voice transcript display — 2026-11-05

Public SDKs: client 0.2.24, React 0.2.30, chat-react 0.5.46; release provenance regenerated. Canonical scoped `node scripts/devdesk-check.mjs --fast --files src/services/agent-outputs.ts,src/services/use-agent-transcript.ts,src/components/agent/TranscriptMessage.tsx,src/components/agent/AgentChatPanel.tsx,src/services/agent-client.ts,src/contexts/PrysmAgentContext.tsx,src/tests/unit/agent/transcript.test.tsx` — **239 passed** across 25 related test files. Web build passed with existing chunk-size warnings. Focused TypeScript validation for the output adapter and hook passes.

New coverage: initial/queued selection, default-off text, immediate lazy retrieval before stream completion, he/en/fr real SDK message rendering, duplicate replay, pagination/history, attach snapshots, unrelated runs, capture failure/expiry, attachment/text preservation and no reads for non-audio messages. Real running web fixtures on port 5126 verify filename replacement while the Agent remains running, without page errors, in Hebrew RTL and English/French LTR. Screenshots and fixture scripts are protected under `.agent-data/transcript-*`.

The hosted Agent draft export is applied and validates. A synthetic hosted draft audio stream emitted `workflow.output.available` before terminal completion, and its processed-text result remained retrievable afterward. Published-Agent acceptance is pending the existing draft publication decision; this does not claim an OpticAI application deployment.
