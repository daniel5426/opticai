# OpticPlus automatic migration implementation plan

Last Updated: 2026-11-02

Status: Implemented behind a production capability gate; isolated full-data rehearsal passed. Windows/ACE and source-screen release validation remain open.

## Objective and scope

Add **OpticPlus** as the third supported source (`opticplus`). A clinic should select OpticPlus or provide its installation folder/transfer ZIP, review an automatically generated summary, and start migration. Discovery, consistent snapshot acquisition, extraction, mapping, upload, background import, recovery after interruption, and reconciliation must require no manual SQL, CSV editing, Access installation, DSN setup, or field-mapping spreadsheet for supported variants.

Support the supplied ACE12 split-database layout, the observed older optional-column variants, local/network backend locations, and copied installations. Build a reusable Access discovery/extraction layer with explicit application adapters. A different Access app still needs its own verified mapping; this plan does not promise automatic interpretation of arbitrary unknown applications.

Evidence and limitations are recorded in [OpticPlus transfer research](../../references/opticplus-transfer-research.md), with complete aggregate evidence in [the audit JSON](../../generated/opticplus-transfer-audit.json). Patient data and executable source payloads must not be added as repository fixtures.

## Required operating behavior

1. **Discover:** identify OpticPlus by file signature and core schema; resolve workstation links to the authoritative backend; group frontend copies and backups around their dataset.
2. **Snapshot:** obtain a stable read-only backend copy, record hashes and provenance, and detect source changes during acquisition. A single quiesced cutover is the initial supported live-clinic path; continuous live synchronization is not promised.
3. **Analyze:** enumerate all user tables/columns, validate keys and references, classify supported mappings, locate approved document references, compare candidates, and produce counts and warnings.
4. **Review:** show the selected source, counts, domain coverage, missing material, and exception summary. In this supplied folder the current backend is automatically recommended; backups and the empty template are excluded from normal import.
5. **Migrate:** export, upload, import in bounded transactions, retain trace data, and resume safely after interruption.
6. **Reconcile:** confirm source/target coverage, relationships, finances, attachments, source trace, and search indexes. Completion includes an explicit retained/unmapped/exception summary.

Routine record issues must not require manual editing of source files. Missing dates, unfamiliar clinical text, and unresolved exam associations preserve the record with a warning and original source data. Ambiguous source selection, unstable snapshots, corrupt bundles, unresolved source identity, or an incompatible required schema stop before importing affected data. Such conditions require a specific action, not a guessed selection.

## Architecture decisions

### A. Reuse the current migration infrastructure

Keep the existing `/migration/imports` API, direct-upload storage flow, worker queue, job history, leases, progress, and clinic scoping. Keep the physical `softoptic_migration_jobs` table and its compatibility alias; do not rename persisted infrastructure for this addition.

Add `opticplus` to the source registry and dispatch to a separate importer. The historical names in generic helpers may remain until a focused cleanup is justified. Do not route OpticPlus into SoftOptic's cleanup/replacement path or OptiTech's table/mapping code.

Create explicit adapter capabilities: discovery, export, validation, supported domains, source-archive availability, pause boundaries, report generation, and cancellation safety. Update existing two-source ternaries so an unknown source cannot silently fall through to SoftOptic or OptiTech.

### B. Share the reader engine, keep mappings separate

Build a small Access-reader module on the existing direct **libmdb** dependency, with application-specific export profiles. Retain OptiTech's existing profile and emitted format. Add an OpticPlus profile rather than weakening its required-table checks.

The reader must support:

- File-format and schema probing without loading macros or starting Access.
- Local/linked-table catalog metadata for discovery, including backend file paths.
- Case-insensitive field lookup with original source names preserved.
- Explicit per-table keys, dependency filters, and optional-column policies.
- Correct Unicode, quoted multiline strings, null-versus-empty distinction, Boolean normalization, full-year ISO dates, and original date representation/serial where available.
- Enumerated row counts independent of cached table counts; report both.
- Large memo/binary handling without silently truncating at the existing 16 KB bind size.
- Streaming output, bounded memory, machine-readable progress, and explicit failures for unreadable required tables.

Package the helper for Windows x64 first. Test the actual packaged EXE and its dependent DLLs on Windows without Access installed. macOS/Linux transfer analysis can use the same library only after supported builds and UI capability checks exist; the macOS research result alone is not a shipping guarantee. Continue the existing dynamic-linking/notices/source-build packaging approach; do not ship the research CLI utilities merely because they are installed locally.

### C. Bundle and mapping contract

Use `format_version: 2` for the existing ZIP transport. Define `source_system: opticplus`, `mapping_version: 1`, and a separate extractor/profile version. Add application-specific semantics through manifest metadata; do not claim OptiTech mapping compatibility.

Suggested content:

```text
manifest.json
source/optic_dt.accdb
tables/<approved-table>.csv
raw/<approved-table>.jsonl
lookups/<approved-frontend-table>.json
documents/<content-hash>/<safe-name>
source-schema.json
reports/discovery.json
reports/extraction-coverage.json
```

The raw JSONL sidecar preserves typed nulls, original text, and date representation without making CSV emptiness ambiguous. It is the canonical evidence for source snapshots; CSV remains available for reuse and diagnostics. Never export the `pass` table or messaging credentials as structured data. The retained original backend inherently contains all original bytes and must use private clinic-scoped storage and existing authorized signed-download controls.

Manifest fields include snapshot SHA-256/size, dataset binding, schema signature, source-format version, selected patient IDs, include-documents choice, table/column dispositions, physical/enumerated/exported counts, file hashes, optional missing tables, document references, excluded file categories, extractor version, and warnings. Do not upload unrelated programs/installers or the entire installation ZIP merely to preserve backend data.

Server validation must check safe archive paths, extraction size/count/ratio bounds, source/profile/version, every declared file hash, logical CSV/JSONL record counts, required columns, unique keys, patient selection closure, raw/CSV agreement, and source-archive fingerprint. Client preview metadata is not trusted validation or authorization.

### D. Stable identity and retry semantics

Distinguish **dataset identity** from **snapshot hash**. A file hash changes when patients are edited; a path changes when a file is copied. Neither can be the only entity namespace.

Bind a generated stable dataset ID to the selected target clinic in server-owned job metadata on first import. Include it in each OpticPlus source reference, for example:

