# OpticAI CI and delivery

Last Updated: 2026-11-05

The current release contract is staging verification -> production promotion -> desktop publication. Preserve it. Owner `daniel5426` may use the existing direct-main workflow; contributors follow AGENTS.md.

`Backend CI` and `Web CI` own normal validation. `Verify Staging` (`staging-electron.yml`) must succeed for the exact release SHA before `production-promotion.yml`. Production promotion does not require a database backup confirmation. Run the retained workflow with its SHA/ref aligned. Desktop `release.yml` requires a `v<version>` tag matching both package files and successful promotion of that same SHA. Version/tag are explicit review inputs. Do not move an existing release tag.

Railway project: `fb97ce50-fb72-4612-bfd1-c6d8a7bed9cb`. Production promotion owns API `opticai`, migration worker `softoptic-migration-worker-Z2hA`, and web `prysm-web`; use the workflow's exact environment/target contract rather than local CLI linkage. Verify API `/health` and `/health/database` on `https://api.prysm.co.il`, web health and recent worker logs. Preserve workflow-managed database migration ordering. The production migration worker’s automatic GitHub deploy trigger is disabled; keep it disabled so only verified promotion deploys that worker after API migrations. Its GitHub source remains linked for build configuration. Staging retains automatic deployment. Staging verifies the exact main auto-deployments. Its bounded fifteen-minute deployment wait includes cold dependency installation and image export, and still rejects terminal failures or a different SHA. Unchanged-file skips require a successful deployed revision with identical watched files; a skipped repair commit cannot hide an older pending application build. Production uploads its exact-SHA checkout after applying the verified public dependency inputs. Do not upload the user's uncommitted directory.

Select only the affected, requested web/backend/desktop targets. A web/backend release does not automatically request desktop packaging or publication. Desktop changes require the packaged macOS/Windows and updater checks in [release checklist](docs/references/release_checklist.md). Do not infer desktop publication from web health. Generated desktop env files must remain server-secret-free.

For rollback, identify the last verified compatible revision and exact service deployment or prior desktop release; preserve database compatibility. Do not destructively reverse migrations or overwrite release tags. Stop and report when the required rollback target is unavailable.

## Verification and improvement

Desktop candidate dependency installs use `npm ci --no-audit --no-fund` to avoid
non-gating registry audit traffic during packaging. Lock integrity and packaged
runtime/updater checks remain required.

Release v1.0.101 publishes the previously promoted application changes for Windows
x64 and macOS Apple Silicon. Migration note: No new migration; production already
has required revisions 0056 and 0057. Uncommitted campaign/messaging work is excluded.

Backend CI pins Ubuntu 24.04 to keep the Python 3.12.8 runtime available after the
`ubuntu-latest` transition to Ubuntu 26.04. This avoids setup failures and release retries.

Exam workspace saving requires additive Alembic `0057_exam_workspace_save` after
0056 and before the updated API. It adds nullable creation idempotency fields and
a company-scoped unique index; existing exams remain unchanged.
Migration note: Apply 0056 and 0057 through the API release migration gate before
the frontend. No historical record rewrite is required.

Google OAuth release configuration and callback requirements are in
[Google OAuth configuration](docs/references/google-oauth.md). The API needs
the web ID/secret and desktop ID before the repaired web/desktop clients roll
out. The web secret stays on the API; never add it to renderer build inputs.

Canonical commands: `node scripts/devdesk-check.mjs --fast` for local feedback; `--full` for explicitly requested broad verification; `--fast --files <reviewed-paths> --tests <focused-test-paths>` scopes local feedback; `--release --lock-only` always checks release dependency provenance before dependency installation, including public-only locks, so application-version edits cannot bypass stale-input detection. The installed tracked pre-push hook runs fast checks and release provenance validation. Install the tracked hook with `python3 ~/.codex/skills/ship-and-watch-production/scripts/install-hooks.py "$PWD"`; it chains existing hooks. DevDesk does not own hook setup. No formatting rewrite is automatic.

## Speed-first shipping loop

Delivery speed is the optimization target. Use the pre-push hook as the preflight rather than running it twice. If the same candidate inputs were already checked, `CI_PREFLIGHT_DONE=1 git push ...` skips only this tracked hook; other chained hooks still run. The coding agent must select the minimum useful checks for the actual diff, run independent checks/monitoring in parallel within local resources, and reuse successful checks while their inputs/dependencies are unchanged. Normal checks run in this checkout. Avoid repeating a full local suite in the hook, GitHub and each promotion step. Full suites/browser matrices/container qualification belong to affected high-impact changes or scheduled/manual coverage. Narrow or remove low-value/duplicate checks when justified; existing gates are open to improvement. Keep the checks that directly protect this change's important behavior and real artifact.

Every ship, including a successful one: inspect recent timings; identify the slowest avoidable step; implement a proportionate speed improvement in the owning script/workflow; verify its behavior and measure the result when practical. Focused workflow/test-selection/cache/parallelization improvements are part of shipping authority. If no worthwhile change exists, state the concrete reason. Do not replay historical qualification checklists or perform a 150-run audit on every ship. Report total elapsed time, the bottleneck and improvement alongside the production result. Detailed timing evidence belongs in Git metadata (`ci-timings.jsonl`) or provider artifacts, not DevDesk. The tracked hook automatically records its duration in Git metadata when the shared skill is installed. Its `scripts/timing.py` also records separately timed build/delivery commands, with bounded history and no command arguments, environment or output.

If a repair changes only one component, rerun only invalidated checks and reuse unaffected delivery evidence. Unknown/shared changes get the broader relevant selection; a small leaf change gets focused tests. Keep component selection tested. Do not report invented coverage or speedup figures. Preserve authentication, data isolation, migration correctness and current hosting spend.

