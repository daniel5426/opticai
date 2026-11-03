# Supply automation and the shared agent

Last Updated: 2026-11-03

The sidebar and full agent page render one conversation surface. Threads remain user/clinic-owned;
the page is per-message context, including registered unsaved forms. Credentials are excluded.
Old patient-scoped Agents24 threads remain available in the previous-conversations archive under
their original patient authorization. Historical data is not merged or rewritten.

## Latest acceptance — 2026-11-03

The three November 3 failures are repaired and the original XLSX now passes live staging acceptance. Composer validation includes authorized host spreadsheet-to-text conversion; the unchanged runtime contract validates the converted attachment. Typed Tool rows preserve source coordinates, flat frame attributes and textual identifiers; JSON mutations carry the correct content type. Do not relax global MIME policy or multipart handling.

Verification: 33 focused backend tests, 25 UI tests and web build pass. A real two-row delivery preserved barcodes, colors, eye sizes and Delivery rows 2/3. Review price correction and server validation passed, reload preserved the reviewed revision, and explicit approval created only two synthetic staging products with stock 2/3. No variants existed before approval. Post-approval reload restored the applied receipt; a second audit confirmed stock remained 2/3 without replay. The updated Artifact contract/instructions were applied/published with the official CLI; local services are ready. No production inventory changes or Prysm application deployment. No schema migration is required. See [integration feedback](../agents24-feedback.md) for original failures and their resolution.

## Current import surfaces

AI supply imports now run through the main agent conversation and its existing `search_supply`
and `prepare_supply` tools. Successful tool receipts render editable, paginated supply cards
inline in that response. Review, validation, approval, failures and the applied receipt stay
in chat; history restores the same persisted proposal. A collapsible Previous imports section
recovers unexpired jobs without a chat-origin marker. It never inserts them into another thread.

The inventory toolbar exposes **Import CSV / Excel** only in its three-dot menu. Its manual
modal uses fixed inventory columns and ordinary inventory authorization, independently of agent
availability. File preview supports CSV, XLSX and BIFF8 XLS, with an explicit Excel worksheet
selector, source row locations, localized validation, formula rejection and a downloadable CSV
template. Only the selected worksheet and valid rows are imported. Existing create/opening-stock
semantics remain; manual import does not update existing items. Older XLS formats must be saved
as XLSX. The deterministic reader is shared with chat spreadsheet conversion.

Roll out the backend and web changes with the updated main assistant instructions through the
normal release contract. No resource publication or deployment is performed by this update.
Keep the supply mapper workflow, configured ID and requested worker support until existing jobs
finish or expire; new chat imports do not launch that workflow. Restart the app-owned API after
updating code so `/inventory/import/preview-file` is registered.

Migration note: No schema migration is needed. Chat origin uses existing AgentJob definition JSON;
`prepare_supply` adds a response discriminator without removing existing fields. Existing CSV
preview/commit, supply endpoints, audit receipts and in-flight jobs remain supported. Source retention
and approval protections are unchanged. Historical acceptance notes below describe the previous UI.

Current automated checks: 560 frontend tests, the web build and canonical fast check pass;
22 inventory backend tests pass separately from 262 agent tests (2 skipped). The resource package
passes `agents24 prepare`. The repository-wide TypeScript check retains existing diagnostics;
none reference the new manual import or inline supply components.
Live web verification exercised XLS formula rejection and leading-zero barcodes in Hebrew RTL,
XLSX worksheet switching in English LTR, CSV preview in French LTR, template download and the
compact chat surface. The original Hebrew preference was restored. Shared-clinic inventory was
not changed. Approval, idempotency and restored supply cards were exercised with isolated tests;
a fresh live AI supply run was not submitted to the shared clinic.

## Configuration

1. Install the backend requirements (the legacy Excel reader adds `xlrd==2.0.1`).
2. Run `npx agents24 prepare agents24 --json` to validate the editable resource package.
3. Through the existing environment's Agents24 resource release process, bind a speech-to-text
   model to `speech`, apply/publish the supply workflow and speech ingestion pipeline, and refresh
   the main assistant/Artifact bindings for the `prepare_supply` tool and page-context instructions.
4. Set `AGENTS24_SUPPLY_AGENT_ID` to that environment's supply workflow resource ID and
   `AGENTS24_SPEECH_PIPELINE_ID` to its managed speech executable. Retain the existing document
   and OCR pipeline settings. Development uses draft resources; production uses published ones.
5. Restart the API, Artifact host, and requested-work worker together. Core pages remain usable
   when the optional agent is unavailable. No resource is published by application startup.

