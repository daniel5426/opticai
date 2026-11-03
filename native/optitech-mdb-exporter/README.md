# Prysm OptiTech MDB exporter

This helper uses the LGPL-licensed `libmdb` API from MDB Tools 1.0.1 directly.
It deliberately does not contain or invoke the GPL `mdb-export` utility.

The Windows build script dynamically links `libmdb-3.dll` and includes the
corresponding LGPL notices and source/build information in the Electron package.

The default profile remains OptiTech. `--profiles` reports packaged capabilities.
Use `--profile opticplus --probe --db FILE` for read-only backend/link detection,
or `--profile opticplus --db FILE --output DIR [--client-limit N]` for typed
JSONL, CSV, and schema inventory. OpticPlus requires bundle format 2/mapping 1.
The desktop wrapper acquires the consistent source snapshot and builds the bundle;
the reader never executes Access macros, saved queries, or the legacy program.

Build and verify the Windows package before enabling `OPTICPLUS_MIGRATION_ENABLED`.
Local libmdb rehearsals do not establish independent ACE count/date correctness or
Windows/UNC writer-lock behavior.