Development may use the local Agents24 train. CI/container builds use the explicitly reviewed public package manifest and lock in `config/devdesk-release/`, generated by `node scripts/devdesk-release-inputs.mjs prepare`. Git attributes keep receipt-hashed JSON inputs at LF on every build platform. The receipt pins source hashes and public artifact integrity; these are distinct public artifacts, not rewritten development tarball URLs. `check` rejects stale inputs. `apply` is restricted to an explicitly requested temporary release worktree or CI/container build (`CI_RELEASE_BUILD=1`). It leaves the original development package files and installed modules intact. Include every changed release input in the reviewed scope. Railpack applies the same verified public inputs before installing dependencies for automatic web deployments. Regenerate after dependency or application-version edits and verify the resulting public inputs when dependency or version changes require it. The public release pins `@agents24/chat-react` 0.5.46 for the supported composer ref/text API. Local pre-push runs related frontend tests and changed Python compilation/focused changed tests in parallel. Web builds run once in the delivery path; a separate local build is optional when it gives useful earlier feedback. The legacy root TypeScript configuration has no passing baseline; adopting a full-project type gate is separate work, not a prerequisite invented by DevDesk.

## Agent-owned shipping

Ask the coding agent to ship the intended changes; it reads this file and uses this repository's release scripts/providers directly. DevDesk owns local apps and processes only. No DevDesk prepare/run/validate step, release-copy service or dashboard approval is involved. Inspect the diff and stage only authorized files. CI verifies the committed revision. A temporary Git worktree sharing history is justified only when unrelated dirty changes prevent reliable verification of the selected scope or concurrent work requires it; preserve unique repairs, then remove regenerable temporary environments. Do not clone full history per attempt.

Use `$ship-and-watch-production`. Resolve the exact affected targets, perform relevant preflight once, commit/push the intended revision and monitor its actual deployments/health. Reuse existing matching-SHA runs instead of redeploying. Missing credentials, destructive changes and unrelated scope expansion require attention. Completion includes the revision, relevant health/deployment evidence, elapsed time, slowest step and the speed improvement made (or a concrete reason none was warranted).

Startup lifecycle ownership follows `Start.md` and `devdesk.json`: app-owned workers/services are automatic; Agents24 and hosted/shared clinic databases remain external. Local lifecycle automation never grants production migration, provisioning or publication authority.

## Existing desktop compatibility

Hosted clinic agents use an environment-specific private relay plus API-owned
requested/summary workers sharing the API's durable agent directory. Configure
and verify the exact published relay before enabling the API. See
[hosted agent operations](deploy/agents/README.md). No new schema migration is
required; preserve the environment's existing migration ordering.

Relay readiness must include a database connection from the running relay and
an actual read-only clinic tool invocation. A connected Artifact contract and a
plain-text agent reply do not verify database access. Direct Supabase hosts need
IPv6 egress. After changing network settings, upload a fresh deployment and
inspect its effective manifest: redeploying an old build can retain its old
network configuration. Preserve the relay identity during this rollout.

The production web server proxies `/api/agents24` and `/api/v1/agent` to
`AGENTS24_API_ORIGIN` (or the origin of `VITE_API_URL`) before locale routing.
Keep the proxy streaming for chat events and uploads. Verify with
`node --test scripts/agent-web-proxy.test.mjs`; unauthenticated bootstrap must
reach the API and return 401 rather than a locale redirect. No schema migration.

Backend release gates include shared-order and legacy desktop HTTP regressions. Inventory barcode lookup and prescription-kind search regressions run in both the canonical full checks and backend/promotion CI gates. The migration worker checks for newer queue tables once at startup and skips unavailable queues until it is restarted after Alembic completes; it never creates schema. Keep the new app on its group workspace; existing desktop routes translate individual-order writes into locked group transactions. Billing responses carry an additive signed `compatibility_token` that v1.0.79's editor retains through its existing spread/save behavior. Full shared-invoice saves require that receipt and the current group revision; stale saves must reload rather than overwrite newer entries or payments. Delta payments lock the shared balance before updating it. Raw ORM writes, invoice reassignment, and whole-invoice deletion remain protected.

For full legacy saves, the billing receipt is authoritative for the group revision. v1.0.79's regular-order form retains its previous order receipt while accepting the refreshed billing receipt after its own save. Keep repeated saves working without accepting a stale billing receipt; order-only writes continue checking the order receipt. Migration note: Not needed; this corrects validation of the existing additive receipts.

Group billing saves retain stored line totals whenever price, quantity, and discount are unchanged, including negative legacy discount lines. Metadata-only saves must not reprice imported invoices; changed financial inputs still use validated server calculations. Migration note: Not needed; existing amounts are preserved in place.

Legacy recent-client visits without a clinic parameter retain the client registration-clinic fallback for company admins who have no assigned clinic. Explicit and assigned clinic context still takes precedence and remains company-scoped. The company-client HTTP suite is part of the backend release gates. No schema migration is required for this fallback.

Legacy patient-file uploads use the same registration-clinic fallback when neither the request nor the user supplies a clinic. The file HTTP suite verifies ownership, download access, context precedence, and cross-company rejection. Migration note: Not needed; existing file metadata and storage keys remain valid.

Legacy exam saves preserve component data and layout cards that v1.0.79 cannot represent. Current clients mark deliberate replacement/clear requests with `X-Prysm-Exam-Write: replace-v1` and enumerate their supported types in `X-Prysm-Exam-Components`. Omitted components outside that list are retained, including cards introduced by a future app version. Deploy the backend before the current frontend/desktop so preservation is active throughout mixed-version use. This compatibility layer adds no schema migration; the release's existing Alembic migrations remain mandatory. Retirement of the unused legacy AI routes is intentional and is not a compatibility blocker.

For release v1.0.97, the repository owner explicitly waived the pre-production published-desktop round-trip evidence prerequisite on 2026-11-03. Continue staging verification and production promotion without requiring that evidence bundle. Future compatibility testing remains governed by the release checklist. Keep real clinic data and logs outside Git, use test credentials, and block provider writes and background jobs. Local PostgreSQL concurrency cases use an explicitly disposable `TEST_ORDER_GROUP_DATABASE_URL`; never point it at a clinic database. Passing unit tests alone does not replace exact-SHA staging, migration ordering, or packaged-desktop gates.