```text
opticplus:<dataset-id>:cust_list:<numw>
opticplus:<dataset-id>:checks:<bdikanum>
opticplus:<dataset-id>:adchecks:<bdikanum>
opticplus:<dataset-id>:orders:<rnum>:group
opticplus:<dataset-id>:orders:<rnum>:slot:<slot-id>
```

Use existing `MigrationSourceLink` uniqueness, scoped by source, clinic, target model, and raw reference. Preserve the full snapshot hash in each job; later jobs may reuse a dataset binding only after server-side lineage checks. Blank `companyn` identity in this sample means no universal identity can be inferred from company details. Ambiguous/new lineage requires a new explicit source binding, not a merge based on coincident numeric IDs.

Write imported entities, trace links, baselines, and checkpoint advancement in the same committed batch. A retry skips identical units and safely completes partial units. Source raw data must not be replaced with edited target content. Maintain the imported baseline separately from current target values; user edits, merges, and soft deletions win on later reimports and appear as conflicts. Do not recreate a user-deleted record simply because its source key remains present.

For tables without a reliable key, use content hash plus occurrence identity for exact-snapshot retries. Do not pretend this establishes identity for edited rows in a later snapshot. Preserve and report ambiguous unkeyed records rather than silently duplicating, deleting, or overwriting them. No backup-union or destructive synchronization is part of standard migration.

## Discovery and consistent acquisition

Search order on Windows:

1. User-provided transfer ZIP, installation folder, or database.
2. Known OpticPlus installation locations, application shortcuts, and existing mounted drive roots.
3. `optic.accdr`/`optic_dt*.accdb` files and their approved metadata: `MSysObjects` linked-table targets, `path.full_path`, and document-root settings.
4. Referenced local/network backend locations accessible through the user's existing session; do not enumerate arbitrary unmounted network hosts.

Probe for `cust_list.numw`, `checks.bdikanum/numw`, `adchecks.bdikanum/numw`, and `orders.rnum/numw` with expected field families. Core table signatures identify OpticPlus; optional columns distinguish supported versions. Classify files as backend, frontend, maintenance utility, template, backup, lock, or unrelated asset.

Prefer an actual current frontend link to a matching backend, corroborated by business-row activity and completeness. Rank filename/date/size only as supporting evidence. Rebase stale absolute links within a transferred folder by schema and provenance. Deduplicate byte-identical candidates by hash. Show a choice only when multiple distinct plausible live datasets remain. Never combine them automatically.

For the provided ZIP, extract into an isolated directory with path/symlink/size limits and bounded nesting. Nested backups are inspected as candidates but are not selected because their ZIP timestamp is newer. Installer payload databases must remain excluded even though their filename is `optic_dt.accdb`.

For a live database, use a read-only file-handle strategy that prevents concurrent writes during the snapshot when the OS/share supports it. If that cannot be established, require closing OpticPlus or supplying a verified offline backup. Hash/size/time comparisons before and after copying are additional mutation checks, not proof of transactional consistency by themselves. A stale `.laccdb` must not permanently block an offline copy, and the importer must never delete it to force access.

Pilot patient limits select sorted source `numw` values and include their dependent rows, receipts through order IDs, and necessary reference tables. Other patients must not leak into active target data. If a full original backend is retained during a limited pilot, the review must state that archive scope clearly.

## Domain mappings and acceptance rules

### Customers and profile information

Create one client for each `cust_list.numw`. Proposed standard fields: `pname` first name, `fname` last name, `zehut` national ID, `bdate` birth date, `min` gender, `address/city/mikud` address, `sel/tel/telw/fax/email` contacts, and `kupa` health fund. Validate first/last-name meaning against the source UI before locking the mapping.

Preserve complete address text without guessing street/house-number boundaries. Preserve telephone and national-ID originals; normalize search values without losing leading zeroes. Blank/invalid/future birth dates remain null in canonical fields with source values available. Do not infer families from shared surname, telephone, or address.

Keep undocumented flags, sort identifiers, Hebrew birthday components, referral/source context, and clinical remnants in named source metadata until their semantics are confirmed. Do not map `ocupation` into occupation: the source queries use it as a status field. Do not treat `sendb=-1` as verified current communication consent.

### Glasses and contact-lens history

Create a separate source-linked clinical record per `checks` and `adchecks` row. Use known `qtyp` values to select final, old, subjective, objective, or trial cards. Normalize only verified spelling variants. Unknown types become visibly labeled imported records rather than silently being classified as final prescriptions.

Map verified right/left sphere, cylinder, axis, additions, prism, VA, PD, heights, contact-lens details and over-refraction into current canonical cards. Preserve raw zeros; zero is not missing. Known `PLANO` equivalents may map to zero while retaining raw text. Preserve `BAL`, composite values, unknown base directions, and outliers as text/supplemental findings where canonical fields cannot represent them. Do not guess units or decimal positions.

Preserve examiner names as source attribution. With `employees` empty and `orders.EmployeeID=0` here, do not create user accounts or silently assign clinical authorship from names. Missing/invalid exam dates remain undated; current models permit null dates. Rebuild the prescription search index after import and verify records through actual exam open/edit/save/reopen flows.

Add a minimal OpticPlus supplemental card only for substantive data that existing cards cannot safely represent. Prefer existing canonical cards wherever possible. Any new card type needs he/en/fr strings, registration/save-load coverage, and a compatible-client rollout before importing records that use it. Older clients must not be allowed to discard unknown cards on save.

### Orders, product slots, and shared billing

Create one order group for each source `orders.rnum`, with one shared billing total. Preserve source `ordernum`. Decode first/second product slots using `color/color2`, frontend `tb_lens`, eye flags, quantities, descriptions, and actual populated content. Do not use `cn` as a glasses/contact discriminator, treat the slot number as an eye, or create an extra pair merely from a default label.

Lock the slot-to-entry rules after source-screen validation. Depending on verified semantics, represent slots as entries or as components of one entry; each source component gets a stable source-slot reference. Preserve repeated components and ancillary `oth*` items. Handle a mixed glasses/contact row through the shared group if encountered in validated fixtures. Exactly one source header total must survive regardless of target entry count.

Use the current order-group service/invariants, including group-level billing, `source_entry_id`/`source_slot` line-item references, and protections against legacy saves overwriting a shared invoice. Verify compatibility hooks do not create extra standalone groups while the importer constructs the intended group.