The supply mapper has no tools. Spreadsheet parsing preserves source coordinates and identifiers;
model output is a proposal, validated again by the host. PDF/images/audio reuse managed processing.
The requested queue handles `supply` jobs, with durable batch checkpoints. Imports are reviewed
before applying, and apply retries reuse the persisted revision. Re-uploading identical content
for the same operation/user/clinic opens its existing import, including its applied receipt.

Catalogs and prices do not add stock. Deliveries add explicit quantities; physical counts set an
explicit absolute quantity. Missing quantities are errors, and blank manual counts are omitted.
Units/pack ambiguity must be clarified rather than inferred. Company-shared product metadata uses
the existing catalog update semantics; stock remains clinic-specific.

## Verification and limitations

Synthetic tests cover extraction, proposal/apply behavior, stale state, duplicates, prices,
receipts, counts, access boundaries, page hints and shortcut validation. Run the existing inventory
suite separately from the agent suite to avoid the repository's fixture collection-order issue.
Live acceptance has now verified Excel/PDF/image extraction, proposal review, apply and duplicate
apply protection in the isolated clinic. Re-uploading the Excel receipt in the running web app
reopened its committed result without changing stock again. Shared sidebar/full-page navigation
preserves the draft; the destination host is registered when it mounts. Session loss no longer
renders protected pages without their navigation, and development updates retain shared contexts.

The user-supplied replacement organization key is configured in the protected backend and
synthetic environment files. Both installations are published: main, brief, insights, supply,
document/native-document/speech pipelines, document evidence Store and clinic Artifact. New
resource/executable IDs and relay clients are configured. Explicit Ask was restored for each
installation's exact commit_change Tool using the authenticated governance UI. Publication alone
does not establish that policy. API keys cannot change it through the governance endpoint.

After this repair, a fresh synthetic run completed four tool calls without errors, correctly
counted three clients and restored its thread. Speech processing in the new organization returned
the expected synthetic sentence. A new supply request is currently blocked by
BILLING_CREDITS_INSUFFICIENT: the configured mapper's output reservation exceeds the new
organization's remaining credits. No credits were purchased and no model was silently changed.
The UI now explains insufficient credits and displays a safe support reference.

Testing uses the running web app by default (see AGENTS.md). Real microphone/OS permissions and
release-signing acceptance remain native-only checks; the local ad-hoc build is not a notarized
release. The automated waveform, shortcut, cancellation and queue behavior are covered by tests.

The speech original follows the existing protected document retention (seven days). The visible
chat message is the transcription; the recording is retained in its document job. Committed supply
reviews retain their audit result when source recovery expires. Their original files expire normally.

Migration note: No schema migration is needed. New job kinds, source references and proposal
revisions use existing AgentJob JSON fields. Existing inventory endpoints remain compatible;
variant listing adds offset/has_more and the application fetches all pages. Shortcuts are device-local
per-user preferences, defaulting to Shift+Space. Active-thread preferences now include the agent
installation ID returned by availability; old keys remain untouched. Moving organizations recreates
agent resources, but does not move old conversations or source uploads. Restart the backend and
workers after configuration/code changes. Roll out worker/backend/resource changes together.

macOS packaging includes the microphone usage description and localized InfoPlist strings in
Hebrew, English and French. It keeps normal browser/OS permission prompts; the app does not
grant itself microphone access. Confirm microphone capture in the signed release build.
The packaging keys follow electron-builder's macOS configuration:
https://www.electron.build/v26/docs/mac/

## Dependency timeout repair

Failure `0278dc02-caf2-4f73-bc93-540c8f4fa124` belongs to a clinic_context Tool call in run
`14099a1d-d8cf-4894-b574-209c71f69d1f`. The run completed a greeting while two Tool calls timed out.
The local clinic supervisor had stopped its Artifact/worker services because the newly installed
commit_change Tool retained always_allow. Restoring explicit Ask and restarting the supervisor
restored its readiness gates. Local availability now reports false if automatic service startup
fails, even when the platform health endpoint remains healthy, preventing this misleading ready state.
The runtime also accepts the canonical run.failed payload.error envelope, preserving safe failure
references in background jobs.

Latest checks: backend agent suite 259 passed, 2 skipped; separate inventory suite 16 passed;
frontend agent/shell/auth suite 180 passed; focused final UI checks 11 passed. Web production
build passed. Repository-wide TypeScript checking still has pre-existing errors, including the
router shim's missing Navigate export; no new source errors were introduced in the changed
implementation. The running OpticAI web app verified the inventory wrapper, global sidebar and
full-page draft handoff. The local key remains only in gitignored, protected server env files.