## Company-client ownership rollout

The company-client upgrade requires `0049_company_client_records` before the new API/workers select ownership columns. Run its read-only preflight against the established target and resolve reported IDs before release. The preflight accepts absent order-group/follow-up tables only when Alembic confirms their creating migrations are still pending; it does not accept missing existing tables or an unknown Alembic baseline as proof that a table is pending. The migration repeats ownership validation after earlier migrations create those tables. Preserve the existing staging and promotion gates. Once cross-clinic activity exists, use a compatible forward repair rather than clinic-only application rollback or schema downgrade. See [company-client rollout](docs/references/company-client-records.md).

## Manual table exports

Manual exports add authenticated `/api/v1/table-exports` endpoints and an API-owned `table_exports` consumer. Deploy the API before enabling the corresponding frontend buttons. Existing job storage is reused; no new schema migration is required beyond the application's existing job-table migrations. Keep `PRYSM_AGENT_DATA_DIR` durable and shared across API replicas so protected downloads and seven-day cleanup see the same files. The consumer requires ordinary workspace read access, independent of AI entitlement or Agents24 availability.

Focused verification: `DATABASE_URL=sqlite:///:memory: SECRET_KEY=isolated-check-only PYTHONPATH=backend backend/.venv/bin/python -m pytest backend/tests/test_table_exports.py backend/tests/test_table_search.py` and `npm test -- --run src/tests/unit/table-exports.test.tsx src/tests/unit/table-list-layout.test.tsx src/tests/unit/server-filtered-tables.test.tsx`, followed by the canonical fast checks. The tests use isolated data and never mutate the configured clinic database.

Migration note: Not needed; manual exports reuse existing job storage with an additive job kind and leave saved report definitions and clinical data unchanged.

## Release v1.0.98

Payments may be recorded or removed while editing an existing order group. Immediate payment deltas preserve unsaved order and billing fields and update the group revision used by the next save. Zero-price discount lines reduce the invoice, with the invoice total clamped at zero. Backend rollout precedes frontend/desktop publication. The owner’s instruction to proceed without a published-desktop round-trip evidence bundle also applies to this requested release; retained shared-order and legacy HTTP checks, exact-SHA staging, and packaged release checks remain required.

Migration note: Not needed; this release uses existing billing fields and payment endpoints without a schema or public contract change. Existing stored line amounts remain preserved when financial inputs are unchanged.

## Faster release candidates

Desktop candidates (`desktop-candidate.yml`) build Windows x64 and macOS Apple Silicon concurrently on each main push, using reviewed public inputs. Intel Mac output is retired; previously published Intel downloads remain available. Desktop builds use `release/desktop-app` with a separate, integrity-pinned runtime dependency lock under `config/desktop-runtime`; renderer dependencies already compiled into `dist` are not copied again. Regenerate both public and runtime inputs with the existing `prepare` command after dependency/version changes. Preserve native modules and external main-process dependencies.

Web/API promotion requires exact-SHA staging health plus successful Backend CI and Web CI, reusing those results instead of rerunning their tests/build. It does not wait for installer packaging. `staging-desktop.yml` is a manual optional staging-installer workflow; use it when a staging desktop installer is needed. It retains its distinct profile/API and native-reader checks. A staging installer is never promoted into a production installer.

The release tag workflow still requires successful production promotion and matching package versions. Each selected platform independently waits for its successful build job and unexpired artifact from an identical-SHA `desktop-candidate.yml` run, checks its package/update artifacts, and publishes them without rebuilding. Windows and macOS publication run in parallel with fail-fast disabled; neither waits for the other platform or the overall candidate run to succeed. A shared draft release is prepared after production promotion; the first verified platform publishes it, and the other adds its assets when ready. A failed platform can be retried without blocking or removing the successful platform’s downloads. For branches not built automatically, dispatch the candidate workflow on the matching SHA/ref before tagging. Failed, missing or expired artifacts block only their platform’s publication. Early build success never grants publication authority.

Focused workflow checks: `python3 -m unittest scripts/test_release_pipeline.py` and `node --test scripts/desktop-release.test.mjs`. Migration note: Not needed; only CI orchestration changes, with existing installer/updater formats preserved.

Windows candidates and optional staging builds reuse the complete native reader output (including DLLs and licenses) only under an exact cache key containing source, build script, toolchain-action content, OS and runner architecture. Both cold builds and cache hits run capability/resource checks; final packages run the existing native-reader checks again. No broad fallback cache keys are used. Compressed installer/ZIP artifact uploads disable redundant GitHub compression.

Migration note: No database migration. Future Mac releases support Apple Silicon only; Intel users retain their last compatible published release. Runtime dependency reduction must pass packaged launch and module/resource checks before publication. Existing user profiles, clinical data and updater repository are unchanged.

## SoftOptic client import compatibility

New SoftOptic imports allocate client IDs from the database sequence, skipping IDs occupied by historical imports. Existing IDs stay intact; resumed jobs recover account mappings through their job-scoped source links, with a clinic/company-checked fallback for older composite IDs. Worker progress/failure reports use a separate transaction; client batches heartbeat without committing partial data.

Single-client test imports bind `options.client_account_code` to the pruned bundle manifest, reject mismatches before cleanup, and preserve other imports. An account already imported by another job must use that job rather than duplicate the client. Deploy the compatible API and worker before publishing the desktop with this option; older desktops remain supported. Resume the affected failed import only after the worker repair is deployed. No shared database changes are part of local qualification.

Migration note: No Alembic migration is needed. The selection is an additive field in existing job metadata and bundle manifests; existing client IDs, source links, and completed imports remain compatible.

## Windows-only release selection

