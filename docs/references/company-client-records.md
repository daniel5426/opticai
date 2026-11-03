# Company clients and clinic activity

Clients and families belong to the company. Their existing `clinic_id` is the registration clinic; it is not an access restriction. Clinical activity, orders, files, appointments, and follow-up tasks have explicit company ownership and retain their originating clinic. Dependent rows inherit ownership through their parent. Existing role restrictions remain in effect; clinic settings, inventory administration, credentials, and staff management retain their own policies.

Directories default to the current clinic. A clinic's clients include registrations and clients with live activity there. All clients searches the authenticated company. Profiles show all history by default, with a separate clinic filter. Creating a record uses the app's current clinic; editing does not move its origin. Historical attribution uses a public clinic/staff directory without exposing settings or credentials. Shared appointment updates use the assigned owner's calendar, never the editing staff member's calendar as fallback. Stock availability for an originating clinic can be read through a matching authorized order (`order_id` and `order_kind`); inventory administration keeps its original clinic policy.

Manual merges preserve each activity's clinic, payer relationships, historical IDs, and protected order groups. Existing links resolve through the merged identity. Prepared agent changes for merged identities expire and must be prepared again. Duplicate detection and automatic merging are not part of this rollout.

Client deletion covers all clinics. Mixed-client invoice handling retains the existing group-aware transaction safeguards. Clinic cleanup preserves company client/family identities and profile pictures and removes only its own activity. Company-wide Trash envelopes remain accessible wherever their member history occurred.

## Migration and rollout

Migration note: Required; `0049_company_client_records` adds and backfills ownership, checks existing records including Trash, and enforces company/clinic/client/family consistency. It preserves identifiers, clinic attribution, storage paths, and import provenance. Legacy writers are supported by a migration-owned insert trigger while application and workers roll forward. There is no startup-time schema mutation.

Before applying schema changes, run the read-only preflight against the explicitly established target:

```sh
backend/.venv/bin/python backend/scripts/check_company_client_records.py
```

It prints only the backend, host, database, username, and conflicting record IDs/counts. It never prints the connection string or credentials. Resolve reported ownership conflicts explicitly; neither the preflight nor migration guesses a new clinic or merges people. The migration repeats validation transactionally and rolls back on conflicts.

Validate on staging first using the release contract in `CI.md`. Production migration requires exact-target authority and a genuine backup. Migrations must finish before code that selects the new columns becomes active. Deploy the API and every writer/worker together; clear client caches by loading the new web build. Older desktop callers retain the existing API routes, identifiers, and optional clinic parameters.

After cross-clinic records exist, rolling back to clinic-only application code is unsafe. Use a compatible forward repair or an explicitly verified compatible application revision; do not destructively downgrade ownership. No shared database migration or deployment is implied by authoring this change.

## Verification

- Canonical checks: `node scripts/devdesk-check.mjs --fast` and `--full`.
- Focused backend cases: `test_company_client_records.py`, `test_company_record_migration.py`, `test_order_groups.py`, and `test_trash_service.py` under `backend/tests`.
- Migration tests create and stop their own disposable PostgreSQL cluster when local binaries are available. They never use the application's configured database.
- Frontend filter/cache cases: `src/tests/unit/company-clients.test.tsx`; verify Hebrew RTL and English/French LTR against the running web app with synthetic data.
