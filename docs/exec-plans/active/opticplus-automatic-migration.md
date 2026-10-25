# OpticPlus automatic migration implementation plan

Last Updated: 2026-10-23

Status: Research complete; implementation not started.

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

Migration note: Not needed for this planning change; only documentation and aggregate audit evidence were added. The future implementation must preserve existing migration API/storage/job contracts, require any necessary Alembic migrations to be deployed before use, and gate newly introduced exam card shapes on compatible clients.