Set the current package version, then run `node scripts/release-targets.mjs --windows-only` to exclude macOS for that version in `config/release-targets.json`. Both candidate build and publication read this exact-SHA policy. Future versions include Apple Silicon by default; skipping Mac is never inferred from a missing artifact. Windows receipts, native-reader resources, updater integrity, CI and promotion remain required. v1.0.99 was initially Windows-only. The owner explicitly requested its Apple Silicon follow-up on 2026-11-05. Use `release-macos.yml` with `tag=v1.0.99`: it checks out the immutable tag, reuses its successful production promotion, builds and launches the package, and adds only the Mac ZIP/updater files without replacing any existing assets. This explicit manual request overrides the tagged Windows-only selection; never move the tag or rebuild Windows for the follow-up. The workflow caches the reviewed npm dependencies. Set `verify_existing=true` to download and launch the published Mac binary, recheck updater hashes and tag provenance, and finish release verification without rebuilding or overwriting assets. Record the tag SHA explicitly in the receipt process; GitHub reserves its default `GITHUB_SHA` environment variable for the workflow ref. Migration note: Not needed; the follow-up ships the already-promoted application source and adds no data/API changes.

## PR 72 combined rollout

Deploy Alembic 0051 client indexes, 0052_order_group_date_index and 0053 client notification preference before the new API/worker. Existing client IDs and clinical components remain compatible. Legacy keratometer saves invalidate stale paired diopters only when their millimeter value changes; unchanged imported unit pairs retain their original readings. Exact national-ID matching and export column filters are additive API inputs; older callers and queued export jobs retain defaults. Import mapping improvements affect subsequent imports; running backfills or reimporting existing clinics is a separate operation.

Migration note: Three additive Alembic revisions are required. No destructive backfill or reimport is performed during this release.

## Independent billing updates

Deploy the API's additive `PATCH /api/v1/order-groups/{id}/billing` before the frontend that uses it. Billing field saves send only changed header fields; item lists are sent only when items change. Responses omit clinical entries and unchanged line items. Group revision locking, scoped write permissions, payment adjustment history and legacy invoice calculations remain in force. Local caches are marked stale without waiting for unrelated patient queries.

Migration note: No new database migration for this endpoint; it uses existing billing columns. Retain the release's other required migrations and compatibility checks.

## Reusable order discounts

Apply additive Alembic `0054_reusable_discounts` before deploying the API, then publish the frontend. It creates clinic-scoped fixed-amount definitions and adds nullable invoice context offsets. Offsets are captured only on an intentional financial edit; existing invoice totals, imported item deductions, payments and known OpticPlus header discrepancies are preserved. No backfill, clinic remigration or shared-database mutation is part of local qualification. Existing clients retain the same billing line contract.

Settings → Discounts saves independently. Applying a definition copies its description, currency and amount into an ordinary zero-price discount line; later definition edits/deletion never alter saved orders. Only matching invoice currencies are offered. Current print/PDF views include labeled discount lines; existing DOCX billing placeholders and table-export balances use the same saved totals.

Focused coverage: `backend/tests/test_reusable_discounts.py`, `backend/tests/test_order_groups.py`, `src/tests/unit/reusable-discounts.test.tsx`, and the existing compact billing, summary, payment and print suites, through the canonical scoped fast check. Browser verification uses the running web frontend with an isolated disposable database, covering Hebrew RTL and English/French LTR.

Migration note: Alembic 0054 is required before the new API. No historical invoice rewrite or automatic application to a shared database.

## Production web domain

`https://app.prysm.co.il` routes to Railway's production `prysm-web` service; `https://prysm.co.il` remains the Vercel landing page. Vercel manages the DNS zone. Preserve the `app` CNAME and `_railway-verify.app` TXT records using the values returned by Railway, which owns the app's HTTPS certificate. The API's `BACKEND_CORS_ORIGINS` must include `https://app.prysm.co.il` while retaining existing origins. Keep `SITE_URL` on the landing site for its signup, verification, password-reset and billing routes.

Verify `/health` on the app and API, the app login page, and an API CORS preflight from the app origin after configuration changes. Migration note: Not needed; this adds a hostname and allowed origin without changing persisted data or API contracts.

## Website signup verification

The landing/account website lives in the adjacent `prysm-web` repository and is deployed on Vercel; Railway's `prysm-web` service is the clinic application. Deploy additive Alembic `0055_email_verification_codes` before the API, then the updated landing website. Keep production API `SITE_URL=https://prysm.co.il` and configure its own `RESEND_API_KEY` / verified `EMAIL_FROM`; Vercel newsletter credentials do not configure Railway signup email. The landing code pins production API requests to `https://api.prysm.co.il` and rejects preview-to-production routing. Correct the old Vercel production `PRYSM_API_URL` variable during the requested release. Existing staging signup sessions must be restarted on production; do not copy them automatically.

Focused verification and compatibility details: [signup email verification](docs/references/signup-email-verification.md). Migration note: Alembic 0055 adds a default-zero attempt counter and preserves existing verification links. Local development here applied it only to disposable test databases; shared-environment migration and mail delivery remain release work.

## Native voice messages

Publish `agents24/workflows/main.yaml` with its optional audio input and native Speech to Text node before releasing the frontend that submits recorded or attached audio through the chat SDK. Voice transcription runs inside the same agent run and does not create an ingestion job or index the recording in a Knowledge Store. The header microphone starts recording on click after bootstrap/history restoration; the floating ElevenLabs waveform shares that microphone stream and places Send on the physical left and Cancel on the physical right, with no separate stop control. Its circular up-arrow Send control and plain Enter open the chat and submit the audio; composition confirmation and Shift+Enter do not send. The existing keyboard shortcut retains hold/release behavior.

Keep legacy transcription endpoints and speech-ingestion resources available for older clients and existing jobs. They are no longer used by current chat audio submissions. Verify a real audio-only chat turn and restored history against the configured Agents24 organization, plus the focused voice/audio-submission tests through the canonical scoped fast check.

Migration note: No database migration. Publish the additive agent workflow before the frontend; text, document, screenshot and legacy transcription contracts remain compatible.

## Voice transcript outputs