Financial mapping: final total from `gf_price`, accumulated paid amount from `tpay`, remaining balance checked against `gpay`. Preserve pre-discount context and negative/credit values. Calculate with decimal arithmetic, round only at defined currency boundaries, then store through current model contracts. Do not silently recompute final totals from product prices when the source disagrees.

This sample has no receipt events. Store the imported accumulated payment as an explicitly labeled opening balance using the existing `prepayment_amount` contract; do not create fictitious dated `BillingPayment` rows. When real `tb_kabala` events exist, import verified events and only the residual opening amount, so nothing is counted twice. Missing transaction dates or unverified event kinds remain source history until they can be represented faithfully.

Keep discount/line-total discrepancies visible in billing/source notes and reconciliation. Any balancing source adjustment must be explicitly labeled and traceable, with an approved rule; do not invent a product or unexplained discount. Honor currency provenance; validate the expected ILS context rather than relabeling an unknown currency.

Link prescriptions only when verified source rules yield one compatible patient/date/type/usage candidate. `orders.number=0` cannot provide a link here. Preserve ambiguous/unmatched orders and their `mwdate`; never choose the latest prescription to fill the gap.

### Other tables: full coverage without invented semantics

| Domain | Sources | Initial behavior |
| --- | --- | --- |
| Supplier/reference lists | `SAPAKIM`, bank/credit lists, approved frontend lists | Import supported lookups; retain unused original codes |
| Spectacle-lens catalog | `tb_ad_catalog` | Import verified lens lookups/prices where current contracts support them; retain full source definitions. Current stock catalog supports frame/contact categories, so do not misclassify spectacle lenses as contact lenses |
| Frame catalog | `tb_catalog` | Import supported catalog identity after identity/cost rules pass. All supplied `amount=-1` values are preserved as an unknown/sentinel stock value, not imported as negative stock or silently converted to known zero |
| Clinical extras | `tb_comp`, `tb_gnrl_tests`, `tb_quest`, patient clinical remnants | Preserve source-linked history; map only verified labels/units. Unknown `tstN` and questionnaire flags stay source-labeled |
| Remarks/files | `person_remarks`, configured scan roots | Split supported notes versus file references by verified `qtyp`; fetch only approved referenced files; report missing/ambiguous references |
| Appointments | `tb_date_list` | Map verified client/date/time/duration/status; retain unresolved or clientless entries without inventing patients. Ignore frontend time-grid cache as appointments |
| Attendance/users | `employees`, `presence`, `presence_type` | Explicitly optional, fixture-tested mapping; preserve identity and attribution; do not import authentication secrets or automatically create privileged users |
| Quotes | `proposals` | Preserve as distinct source-linked quote history unless a supported quote target exists; do not inflate completed orders |
| Supplier finance | `tb_hsapakim`, `tb_q_checks`, `tb_amlot`, supplier contacts | Retain with a documented unsupported-domain disposition where Prysm lacks an equivalent; do not mix into patient receivables |
| Inventory movement | `tb_upd_amount` | Only create stock movements after units and opening-stock semantics are verified; historical orders must not decrement current stock again |
| Config/counters | `add_num`, `add_order`, `companyn`, `doc_title` | Preserve approved context; do not overwrite company identity, numbering, or live settings automatically |
| Passwords/system/cache | `pass`, Access system tables, selection/print/export caches | Exclude secrets; schema-inventory other exclusions. Preserve meaningful unresolved scratch evidence in the source report without creating authoritative business events |

Every source table and every nonempty business field receives a disposition: canonical mapped, visibly preserved, archive-only unsupported, empty, or intentionally excluded with a reason. Archive-only retention must never be presented as full operational support. A populated unsupported domain is shown in preview and the completion report. Populated samples for empty domains are release prerequisites before claiming those domains are automatic across clinics.

## Jobs, progress, lifecycle, and reports

Proposed phases: `validate`, `foundation`, `clients`, `clinical`, `orders_billing`, `supplemental`, `search_index`, `reconcile`. Within each domain, checkpoint a deterministic key cursor and bounded batch size. Start with 250–500 source rows per transaction, then tune against the full fixture. Never use CSV physical line numbers as business identity.

Reuse leases and heartbeat infrastructure, but add tests for a worker losing its lease while another resumes the same job. Verify ownership before committed work; do not let stale workers write after lease loss. Serialize active migration creation per clinic with a transactional clinic lock and recheck, then serialize against data-prune work. Preserve existing storage keys and job contracts.

Cancellation is permitted before the first committed import write. Thereafter support pause/resume and a scoped rollback preview. Update `cancel_job` so it recognizes new phases/write markers; its current hard-coded SoftOptic/OptiTech checks are insufficient. A rollback must follow source-owned dependencies, skip user-edited/shared records, include groups/billings/payments/files/indexes, and report conflicts. Do not repurpose full-clinic deletion as migration rollback.

Persist large coverage/exception reports as private storage objects with bounded summaries on the job, rather than placing all patients' diagnostics in job JSON. Reports should include source-selection rationale, candidate hashes, source/target counts, created/updated/skipped/conflicted units, unmapped field coverage, date/value warnings, unmatched prescriptions, financial reconciliation, and attachment outcomes.

Generalize source-archive/report download capabilities: existing endpoints contain OptiTech-only checks and filenames. Keep old responses working for existing jobs while adding source-appropriate names and manifest checks. Confirm clinic deletion/prune removes the new source archives, reports, and document objects without removing unrelated files. Local post-upload cleanup applies only to exporter-owned temporary paths; it must never remove the user's original database, folder, or transfer ZIP.

## Concrete implementation work packages

