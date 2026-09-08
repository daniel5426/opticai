# OptiTech clinical migration v3

This change keeps the standard exam fields and adds five migration-only cards: examination details, prescription details, contact measurements, accommodation, and binocular findings. Cards support the existing exam edit/save flow and Hebrew, English, and French. They are excluded from the general layout editor.

## Coverage

- The native and PowerShell exporters retain every actual column in the approved clinical tables, including newer columns absent from the older reference database. Patient selection still scopes their rows.
- Glasses and contact exams expose supplemental values instead of leaving them only in the source modal. Existing hidden VA, height, and IOP values use bindings to their canonical fields.
- Prism direction uses the exported `tblBases` lookup. Unknown codes stay visible and unresolved; the importer does not substitute a lookup from another database.
- Contact keratometry remains in source representation, without guessing units or calculating a cylinder from uncertain units.
- Prior refractions retain all substantive slots, source fields, and full previous rows in trace; the five-tab import cap is removed.
- `tblCrdDisDiags`, `tblCrdOverViews`, `tblCrdOrthoks`, `tblCrdGlassChecksGlasses`, `tblCrdGlassChecksFrm`, and `tblCrdFrps` create separate dated source-linked clinical exams. This preserves distinct record histories without assuming that matching dates identify the same exam.
- `clinical_coverage.json` reports nonempty exported fields and absent tables. It describes export coverage, not proof that every source database column was exported or every row imported; inspect skipped-row and unresolved-dependency reports too.

Unknown clinical fields retain their source column names. No guessed clinical interpretation is assigned. Source attachment references are retained as values; this change does not implement a new binary attachment importer or expand financial/catalog migration semantics.

## Existing jobs and rollout

No SQL schema change is required. The new shape is additive exam JSON and source trace metadata; mapping version is 3. Deploy compatible app clients before importing or repairing v3 data. Older clients do not know the five new component types and can discard unknown cards when saving. Do not allow older clients to edit repaired exams.

Every new OptiTech v3 export also stores the complete original database as `source/optData.xns` inside the bundle. The manifest records its byte size and SHA-256 checksum, and the import service verifies both before importing. This source archive is included even when document migration is disabled and even when the migration uses a patient limit; the limit applies only to the active imported CSV rows.

Successful OptiTech imports retain the uploaded bundle in private clinic-scoped storage. Authorized clinic users can obtain a 15-minute signed download from the migration history. The retained bundle is removed only through the existing clinic-data deletion workflow. This permits a later mapper to recover a newly supported table from the original database without returning to the source Windows PC.

Build and package the native reader (`npm run build:optitech-reader`) for each supported release target. The macOS native reader was compiled and checked against a local Access database; Windows packaging and PowerShell execution need verification on Windows.

Existing v2 source links are not blindly overwritten by a new import. Existing completed phase checkpoints are not automatically reset. Use the scoped repair for existing exams, and explicitly run the clinical-exams domain with the fresh bundle for missing clinical records. A fresh export must come from the same source database/clinic, not just another database with matching patient numbers.

Bundles created before source-archive support contain only their exported CSV files and cannot recover omitted tables. Their manifest remains import-compatible, but the migration history will not offer a source-archive download for them.

## Repair preview

Run from `backend` with the intended environment configured. The command prints only connection backend, host, database, and username. Preview uses a read-only PostgreSQL transaction and rolls back:

```sh
.venv/bin/python scripts/repair_optitech_exams.py --job-id JOB_ID --source-per-id 22747 --report /tmp/optitech-preview.json
```

Optionally add `--extracts-dir /path/to/fresh-export/tables`. Duplicate patient/date keys are rejected rather than choosing an arbitrary row. First verify that the fresh source belongs to the original job. A preview without source lookups can expose retained fields but cannot correct unresolved prism directions.

The repair uses the stored importer baseline, current exam JSON, and corrected mapping. User changes/deletions win and appear as conflicts. It handles saved instance-specific aliases, preserves repeated cards, appends recovered cards without moving existing ones, and rebuilds the prescription search index when applied. It never creates missing exams or deletes old cards. In particular, retained legacy keratometry is flagged for review rather than silently deleted. Raw original snapshots remain unchanged.

After reviewing the report, explicitly apply to the established target by adding `--apply --target-host EXACT_CONFIGURED_HOST`. Applying a fresh export additionally requires `--confirmed-source-job-id JOB_ID`, an operator assertion that the export belongs to that source job; this is not automatic source identity verification. Keep the original bundle and a database backup before an authorized apply.

No deployment, shared database mutation, or repair apply was performed during implementation. A read-only preview against the sample staging job reviewed its two sample exams with no edit conflicts; missing prism lookup codes and retained legacy keratometry were reported.

## Validation

- 60 backend OptiTech tests passed, including source scoping, distinct dates, immutable raw snapshots, repeat imports, repair conflicts, saved aliases, and user-removed cards.
- Seven frontend tests passed, covering three locales, bound edits, repeated cards, and registry save/load.
- Production web build passed. Repository-wide TypeScript checking still reports existing errors outside the changed OptiTech implementation; it is not globally clean.
- Real component previews checked Hebrew RTL, English/French LTR, saved/reopened values, and mobile overflow. These were local previews; no clinical edits were saved to staging.
- Native exporter compiled and ran against the older local Access database with two-patient selection; clinical headers, additional PD column, base lookup, and child-row scoping passed.