Use public client 0.2.24, React 0.2.30, chat-react 0.5.46 and Python `agents24[fastapi]==0.7.27` together. After any resource-package apply, configure the main Agent's named `transcript` export with `backend/.venv/bin/python scripts/configure-agent-outputs.py --apply`; the current Workflow YAML compiler does not preserve programmatic exports. The mapping in `config/agents24-outputs.json` reads Speech to Text `references` as `processed_text`. Validate before publication. `--apply --publish` publishes the entire existing Agent draft, so review any pre-existing draft changes first. Publish the export and deploy the updated BFF before releasing the frontend that requests it. No platform package publication is performed here.

Attachment submissions request `transcript`; text-only submissions select nothing. Mounted audio-message rows fetch the named value on availability while the Agent continues, replacing only the matching audio filename. Other files and typed text remain visible. History reload and reconnect use scoped result listing/retrieval. Capture failures, missing results and expiry preserve the attachment and show a localized unavailable status. Transcript values stay in component memory and clear on expiry/unmount; no localStorage transcript cache or separate transcription job is added. Old recordings without captured results remain readable as attachments.

Migration note: No application database migration or historical transcript backfill. Publish the additive Agent export and deploy the compatible BFF before the frontend. Existing conversations and recordings remain intact.

## Agent conversation entry

Normal entry to the main agent page starts a new conversation. Expanding a visible sidebar deliberately preserves its conversation and draft. Recorded audio reuses a currently visible agent conversation; with both agent surfaces closed, Send selects a new SDK conversation before submitting. Startup no longer automatically restores the last device-saved thread; existing conversations remain available through history.

Migration note: Not needed; existing server conversations and local storage are preserved. This changes frontend selection defaults without a schema or API change.

## Release v1.0.100

Order creation can start empty or import only the latest order/exam prescription. Imported item sections use the order sheet layout, and prescription source hints are localized. Both Windows x64 and Mac Apple Silicon build concurrently and publish independently; tag as soon as exact-SHA promotion succeeds instead of waiting for both installers. Candidate jobs cache the reviewed npm dependency inputs, and Mac candidates pass the previously verified packaged launch/native SQLite check before upload.

Migration note: Not needed; these UI changes use existing order, exam and import contracts and introduce no persisted shape or API changes.


## Google AI data-isolation gates

Backend CI and the canonical full selection include Google-marker admission, signed
Artifact privacy and event transport tests alongside the legacy direct-OpenAI suite.
The async boundary tests require `pytest-asyncio==1.4.0` as a CI test dependency.
Focused local checks use `backend/tests/agent/test_google_ai_isolation.py` and
`backend/tests/agent/test_artifact_contract.py`; no live clinic database or model call
is needed. Provider tiers, dashboard controls, production deployment and Google's email
submission are separate evidence requirements in [Google verification](docs/ai/google-verification.md).

Migration note: No schema migration. Restart API/workers for the boundary changes;
browser model overrides are rejected with 422. Publish the reviewed speech-model
requirement and deploy the adjacent public website separately.


## Order pricing and spectacle lenses

Apply additive Alembic `0056_order_pricing_lenses` before the updated API. It widens the catalog category constraint and adds nullable per-item `discount_percent`; historical catalog records and invoice amounts are preserved. Frame-card prices edit the linked group billing line, including manual price overrides. Catalog spectacle lenses use `lens_right` / `lens_left` allocations and the existing reservation, supplier-order and delivery lifecycle. Supply intake and spreadsheet rows accept `spectacle_lens`, `coating` and `diameter`.

Percentage discounts retain the rate and calculate the fixed deduction on the API. Editing the fixed deduction or total switches that line back to fixed mode. Older-client financial saves switch echoed or omitted percentage metadata to fixed mode; metadata-only saves retain it. Deploy the API before the frontend. The published AI tool contract remains unchanged; this change extends catalog forms, file intake and the application API.

Focused checks cover order pricing UI in Hebrew, English and French, group totals, old-client billing, inventory allocation/delivery and supply intake. Browser verification uses the running web app for Hebrew and synthetic component previews for English/French while web locale routing remains Hebrew-only.

Migration note: `0056_order_pricing_lenses` is required. Applied to the allowlisted staging database during development; production migration remains part of the release contract. No historical invoice rewrite or catalog backfill.

## Campaign messaging

Alembic `0058_campaign_messaging` adds durable campaigns and a separate micro-ILS
prepaid ledger. It preserves legacy campaigns/executions and marks campaigns
`needs_review`; existing active campaigns never resume automatically. The allowlisted
staging database was upgraded during development. Production migration remains release work.

Campaign delivery is API-owned. Enable both `CAMPAIGN_SENDING_ENABLED=true` and
the owner messaging catalog only after configuring allowances, rates, and provider
readiness. Email uses `CAMPAIGN_RESEND_API_KEY` when set, with a compatibility
fallback to `RESEND_API_KEY`. Keep the campaign account separate from transactional
mail credentials; sends and provider reconciliation use the same selected key. Configure a dedicated verified
`CAMPAIGN_EMAIL_FROM`, and `CAMPAIGN_RESEND_WEBHOOK_SECRET`. Configure Resend's
signed callback at `/api/v1/messaging/webhooks/resend`. Keep campaign sender
reputation separate from signup/reset email. SMS uses the adapter contract in
`backend/services/campaign_providers.py`; an unregistered/unready adapter fails
closed. Release requires a selected adapter and real Israeli delivery/callback
qualification. No mock adapter is a release substitute.

`CAMPAIGN_PUBLIC_URL` optionally overrides the public origin for campaign
unsubscribe links without changing Allpay/subscription callback URLs. The local
callback tunnel in `Start.md` is for development only; deploy the compatible API
and register its stable Resend webhook before enabling production delivery.
The campaign sender configured during local qualification is
`campaigns@mail.prysm.co.il`; its subdomain has separate DKIM/SPF records.
Existing root-domain DNS and transactional mail credentials remain independent.