| Work package | Principal files / additions | Exit criteria |
| --- | --- | --- |
| 1. Mapping contract and fixtures | New `backend/migration/opticplus/` specification, normalized record definitions, redacted synthetic fixtures | Name/slot/status/units rules validated; every table has a disposition; count/date discrepancy independently checked |
| 2. Shared Access reader | `native/optitech-mdb-exporter/`, `scripts/build-optitech-reader.sh`, packaging config; new OpticPlus profile | Required schemas, typed export, safe limits, full-year dates, memo handling, and packaged Windows execution pass; OptiTech output remains compatible |
| 3. Discovery/snapshot/export | `src/main.ts`, new focused Electron migration modules, `src/preload.ts`, `src/types/electron.d.ts` | Installed app, folder, ZIP, copied backend, stale frontend links, backups, template, network source, and busy source behave correctly |
| 4. Validation/foundation | `backend/services/migration_service.py`, new `opticplus_migration_service.py`, shared job helpers | Manifest validation, source binding, scoped imports, key closure, reports, and source archive handling work |
| 5. Customer/clinical import | New `opticplus/clients.py`, `clinical.py`, `trace.py`, layouts/card support as needed | Source-linked records, all supported categories, lossless unsupported values, no cross-clinic data, search index and save/reopen verified |
| 6. Orders/finance/supplemental | New `opticplus/orders.py`, `billing.py`, `supplemental.py`, current order-group/catalog/file services | Correct slots and attribution; one billing per header; totals/paid/debt reconcile; no invented payments, negative stock, or double inventory consumption |
| 7. Wizard and history | `MigrationTab.tsx`, extract shared wizard from `SoftOpticMigrationTab.tsx` as warranted, `api-client.ts`, three locale catalogs | OpticPlus selectable; automatic preview/import/recovery; precise unsupported-domain reporting; Hebrew RTL and English/French LTR verified |
| 8. End-to-end and rollout | Backend/frontend/native tests, packaged Windows smoke scenario, release documentation | Full supplied snapshot reconciles in isolated local/staging target; repeat/resume/edit-conflict tests pass; release gates below satisfied |

Do these in order with focused commits. Add tests for behavior and regressions; avoid a broad unrelated rewrite of both existing importers. Frontend controls must use relevant `design.md` conventions when implementation begins.

## Verification and acceptance

### Source and reader checks

- Supplied outer archive, all five nested ZIPs, and both installers are correctly inventoried; the normal path selects the current backend and never the installer template.
- All 31 selected-backend business tables are accounted for. Current fixture reads 39,141 customer, 50,762 glasses, 26,314 contact, and 14,642 order rows; explicitly resolve the glasses metadata discrepancy against Windows ACE before final acceptance.
- All four core keys remain unique and all imported clinical/order rows resolve to the selected patient set.
- Distinguish null, empty, zero, false, and `-1`; verify Hebrew, quoted newlines, long memo fields, date serials, leap days, old/future years, and missing dates. Unsupported encrypted/corrupt files fail clearly.
- Run on a Windows machine without Office/ACE/ODBC installed and on an accessible UNC share; verify safe failure during concurrent source writes and share disconnects.

### Import and finance checks

- Full fixture creates one client per source patient and 77,076 individually traceable clinical source records if independent validation accepts all readable rows. Invalid canonical fields are retained with explicit warnings, not dropped records.
- Account for 14,642 order headers/groups and every substantive source product component; target entry count is determined by verified slot semantics, not assumed to equal either header count or twice that count.
- Preserve every source final total and paid/outstanding balance, including negatives. Reconcile each header within 0.01; explain the 16 source subtotal/discount discrepancies. Split entries never duplicate group billing.
- No manufactured receipt events for this sample; no payment duplication on resume/reimport. Populated receipt fixtures reconcile event totals plus residual opening balances.
- No automatic merging from duplicate national IDs, phones, addresses, surnames, or display numbers. No privileged account creation from clinical attribution.
- Missing appointments/receipts/documents are correctly shown as absent in this transfer. Synthetic populated cases verify supported supplemental domains; unsupported cases are explicitly retained/reported.
- Open/edit/save/reopen representative exams and both order types, including zero/text values, two-slot orders, unresolved prescription links, source-data viewer, billing UI, searches, and imports into a nonempty clinic.

### Recovery and compatibility checks

- Kill the worker/exporter/uploader at each phase and in the middle of a batch; resume without duplicate entities, groups, line items, payments, files, or search-index entries.
- Test duplicate starts, a lost lease, two workers, replayed upload completion, same-bundle new job, changed snapshot of the same dataset, unrelated dataset with matching numeric IDs, and cross-clinic access.
- Preserve edits, client merges, soft-deleted records, manually edited billing/line items, and source snapshots on reimport. Rollback preview excludes unrelated/shared/edited records.
- Existing SoftOptic and OptiTech tests continue to pass; their old bundles, history, resume, archive download, and storage cleanup remain compatible.
- Verify Hebrew RTL and English/French LTR in real wizard and clinical/order flows, including portalled controls and warnings. All new visible strings use stable i18n keys.

## Rollout and remaining release gates

1. Complete independent Windows Access/ACE count/date verification and original-screen semantic checks. These are finite engineering validation tasks before the mapping is frozen, not per-clinic mapping work.
2. Build local fixtures and importer; run the actual supplied snapshot only against an isolated target with no external integrations or outbound reminders enabled. Inspect the configured target without printing credentials before any authorized database writes.
3. Ship backend capability support and required schema changes first, keeping OpticPlus hidden until compatible clients/readers are available. Add any schema changes as Alembic migrations; never mutate schema at startup.
4. Verify packaged Windows client, native reader, API, worker, storage, and clinical card compatibility together. Surface source capabilities from the server so older servers cannot accept unsupported jobs.
5. Run a representative limited pilot, then a complete rehearsal from the same fixed snapshot. Compare counts, report every exception category, and personally verify representative source/target screens.
6. Enable the source for the intended clinic, perform a controlled final snapshot/cutover, import, and reconcile. Keep source archives and reports available for recovery. Do not allow new clinical edits through older clients that cannot preserve any new card types.

Core migration data can fit existing job, trace, client, exam, order-group, billing, and JSON contracts. The preferred initial design adds no new SQL table solely for a source name. Dataset binding and mapping metadata can reside in existing job/trace JSON. Any needed historical payment representation, stock semantics, or unsupported-domain product feature is a separate explicit contract decision before schema expansion. The order-group schema in the current working tree is itself a rollout prerequisite and must be verified on the intended environment.

Migration note: No new SQL schema migration. Deploy the matching API, migration worker, desktop renderer, and rebuilt native reader together. Existing order-group, source-trace, per-instance layout, and storage schemas must already be deployed. OpticPlus uses additive source/job JSON and existing clinical cards; existing source bundles remain compatible. Keep `OPTICPLUS_MIGRATION_ENABLED=0` until the release checks below pass.


## Implementation evidence — 2026-10-26

Implemented `opticplus` as a separate libmdb reader profile and source adapter, with a packaged-reader capability handshake. The Electron path supports Windows discovery, exact installed backend links, transferred ZIPs/folders/databases, duplicate-hash candidate ranking, writer-denying snapshots, typed JSONL/CSV exports, checksums, original-source retention, patient limits, and bounded extraction. Transfer ZIPs remain offline: stale frontend links cannot redirect them to an installed database. Only exporter-owned temporary paths are cleaned.

