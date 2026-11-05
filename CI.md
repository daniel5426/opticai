# OpticAI CI and delivery

Last Updated: 2026-11-04

The current release contract is staging verification -> production promotion -> desktop publication. Preserve it. Owner `daniel5426` may use the existing direct-main workflow; contributors follow AGENTS.md.

`Backend CI` and `Web CI` own normal validation. `Verify Staging` (`staging-electron.yml`) must succeed for the exact release SHA before `production-promotion.yml`. Production promotion does not require a database backup confirmation. Run the retained workflow with its SHA/ref aligned. Desktop `release.yml` requires a `v<version>` tag matching both package files and successful promotion of that same SHA. Version/tag are explicit review inputs. Do not move an existing release tag.

Railway project: `fb97ce50-fb72-4612-bfd1-c6d8a7bed9cb`. Production promotion owns API `opticai`, migration worker `softoptic-migration-worker-Z2hA`, and web `prysm-web`; use the workflow's exact environment/target contract rather than local CLI linkage. Verify API `/health` and `/health/database` on `https://api.prysm.co.il`, web health and recent worker logs. Preserve workflow-managed database migration ordering. Staging verifies the exact main auto-deployments. Its bounded fifteen-minute deployment wait includes cold dependency installation and image export, and still rejects terminal failures or a different SHA. Unchanged-file skips require a successful deployed revision with identical watched files; a skipped repair commit cannot hide an older pending application build. Production uploads its exact-SHA checkout after applying the verified public dependency inputs. Do not upload the user's uncommitted directory.

Select only the affected, requested web/backend/desktop targets. A web/backend release does not automatically request desktop packaging or publication. Desktop changes require the packaged macOS/Windows and updater checks in [release checklist](docs/references/release_checklist.md). Do not infer desktop publication from web health. Generated desktop env files must remain server-secret-free.

For rollback, identify the last verified compatible revision and exact service deployment or prior desktop release; preserve database compatibility. Do not destructively reverse migrations or overwrite release tags. Stop and report when the required rollback target is unavailable.

## Verification and improvement

Google OAuth release configuration and callback requirements are in
[Google OAuth configuration](docs/references/google-oauth.md). The API needs
the web ID/secret and desktop ID before the repaired web/desktop clients roll
out. The web secret stays on the API; never add it to renderer build inputs.

Canonical commands: `node scripts/devdesk-check.mjs --fast` for local feedback; `--full` for explicitly requested broad verification; `--fast --files <reviewed-paths> --tests <focused-test-paths>` scopes local feedback; `--release --lock-only` always checks release dependency provenance before dependency installation, including public-only locks, so application-version edits cannot bypass stale-input detection. The installed tracked pre-push hook runs fast checks and release provenance validation. Install the tracked hook with `python3 ~/.codex/skills/ship-and-watch-production/scripts/install-hooks.py "$PWD"`; it chains existing hooks. DevDesk does not own hook setup. No formatting rewrite is automatic.

## Speed-first shipping loop

Delivery speed is the optimization target. Use the pre-push hook as the preflight rather than running it twice. If the same candidate inputs were already checked, `CI_PREFLIGHT_DONE=1 git push ...` skips only this tracked hook; other chained hooks still run. The coding agent must select the minimum useful checks for the actual diff, run independent checks/monitoring in parallel within local resources, and reuse successful checks while their inputs/dependencies are unchanged. Normal checks run in this checkout. Avoid repeating a full local suite in the hook, GitHub and each promotion step. Full suites/browser matrices/container qualification belong to affected high-impact changes or scheduled/manual coverage. Narrow or remove low-value/duplicate checks when justified; existing gates are open to improvement. Keep the checks that directly protect this change's important behavior and real artifact.

Every ship, including a successful one: inspect recent timings; identify the slowest avoidable step; implement a proportionate speed improvement in the owning script/workflow; verify its behavior and measure the result when practical. Focused workflow/test-selection/cache/parallelization improvements are part of shipping authority. If no worthwhile change exists, state the concrete reason. Do not replay historical qualification checklists or perform a 150-run audit on every ship. Report total elapsed time, the bottleneck and improvement alongside the production result. Detailed timing evidence belongs in Git metadata (`ci-timings.jsonl`) or provider artifacts, not DevDesk. The tracked hook automatically records its duration in Git metadata when the shared skill is installed. Its `scripts/timing.py` also records separately timed build/delivery commands, with bounded history and no command arguments, environment or output.

If a repair changes only one component, rerun only invalidated checks and reuse unaffected delivery evidence. Unknown/shared changes get the broader relevant selection; a small leaf change gets focused tests. Keep component selection tested. Do not report invented coverage or speedup figures. Preserve authentication, data isolation, migration correctness and current hosting spend.

Development may use the local Agents24 train. CI/container builds use the explicitly reviewed public package manifest and lock in `config/devdesk-release/`, generated by `node scripts/devdesk-release-inputs.mjs prepare`. Git attributes keep receipt-hashed JSON inputs at LF on every build platform. The receipt pins source hashes and public artifact integrity; these are distinct public artifacts, not rewritten development tarball URLs. `check` rejects stale inputs. `apply` is restricted to an explicitly requested temporary release worktree or CI/container build (`CI_RELEASE_BUILD=1`). It leaves the original development package files and installed modules intact. Include every changed release input in the reviewed scope. Railpack applies the same verified public inputs before installing dependencies for automatic web deployments. Regenerate after dependency or application-version edits and verify the resulting public inputs when dependency or version changes require it. The public release pins `@agents24/chat-react` 0.5.42 for the supported composer ref/text API. Local pre-push runs related frontend tests and changed Python compilation/focused changed tests in parallel. Web builds run once in the delivery path; a separate local build is optional when it gives useful earlier feedback. The legacy root TypeScript configuration has no passing baseline; adopting a full-project type gate is separate work, not a prerequisite invented by DevDesk.

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

Set the current package version, then run `node scripts/release-targets.mjs --windows-only` to exclude macOS for that version in `config/release-targets.json`. Both candidate build and publication read this exact-SHA policy. Future versions include Apple Silicon by default; skipping Mac is never inferred from a missing artifact. Windows receipts, native-reader resources, updater integrity, CI and promotion remain required. v1.0.99 is explicitly Windows-only.

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

## Agent conversation entry

Normal entry to the main agent page starts a new conversation. Expanding a visible sidebar deliberately preserves its conversation and draft. Recorded audio reuses a currently visible agent conversation; with both agent surfaces closed, Send selects a new SDK conversation before submitting. Startup no longer automatically restores the last device-saved thread; existing conversations remain available through history.

Migration note: Not needed; existing server conversations and local storage are preserved. This changes frontend selection defaults without a schema or API change.