CEOs buy one-time Allpay top-ups in app Settings → Messaging usage & billing.
Verified payment status credits once; subscription adjustments and renewal dates
remain separate. The existing signed Allpay webhook dispatches messaging orders
by their durable IDs. Configure the API's public origin and production account
billing origin before checkout. Never enable token charging for manual top-ups.
Owner pricing, managed-account allowance anchors, funding reconciliation, refunds,
adjustments, and worker monitoring are in the adjacent `prysm-web` repository at
`/admin/messaging`. Deploy its compatible backend first. Unknown submission or
payment results retain reservations and require reconciliation; never blindly retry.
Chargeback reversals are reconciled from Allpay transaction IDs, including on
replayed callbacks. Provider-native cost amounts remain separate from retail ILS.

The general agent's additive `campaigns` Toolset is exposed only with
`PRYSM_CAMPAIGN_AGENT_ENABLED=true`. Its default is false to preserve the current
published relay manifest. Test the new draft tools with that flag in the authoring
runtime, publish the reviewed resource package (preserving named transcript
exports), and coordinate the matching relay flag/restart before exposing these tools
in the published agent. The existing `commit_change` Ask gate remains mandatory;
no agent tool activates, sends, tops up, or changes pricing. Use the checkout-local
CLI (`node node_modules/@agents24/cli/dist/cli.js`), not an older global installation.
No Agent resource publication is implied by local implementation.

Focused qualification: `backend/tests/test_campaign_messaging.py`,
`backend/tests/agent/test_campaigns.py`, existing Allpay/Artifact/scope tests,
`backend/tests/test_release_migrations.py`, and
`src/tests/unit/campaign-workspace.test.tsx`. PostgreSQL concurrency coverage uses
an explicitly disposable loopback `TEST_CAMPAIGN_DATABASE_URL`, creates unique
owned schemas, and never targets clinic data. New tables use RLS without Data API
policies; only the API database role accesses messaging records. Web provider
callbacks and unsubscribe links authenticate independently of user sessions.

Campaign database tests mirror production's disabled SQLAlchemy autoflush.
Flush delivery state before deriving run completion, and flush chargeback-return
ledger entries before calculating the remaining reversed amount.

Migration note: `0058_campaign_messaging` is required before the new API/UI.
Legacy SMTP settings, signup mail, subscription balances, and patient invoices
are retained. Messaging history is never inferred from old counters.

### Micropay SMS

Apply additive `0059_micropay_units` after 0058 before this API. Existing deliveries
retain their historical segment-based units, costs and holds; no repricing occurs.
New deliveries freeze both transport segments and provider billing units/policy.
`sms_rate` now means retail micro-ILS per provider billing unit, not per network
segment. Review the owner retail rate before enabling SMS; supplier prepaid credit
is separate from the clinic's Allpay-funded wallet. Micropay charges undelivered
submissions, so negative handset DLRs do not refund accepted sends.

Configure server-only `MICROPAY_TOKEN`, verified `MICROPAY_SENDER` (default Prysm),
and random `MICROPAY_WEBHOOK_SECRET` (at least 32 characters). In Micropay account
settings set the DLR URL to:
`https://<api>/api/v1/messaging/webhooks/micropay/<secret>`.
Prefer JSON POST; HTTPS HEAD callbacks with query fields are also supported.
Micropay documents no callback signature, so this URL is a capability: keep it
private and redact this path in proxy/access logs. The unsigned generic callback
route does not accept Micropay events. A durable inbox retains callbacks arriving
before send-response persistence; the API worker processes that inbox.

`MICROPAY_UNIT_TIERS` is an ordered JSON array of `[maximum_UTF16_length,units]`.
Default `[[134,1]]` admits only messages within the published 134-character
package. Length includes rendered personalization and unsubscribe URL; normalize
line breaks to a single CR as Micropay documents. Longer messages fail closed.
Configure additional bands ONLY from the actual purchased package's confirmed
billing terms; do not infer that 268 characters cost two purchased units from GSM
segment count. Emoji count as two UTF-16 units. No unverified English discount.
Any tariff, sender or provider-account change invalidates quotes and blocks old
queued SMS before provider submission; preview and approve a new run.

Provider API: JSON POST `scheduleSms.php`, token in body, one destination per
immutable delivery, durable task ID when returned. No documented provider
idempotency key exists. Ambiguous errors/timeouts are uncertain and never retried
automatically. Campaign-status `done` means processing completed, not handset
delivery; only a DLR establishes delivered/undeliverable. Micropay documents that
single-destination campaigns may not remain queryable. Unknown submissions without
a returned task ID require operator/provider investigation; never release their
holds based on a missing task. Live qualification requires development credentials,
confirmed tariff bands and controlled test destinations before production enablement.

Sources: https://site.micropay.co.il/api/send-sms.php,
https://site.micropay.co.il/api/campaign-status.php,
https://site.micropay.co.il/faq.php. Focused regressions are in
`backend/tests/test_campaign_messaging.py` (no external messages or charges).
Migration note: 0059 adds billing units/policy and a nullable DLR inbox payload;
apply through Alembic before API rollout. No existing financial amounts change.
Applied 0059 to the allowlisted staging database during development; production
migration remains part of the release contract.

Campaign draft Tools expose typed email/SMS fields and filter rows. Refresh the
Artifact contract and main Agent instructions together after schema changes;
relay health alone does not verify a successful proposal invocation. The signed
`test_signed_campaign_tool_prepares_typed_audience_and_commits_only_after_approval`
regression exercises that boundary. No database migration is needed for the Tool
schema correction; existing prepared changes keep their stored API field format.

### Compact SMS unsubscribe and live Micropay qualification

New SMS deliveries use `/s/<38-character-token>` at the configured public API
origin. The token encodes the delivery UUID and a domain-separated 96-bit HMAC;
it grants only unsubscribe access for that delivery. GET shows confirmation and
never suppresses a recipient; POST is idempotent. Existing long email/queued SMS
links remain valid. The canonical `https://api.prysm.co.il` link is 64 characters,
leaving room for useful Hebrew content within a 134-character purchased unit.
Publish the root `/s/` API route before sending the new format. The local callback
gateway admits only complete compact tokens and secret-path Micropay JSON POSTs,
in addition to its existing email routes; it does not expose the clinic API.

