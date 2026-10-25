# Agent consumer tests

Last Updated: 2026-10-22

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