The importer validates the complete bundle before writes, binds datasets on the server, imports in batches of 250, checks worker ownership, resumes by checkpoint, and retains source baselines. Three-way updates protect edits, merges, deletions, billing/payments/line items, and changed source patient attribution. Cancellation stops after committed writes; pause/resume and a read-only recovery-scope preview are available. The preview follows inbound dependencies and retains edited/shared records; destructive rollback is deliberately not exposed.

Customer and clinical records use existing target models/cards, including source notes and search indexes. Each source order has one group and billing, with one entry per substantive product kind. Zero-priced contact headers retain their contact classification. Original slots, quantities, ancillary fields and uncertain values remain available without inferred eyes, pairs, stock movements or payment dates. Verified supplier/manufacturer/model names populate lookups; full catalog definitions and unknown stock sentinel values remain archived. Supported relative document references import to private clinic storage with immutable content keys and deletion protection. Clinical extras become source-labeled history. Appointments, receipt events, attendance, quotes, supplier finance and stock movements remain archive-only until populated samples and their semantics are validated; this release does not claim operational support for those domains.

The wizard includes capabilities, source preview, coverage, previous-import selection, upload/recovery, warnings, report/archive downloads, and recovery-scope review. English, Hebrew and French keys match. The migration controls and original-slot display were visually checked in Hebrew RTL and English/French LTR using synthetic data. No production application or database was changed.

### Full supplied snapshot rehearsal

Ran the supplied database against a newly created, isolated local SQLite target with foreign keys enabled. Original transfer SHA-256 remained `1a9b613f4f046fe15616e11309d939039a262b0ea94f60e3354f5e97e654eadd`. No configured/shared database or outbound integrations were used.

| Result | Count |
| --- | ---: |
| Customers | 39,141 |
| Clinical records / layout instances | 77,076 each |
| Glasses source records | 50,762 |
| Contact clinical source records | 26,314 |
| Order groups / entries / billings | 14,642 each |
| Glasses orders | 13,389 |
| Contact orders | 1,253 |
| Source component line items | 24,745 |
| Source trace links | 262,139 |
| Prescription search rows | 155,788 |
| Manufactured receipt/payment events | 0 |

Import time was approximately 234 seconds on this machine. Independent per-header comparison of all 14,642 billings found zero total/paid/outstanding mismatches within 0.01. Aggregate source final total was ILS 10,492,984 and paid was ILS 10,383,750. SQLite integrity check passed; foreign-key violations: zero. Checked 218,099 preserved date serial values against the exported date strings: zero representable-date mismatches; four source dates were outside the target datetime representation and remain preserved in the raw export.

Reported exceptions: five invalid customer dates, 7,041 missing/invalid clinical dates, 2,439 unresolved prescription associations, and all 16 known source subtotal/discount discrepancies. These preserve the original record and source values. The cached Access header discrepancy (50,760 versus 50,762 enumerated glasses rows) remains explicitly reported pending independent ACE verification.

Verification: migration, existing-importer, prune, source-data, helper and order-group backend checks passed (83 passed, one skipped). Twelve focused frontend tests passed; 24 passed including existing card and order-group regressions. Web production build passed. The native profile compiled and ran locally against the real source; Windows release workflows now require its capability handshake. Repository-wide TypeScript checking still fails on existing errors; no diagnostics referenced the new OpticPlus modules in the recorded check.

### Remaining release gates

- Build and execute the packaged Windows reader without Office/ACE/ODBC, including Unicode paths, UNC shares, concurrent writers and disconnects.
- Independently verify counts/date serials through Windows ACE; verify customer name order and uncertain clinical/product semantics against original OpticPlus screens.
- Verify representative clinical/order edit-save-reopen and a nonempty-clinic pilot with the matching deployed backend/worker/client and private storage.
- Obtain populated source fixtures before enabling operational appointment, receipt, attendance or stock-movement mappings. Their current disposition is archive-only, not inferred import.
- Enable `OPTICPLUS_MIGRATION_ENABLED=1` only after those checks pass for the intended rollout. Do not run a production import as part of this implementation task.

## Mapping v2 completion — 2026-11-02

Mapping version 2 accepts existing format-2/version-1 bundles. Deploy compatible card renderers before enabling the v2 worker. Production remains capability-gated; independent Windows/ACE validation and packaged Windows execution remain release prerequisites.

- Added seven OpticPlus-only clinical cards, hidden from layout building. Unsupported prescription values, fitting details, measurements, ocular health, binocular tests, questionnaires and legacy profile values retain separate source identities. Fields stored but not rendered by a standard card (including final-prescription acuity and fitting height) use live bindings into that card.
- Actual notes replace generated row dumps. Supplemental records attach to one unambiguous dated prescription, otherwise share a dated assessment. Undated rows remain separate. Existing placement is retained across reimports. Unmodified v1 technical history is soft-retired after replacement; user changes and original evidence remain protected.
- Explicit client IDs are supported through the native reader, export UI and server selection checks. Source-link lookup uses the existing composite index; no schema change is needed.
- Order product descriptions and supplier names are mapped independently from prescriptions. Source slots, quantities, discounts and extras remain distinct. Technical flags stay in the source dialog. Order extras have stable billing lines. Shared quantities are never copied into each eye, and missing prescription dates never select an arbitrary exam.
- Approved reference rows are searchable and paginated within the bound clinic/dataset. Supplier/lookup reuse retains every source row. Valid frames become catalog products/variants without inventory movements or invented stock. Source-owned price updates protect manual edits. Glasses lenses remain a reference price list; no catalog category was added.
- Every column has a coverage disposition and populated-row count. Empty domains are reported explicitly. Passwords/secrets remain excluded from structured exports and reference views.

Local validation tooling:

- `backend/scripts/opticplus_rehearsal.py --bundle DIR --output NEW_PRIVATE_DIR [--repeat]` creates a fresh, isolated SQLite database. It never uses the configured clinic database. It reconciles counts and finances, checks invalid exam cards and optionally verifies retry cardinality.
- `backend/scripts/opticplus_repair_pilot.py` defaults to a read-only preview. Applying requires an exact database username, clinic/company/name, completed previous import and selected-client bundle. It saves a private recovery snapshot, preserves the dataset binding and skips clinic-wide reference/catalog imports.
- `backend/migration/opticplus/comparison.py` produces private, field-level source/target comparisons for the selected pilot. Do not commit its patient-level output.