Local live qualification used exactly the final two approved trial units, sending
only to the owner's verified phone. Both a 115-character message and a
134-UTF16-unit message produced real `delivered` callbacks and each consumed one
Micropay unit. Callback arrival was approximately 6 and 15 seconds in this sample;
this is not an SLA or cross-carrier qualification. Replayed callbacks did not
charge twice. Public short-link GET/POST was exercised against isolated synthetic
staging records; GET preserved consent and repeated POST created one suppression.
All synthetic company/clinic/run/delivery/ledger records were removed afterward.
No patient data, live clinic wallet, credit purchase or production deployment was
involved. Micropay's temporary callback setting was restored afterward to avoid a
stale test tunnel. Configure its stable production URL after the API is released;
the Resend lifecycle helper does not update Micropay settings automatically.

V1 SMS identity: obtain Micropay approval for alphanumeric sender `Prysm`, include
the clinic name/contact in the text, and use web unsubscribe. The owner phone is a
test identity only. Replies require a separately provisioned business number and
are not included in this outbound-only v1. A plain SMS sender ID does not configure
an avatar. Keep the 134-unit tariff until longer-message bands are confirmed.

Migration note: No new database migration. This adds a compatible public `/s/`
route and compact signed SMS links; existing delivery IDs, financial amounts and
legacy unsubscribe URLs are retained. Alembic 0058/0059 remain prerequisites.

## Phone barcode scanner

Apply additive Alembic 0060 after 0059 before the scanner API/frontend. Configure
`SCANNER_NOTIFY_DATABASE_URL` against the same database using a session/direct
connection, verify notification readiness, then enable `SCANNER_ENABLED`.
The disabled default is the rollback switch. Desktop publication is separate.
The web build includes `/scanner/` and its scoped home-screen app assets.
Desktop scan responses optionally include fresh resolved catalog details so replay
does not need another lookup. Deploy the API before the frontend for the latency
improvement; older APIs remain supported through the existing detail endpoint.
Full catalog details are excluded from persisted events, phone responses and history.

Use focused scanner frontend tests and backend scanner/inventory coverage. For
backend tests explicitly set `DATABASE_URL=sqlite:///:memory:`,
`AGENTS24_ENABLED=false`, `PRYSM_AGENT_SERVICES_MANAGED=1`,
`SCANNER_ENABLED=false`, and `CAMPAIGN_SENDING_ENABLED=false` so test lifespan
hooks cannot start the developer's local relay or hosted consumers. Scanner tests
opt into their isolated flag. Test live SSE through the public proxy without
gzip buffering and verify both API replicas before production enablement.

Migration note: 0060 adds scanner transport tables with RLS and no direct client
grants. Optional `_scan_provenance` JSON preserves unchanged selections from
older clients; changed product fingerprints invalidate it. No clinical, stock,
or billing backfill is required.

The opt-in read-only staging broker probe is
`SCANNER_POSTGRES_PROBE=1 PYTHONPATH=backend backend/.venv/bin/python -m pytest backend/tests/test_scanner_postgres_notify.py -q`.
It verifies the exact staging target, starts two independent notification
listeners, and sends a notification through the transaction pool. It creates no
records or schema objects and is skipped by ordinary tests.


## Per-clinic campaign allowances and local qualification

Apply additive `0061_campaign_allowances` after `0060_phone_scanner`, then
`0062_messaging_checkout`, before the updated API and owner/clinic UI. It adds historical monthly channel balances,
explicit marketing consent, provider monitoring and an SMS allowance override.
Existing money balances, delivery prices and consumed email units are preserved.
New tables have RLS and no Data API policies. The migration configures 1,000 emails
and 200 SMS units per actual active paid clinic, ₪0.01/email and ₪0.05/SMS unit
(VAT included), increments the catalog revision and preserves its sending switch.
Existing plan prices and unused clinic capacity do not grant extra allowances.
Included units expire monthly; funded wallet credit does not. Clinic-count
decreases apply next cycle; increases grant only above that cycle's high-water
count. Catalog allowance changes apply to new periods; existing period grant values are
snapshotted. Legacy summary fields remain email-only aliases.

Reservations settle against their original historical period, even after renewal.
Callbacks and durable inbox reconciliation remain active while new sending is
paused. Submission uncertainty never authorizes a blind retry. Explicit consent,
notification preference, clinic access and suppression are checked before dispatch.
No consent backfill is inferred from existing patient notification preferences.

Manual top-ups require `MESSAGING_TOPUPS_ENABLED=true`, dedicated messaging Allpay credentials and
the correct public signed callback origin. This flag does not enable automatic
subscription collection. The live-payment guard remains mandatory. Checkout uses
the merchant's required payer name/email and verified settlement. Configure
`MESSAGING_ALLPAY_API_LOGIN`, `MESSAGING_ALLPAY_API_KEY`,
`MESSAGING_ALLPAY_TEST_MODE`, and `MESSAGING_ALLPAY_CHECKOUT_MODE=redirect` for
the separate messaging integration. Subscription credentials remain unchanged.
0062 snapshots integration identity and checkout mode; historical rows retain
the original subscription integration. Webhooks verify the expected key per order,
and messaging signatures cannot authorize subscription changes. Legacy Hosted
Fields retain their narrowly permitted official SDK; localhost uses redirect checkout.
`MESSAGING_PAYMENT_PUBLIC_URL` is a local signed-callback override; it is never a
production temporary tunnel.

Qualification commands: canonical fast checks scoped to campaign backend/UI
changes, `backend/tests/test_campaign_messaging.py`,
`backend/tests/test_campaign_callbacks.py`, `backend/tests/agent/test_campaigns.py`,
local setup/approval checks and `src/tests/unit/campaign-workspace.test.tsx`. Keep
script checks separate from frontend-only fast invocations to avoid selecting the
full web suite through the shared-file rule. Disposable PostgreSQL tests require
a loopback UTF-8 cluster via `TEST_CAMPAIGN_DATABASE_URL`; use a dedicated cluster,
never the staging database. The 1,000-recipient approval regression verifies
atomic reservations/claims without per-recipient database flushes.

Release gates still include Resend capacity beyond Free, an approved Prysm SMS
sender, stable public callbacks/unsubscribe URLs, real sandbox payment/refund
qualification and coordinated publication of the reviewed campaign Agent contract.
The isolated local Agent package and its Ask gate do not publish production
resources. Micropay purchased units remain distinct from GSM transport segments;
only the verified 134-UTF16-unit tariff is enabled by default.

Migration note: Apply `0061_campaign_allowances` and `0062_messaging_checkout` through the authorized release
migration gate. It is applied to allowlisted staging only during local development;
no production migration or activation is implied.


## Campaign staging evidence — 2026-11-08

Local qualification used a clearly named disposable staging company with two active
clinics under a three-clinic subscription: 2,000 emails and 400 SMS units, without
credit for unused capacity. Three owner-addressed Micropay SMS and one Resend email
reached delivered status through real callbacks. Two SMS exercised paid-unit
settlement at ₪0.05 each using disposable fixture credit. No patient messages or
purchases were made. Micropay reported 9,997 units after testing. Its temporary
callback configuration was restored. Callback duplicates and scanner-safe
unsubscribe were qualified without additional sends.

A separate redirect Allpay integration completed a documented test-card ₪100
checkout, signed callback, repeated verified reconciliation, and full sandbox
refund. Exactly one wallet credit was recorded; the final fixture balance and
reserved amount were zero. The sandbox returned no receipt document, so a real
accounting document was not qualified. Subscription credentials and collection
configuration were preserved. The isolated local AI package completed proposal,
explicit approval, saved inactive draft receipt and navigation to the campaign;
that campaign has zero runs. No production resources were published.

Verification: 130 focused backend tests passed (four PostgreSQL-only cases skipped
there); all 59 campaign cases passed against disposable PostgreSQL. The full
additive release migration chain passed against a disposable PostgreSQL cluster.
198 affected frontend tests passed, following an earlier successful 976-test web
run. The web production bundle built in 9.72 seconds. The account portal type check
passed; scoped lint had one existing class-order warning. The main repository's
global type check still reports unrelated baseline dependency/application errors;
no changed campaign or approval UI path appeared in that output.

For a future expressly requested release: apply Alembic through `0062_messaging_checkout`
before the compatible API/UI, configure `MESSAGING_ALLPAY_API_LOGIN` and
`MESSAGING_ALLPAY_API_KEY` for the dedicated redirect integration,
`MESSAGING_ALLPAY_CHECKOUT_MODE=redirect`, and verify stable public payment,
Resend and Micropay callback/unsubscribe origins. Set
`MESSAGING_ALLPAY_TEST_MODE=false` and `ALLPAY_LIVE_PAYMENTS_ENABLED=true` only at
that release's funding activation. `MESSAGING_TOPUPS_ENABLED=true` enables manual
funding without enabling `BILLING_CHARGING_ENABLED`. Keep campaign sending disabled
until sender approval, suitable Resend capacity and the matching reviewed Agent
contract have been deployed and qualified. Then activate the catalog and
`CAMPAIGN_SENDING_ENABLED` deliberately. No local temporary origin or isolated
Agent resource ID belongs in production configuration.

## Local integration of Zohar PRs 74 and 75

Migration note: `0058_layout_appointment_duration` adds the nullable layout appointment
duration. `0063_merge_layout_duration` joins its branch with `0062_messaging_checkout`
without renumbering existing campaign/scanner revisions. Both were applied through
Alembic to allowlisted staging; its previously hand-added duration column was preserved.
Production requires the combined migration graph before the updated API/frontend.
The SoftOptic lookup backfill remains an explicit, dry-run-by-default operation;
integration does not apply it or rewrite imported clinical values.

Qualification uses canonical scoped fast checks, the layout-duration settings tests
in Hebrew/English/French, and `backend/tests/test_release_migrations.py` against its
disposable PostgreSQL cluster. The contact-lens tab retains existing exam sections,
and its display normalization preserves decimal visual acuity.

## Release v1.0.102

This release includes Zohar PRs 74/75 and their review fixes, barcode/catalog
selection, inventory counting, the phone scanner, and the current UI/save repairs.
Campaigns remain local development work: production builds hide authoring and
messaging settings, redirect direct campaign navigation, and the API excludes
campaign/messaging routers and worker when `CAMPAIGNS_ENABLED=false` (the production
default). Keep `CAMPAIGN_SENDING_ENABLED`, `MESSAGING_TOPUPS_ENABLED`, and
`PRYSM_CAMPAIGN_AGENT_ENABLED` false. Do not publish the local campaign Agent package.
Existing subscription billing activation and credentials remain independent.

Migration note: apply additive revisions through `0063_merge_layout_duration` via
the API pre-deploy Alembic gate before web/desktop publication. Campaign tables are
dormant prerequisites in the scanner migration chain; no campaign activation,
consent backfill or SoftOptic lookup backfill is part of this release. Existing
clinical records and legacy order/exam write contracts are preserved.

Enable production `SCANNER_ENABLED=true` with `SCANNER_NOTIFY_DATABASE_URL` pointing
to its existing database through a direct/session connection. Verify listener
readiness and streaming through the public web proxy. Include `scanner/**` in web
watch paths. The packaged app uses the production HTTPS phone page by default.

The API and migrations still deploy first; web and migration-worker deployments
then run concurrently, with each exit status checked. Dependency preparation,
Web CI and Railway web installs omit non-gating npm audit/funding requests.
The selected Windows/macOS candidates retain packaged/runtime/updater checks.