The latest transferred snapshot enumerates 39,145 clients, 50,772 glasses records, 26,319 contact records and 14,647 orders. Isolated reconciliation confirms 10,496,776 total, 10,387,100 accumulated paid and 109,676 outstanding, with no manufactured payment events. Legacy profile assessments are explicitly identified as history, not newly dated encounters. Existing invalid dates, ambiguous prescription associations and 16 source discount inconsistencies remain reportable exceptions rather than inferred corrections.

Migration note: Existing OpticPlus imports require the versioned, baseline-protected data repair. No Alembic/schema migration, production rollout or automatic full shared-clinic import is included.

### Concurrent checkout prerequisite

During final verification, separate company-ownership work added required `company_id` columns to client activity models (`0049_company_client_records`). These columns were absent from the named staging database at the time of the check. OpticPlus writes now supply company ownership when the mapped model requires it; the guarded repair CLI detects a model/schema mismatch before record writes. This OpticPlus pass does not authorize or apply that separate shared-database migration. Browser verification and any further repair from this checkout require its schema and configured database to agree.

### Verification evidence and remaining acceptance

The named clinic 65 pilot was repaired through its existing dataset binding. Its two orders retain 340 + 102, paid 0 and outstanding 442. A real assessment edit/save/reopen and reimport preserved the edit; the test edit was restored afterward. A fresh read-only source comparison accounts for all 413 populated pilot fields: 328 matched destinations, 84 technical provenance fields and one legacy number retained in source evidence. There are no missing or mismatched values. Displaying that legacy number in the profile card is implemented but awaits the final pilot repair.

The current-checkout isolated full rehearsal passed with 39,145 clients, 116,237 exams/history assessments and 14,647 orders. Financial totals match the snapshot; no payment events were created. Targeted migration/source/order-group tests passed (80 passed, one skipped), and the canonical full check passed (80 CI backend tests, 76 frontend test files / 525 tests, web build). Total-only legacy billing lines preserve their stored amounts during metadata saves, ignore caller-supplied replacement totals, and do not display invented unit-price arithmetic. Signed source components remain signed when summing edited bills.

Private evidence is stored outside Git in `Downloads/clinic-transfer/opticplus-v2-verification-2026-11-02`: field comparison, column coverage, full rehearsal summary/database, screenshots and an explicit verification-status report. The isolated SQLite file is not the configured application database.

Personally checked the real pilot in Hebrew: client data, readable medical history, grouped assessment, contact prescription, glasses prescription before final live bindings, both order-list entries and the initial glasses order. Verified migration card fixtures in English and French in the development gallery. Final live-binding checks, both polished order details, billing/source dialogs, exam switching and complete client flows in English/French remain unaccepted because of the schema prerequisite above. No production or full shared-clinic import was performed. Independent ACE and packaged Windows verification remain rollout gates.

### Deeper card-reuse and presentation audit — 2026-11-02

This is a read-only follow-up audit, not a second repair. Reopened the actual pilot assessment and glasses exam in Chrome, inspected existing card renderers and field definitions, checked the original recorded OpticPlus screen, and profiled the full transferred snapshot. Source/clinic data were not changed. The first v2 pass preserves values but uses custom cards for several values that already have useful standard destinations. Its field reconciliation is not evidence that every historical value is visibly rendered or clinically classified correctly.

| Source | Existing destination | Required handling |
| --- | --- | --- |
| `checks.ncrbadd/nclbadd`, `ncriadd/ncliadd`, `ncrmadd/nclmadd` | Addition `r/l_bif`, `r/l_int`, `r/l_mul` | Direct semantic matches. There are 4,160 source exams with at least one of these values. Three populated cells are outside the current 0–5 input range; preserve exceptions without clamping. Do not duplicate the main prescription ADD into an independently editable READ field. |
| `checks.crnvisus/clnvisus` | Addition `r/l_j` | Near-VA text can use the existing imported-value-capable selector. Preserve literal `J/5`, `J/6` and unusual text; no scale conversion based on the column name. Addition/near-VA candidates occur on 9,472 glasses records in total. |
| `adchecks.cnror/cnlor`, `cnrorv/cnlorv` | Over-refraction `r/l_sph`, `r/l_va` | 2,144 source records have at least one candidate. Numeric power and compatible VA can reuse this card after checking source semantics. Of 4,013 populated nominal power cells, 399 contain Snellen-like strings, so numeric shape alone is not a complete historical mapping contract. Retain nonmatching values visibly. |
| `tb_comp.tbr/tbl` | Schirmer/BUT `r_but/l_but` | Existing bilateral BUT fields and seconds are available. Use a BUT-only presentation without implying recorded Schirmer measurements. |
| `tb_gnrl_tests.tst54` | Ocular motor assessment `ocular_motility` | Direct text field; no need to keep a second editable copy in the binocular custom card. |
| `tb_quest.remk9/remk10/remk11` | Anamnesis `medications/family_history/additional_notes` | Matching text sections already exist. Preserve question/option flags independently and bind any questionnaire presentation to the same underlying text. |
| `checks.crpvisus/clpvisus` | Uncorrected VA `r_fv/l_fv` | Reuse for supported explicit VA forms. Pilot strings `6/6/9` and `6/6/12` must not be silently shortened. Bare/dotted formats need verified source notation and source-aware display support. |
| Profile keratometry in `cust_list` | Keratometer/contact-lens keratometer | Existing H/V/average and mm/D presentations are relevant. The recorded source screen shows H/V, D and average, but exact ownership of all persisted `nrdd*`, `nldd*`, `nrop/nlop` fields still needs verification. Keep profile provenance/undated placement; do not infer a dated exam or recalculate source values. |

The full source contains 27,318 bare numeric primary VA cells in glasses records and 3,626 in contact records. Common examples include `6.7` and `1.6`; their meaning cannot be taken from Prysm's SoftOptic bare-denominator normalization. Signed modifiers without a count, such as `6/7.5-`, are also present and currently remain in fallback cards. `checks.ctvisus` has 11,668 populated values, and `checks.cnvisus` frequently contains near-VA-shaped text, while the pilot `adchecks.cnvisus` contains contact remarks. Table-specific semantics and labels need verification before treating similarly named columns alike.

Existing cards that look related but are not direct field matches:

- Cover Test v2 requires correction mode, orientation, direction and prism; OpticPlus `tst35/tst36` supply distance/near text without those dimensions. Reuse the visual component with an explicitly unspecified source-result mode, or keep a compact imported cover-test block. Do not populate CC or horizontal by default.
- Addition has separate right/left numeric FCC fields, whereas `tst47` is one text result. Do not copy it into both eyes. A single-result FCC presentation can share standard card primitives.
- Fusion Range separates break/recovery by distance and base. `tst38..41` are four source text cells with no verified break/recovery split. A BO/BI × 6 m/40 cm grid can preserve these without assigning them to break fields.
- General stereopsis is not a verified fly or circle score. MEM's single text result is not a bilateral sphere/cylinder/axis retinoscopy record. Worth 4 dot is not automatically an R/G status. These remain named imported results until the necessary test/scale details exist.
- The existing diameters card has one pupil and one corneal diameter. It cannot represent bilateral light/dark pupil measurements and bilateral corneal diameters by choosing an eye or averaging.

Confirmed visibility defect: `exam_payload` consumes valid old-contact additions into `old-contact-lenses.r/l_read_ad`, but the renderer has no such controls. Four populated values across three source records are therefore stored but not visibly rendered in either card. Fix the visible-field contract for every source category before another full import.

The current custom UI is a generic two-column label/value list. Medium-severity presentation findings: bilateral fields are separate rows; a tall ocular-health card creates large empty areas beside shorter cards; questionnaire flags/remarks are separated into long lists; technical table/row identifiers dominate subtitles; single-line inputs hide long clinical text. View mode was inspected; hover/focus/edit interactions were not reverified in this research pass.

Recommended custom presentation:

- Ocular health: one finding per row with right/left columns, grouped into posterior and anterior sections. Keep uncertain labels literal and explained.
- Measurements: right/left columns for light pupil, dark pupil and corneal diameter; reuse the standard BUT card for tear film values.
- Binocular/accommodation: separate compact cover-test, vergence, accommodation and sensory-test blocks. Do not manufacture missing dimensions merely to fill a native card.
- Contact fitting: paired right/left specifications with lens company/type/power; standard over-refraction remains separate.
- Questionnaire: one row per question with its answer state and remark together. Keep yes/no flags independent, explicitly distinguish neither-selected from both-selected, and group multi-select options. Unselected is not an inferred negative diagnosis.
- Real notes use normal notes/anamnesis cards; examiner/reason are readable contextual metadata. Show technical provenance behind the existing source viewer. Unknown source fields stay in a distinct explained section.

Implementation follow-up must move only verified fields, carry current edits from the old custom value into the new canonical destination using the old baseline, detect destination conflicts, and retire only successfully replaced unedited displays. Standard and imported displays must never become independent editable copies. No schema change is needed for this presentation/mapping work; existing imports require a versioned repair after compatibility tests and pilot acceptance.


### Verification follow-up — 2026-11-03

- Applied the explicitly approved `0049_company_client_records` to staging; verified the Alembic revision, all nine non-null activity ownership columns and an empty ownership-issues report. No production migration was performed.
- Repaired only source client 49822, company 28 / clinic 65 / Prysm client 10266687. Both bills remain 340 + 102, paid 0. No full shared-clinic import was run.
- Removed clinic attribution from the exam and order breadcrumb headers; attribution in history lists remains available.
- Personally checked the repaired glasses layout in Hebrew, including additions, original acuity notation, actual notes, and source examiner/reason. Tested native/custom editing; final browser acceptance remains incomplete.
- Comparison now prioritizes source-bound layout instances over unrelated user-added empty copies of standard cards. Native Addition and custom height edits (through its standard prescription binding) survived reimport; both test edits were restored to their original source values.
- The local app subsequently stopped; canonical restart is blocked by the external Agents24 clinic-tools registration being stale/not ready. Do not bypass that prerequisite or publish integration changes as part of migration verification. Contact exam, grouped assessment, orders, locale switching and complete save/reopen acceptance still need live verification after the app is restored.

Migration note: OpticPlus remains transport 2 / mapping 2 with clinical repair revision 3; existing imports require the guarded versioned repair. The independently approved staging ownership schema migration is now applied. Production rollout and full-clinic import remain gated.

Final database reconciliation: 329 displayed matches + 84 technical-provenance fields = 413 populated pilot fields; no missing values or mismatches after restoring test edits. Both bills remain 340 and 102, paid 0; no duplicate OpticPlus source links were found. The isolated full-data layout rehearsal previously checked 116,237 layouts without duplicate IDs, overlaps or out-of-bounds placement.


### Live screenshot review — 2026-11-03

App restored through DevDesk and inspected as the user-authorized password-protected account. Captured all four migrated exams and both order workspaces, including lower scroll positions, bill panels and assessment source viewer, under `Downloads/clinic-transfer/opticplus-ui-review-2026-11-03/index.html`. Glasses dominant eye is R; contact dominant eye is L. No order-details card appears in either prescription exam. Medical history displays only the source remark 203; raw questionnaires remain in source data. Bills show 340 + 102, paid 0.

The medical tab initially crashed during loading because its missing-data fallback recreated an empty array, retriggering the records synchronization effect indefinitely. A stable empty fallback fixes it; a pending-to-loaded component regression and live retry both pass. Latest full checks: 80 backend tests, 553 frontend tests and web build passed.

UI is not fully polished: prescription/history card heights leave substantial blank space; unresolved profile labels remain source identifiers; a source decimal appears as 8.199999999999999; order reference sections are long and standard controls can be empty while the source section contains product details. Retain these as follow-up findings, not evidence of missing source rows. English/French live routes are intentionally disabled by `localeRoutingEnabled = false`; do not broaden the bilingual rollout for verification. Existing scoped gallery locale checks remain separate from live client-route acceptance.

Migration note: the medical loading fix changes no persisted/API shape and needs no data migration. Prior guarded OpticPlus data repair remains required for older imports. No production rollout or full shared-clinic import was performed.


### UI polish — 2026-11-03

OpticPlus order products now appear first as separate responsive cards. Specifications, shared quantities and independent eye selections stay visible; original prices/discounts, context and extras use expandable sections. No eye/pair allocation or financial calculation changed. Clinical cards use clearer section dividers and compact questionnaire rows. Source examiner/reason remain in compact context previews; other context and unverified fields expand for reading and open while editing. Legacy profile fields are grouped into context, actual history and an explicitly unverified source section. Numeric display removes binary-decimal noise while preserving raw text in editing, tooltips and source evidence. Imported exam notes no longer stretch to the tallest neighbour; ordinary exam layouts retain their prior behavior. No persisted layout was reordered.

Verified on the running pilot: order product cards/price expansion, compact history/original-field expansion (8.2 displayed), assessment questionnaire and contact fitting/notes. Focused tests and web build pass. The full check ran 80 backend tests successfully but found an unrelated agent composer test failure (`apiClient.agentFetch` absent); do not claim a clean full suite. Screenshots are in `Downloads/clinic-transfer/opticplus-ui-polished-2026-11-03`.

Migration note: Not needed; presentation only, with original data, bindings and persisted layouts unchanged. No remigration or schema mutation is required.

Post-polish verification: 35 focused frontend tests and a separate web build passed after the final edits. Visually verified the actual Hebrew pilot and scoped synthetic English/French gallery; live LTR routes remain disabled by the existing rollout. No source/billing values were edited during this UI pass. The remaining gaps in saved lane placement were reduced through compact card disclosures rather than rewriting user layout data.


### Dense exam packing and RTL inputs — 2026-11-03

OpticPlus exam layouts now use an opt-in measured dense grid: each card reserves its own content height, shorter cards fill available column gaps, and disclosure/width changes are observed. Saved x/y/width data is not rewritten; ordinary exams retain fixed rows and explicit empty lanes. Packing renders all imported cards so lazy row placeholders cannot create gaps. Input controls use the active RTL direction for text, with right alignment in Hebrew; numeric strings keep LTR digit order and align right.

Validation: 37 focused tests pass, including measured-height updates preserving edited inputs, ordinary-layout lane preservation, and alignment in all three locales. Live visual acceptance and the web build are blocked by the concurrent Agents24 integration importing `getAgentChatActivity` from a package that does not export it; the running client route is blank with that same error. Full repository validation also reports unrelated agent test failures. Do not mark screenshot acceptance complete until the integration mismatch is resolved.

Migration note: Not needed; packing and input alignment are presentation-only. Persisted layouts, source values and bindings are unchanged.


### Deliberate OpticPlus card rows — 2026-11-05

Replaced the OpticPlus-only dense packing with coherent display rows: prescription/additions together, fitting/over-refraction together, compact assessment measurements/history above the three clinical panels, and actual notes together at the bottom. All card instances, including repeated and unfamiliar cards, remain present; saved layouts and clinical values are not rewritten. Custom cards use a bounded label column, shorter controls, tighter section spacing, compact questionnaire options, and inline examiner/reason summaries. Imported anamnesis uses three fields across; BUT imports omit the native between-eye spacer. Text inputs follow Hebrew RTL or English/French LTR while numeric notation remains LTR.

Validation: canonical scoped fast checks passed 115 tests across 15 files, including arrangement/duplicate-instance preservation, all three input directions, and existing migration/native-card regressions. The web build passed (14.87 s). Verified the live Hebrew assessment and imported glasses/contact layouts; English/French synthetic gallery checks also retained an edited field across locale changes. Final recapture/history inspection is blocked after an independent DevDesk restart: authenticated client reads raise `UndefinedColumn: clients.send_notifications does not exist`. The separate pending ownership/notification work was left unchanged; no shared schema mutation was performed for this UI task. Evidence: `Downloads/clinic-transfer/opticplus-layout-polish-2026-11-05`.

Migration note: Not needed; presentation only. No source values, saved layouts or schema changed, and no remigration is required.


### Sidebar-aware exam reflow — 2026-11-05

OpticPlus display rows now use the measured content width of the exam pane. A ResizeObserver responds to client-panel resizing, main navigation collapse, and window resizing; assessment panels reduce from three columns to two or one, native prescription rows stack sooner, and measurements/notes reflow without squeezing bilateral fields. Wide layouts restore on expansion. Card IDs and saved geometry remain unchanged; resized cards retain unsaved input. Ordinary layouts retain their saved coordinates.

Validation: 8 scoped tests pass, including pane-only ResizeObserver updates preserving an unsaved field, repeated source instances, narrow/wide packing and restored geometry. Web build passed (9.17 s); diff whitespace check passed. Personally verified the actual Hebrew pilot with the client panel open/closed, keyboard panel resizing, main navigation collapse/expansion, and a temporary 1360 px viewport: clinical panels remained readable in three, two and one columns. Restored the default viewport and navigation. Screenshots: `Downloads/clinic-transfer/opticplus-responsive-2026-11-05`. No clinical fields were edited.

Migration note: Not needed; responsive presentation only, with no schema, persisted layout or source-data changes.


### Imported profile history is client reference data — 2026-11-05

The client details toolbar now has a compact click-to-open Imported history text popover beside Source Data and Edit Details. The scoped API derives OpticPlus profile values from retained client source rows and overlays existing saved legacy-history card values, preserving edits, zero/false values and unresolved original labels. Ordinary clients have no button. History backing records remain intact for recovery; reserved `opticplus.exam.history` entries are excluded from global/client exam lists, exam exports using the shared list query, first/last exam dates and latest-exam selection. Real glasses/contact exams and grouped clinical assessments remain visible. The ongoing import can continue producing backing records; the same projection handles them after deployment without reimporting or cleanup.

Validation: 74 focused backend tests passed; 30 frontend tests passed, including Hebrew/English/French popover semantics, client details regressions and migration labels. The initial API-client-related check passed 614 tests and found two outdated client-details mocks; updating those mocks and rerunning the affected files passed. Web build passed (10.05 s). Personally verified the existing Hebrew pilot popover and exactly three remaining exam rows (assessment, contact and glasses). Screenshots: `Downloads/clinic-transfer/opticplus-profile-history-2026-11-05`. No production data was changed by this fix.

Migration note: No schema migration, repair script or remigration is needed. Deploy backend and frontend together (backend first); existing source/history records automatically appear through the new client reference view. No clinical records are deleted.


### Imported order-item alignment and collapse — 2026-11-05

Imported product values now explicitly align right in Hebrew and left in English/French, while retaining automatic text direction for numbers and model codes. Each source slot uses the existing collapsible OrderSection, matching fulfillment/delivery controls and retaining its values while closed. Cards start expanded and collapse independently. Scoped checks passed 38 tests, including locale alignment and collapse/reopen behavior with zero and false source values. Live browser visual verification was unavailable in this session.

Migration note: Not needed; presentation only, with unchanged migration data and no remigration required.
