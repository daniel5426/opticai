# OpticSoft CSV Extraction Research

## Current Findings

- OpticSoft uses Sybase/SQL Anywhere, specifically Adaptive Server Anywhere 8.
- The live installed app is under `C:\Program Files (x86)\RRProg\MSoft\Optic.exe`.
- The live data directory is `C:\RR\Data`.
- The live 32-bit ODBC DSN is `RRDB`.
- The DSN points to `c:\RR\Data\RRDB.db`.
- The DSN credentials are `UID=dba;PWD=sql`.
- The useful business tables are owned by `creator`.
- The old successful export in `C:\Users\daniel benassayag\Downloads\opticai_db\Sybase Central 4.1\csv_files_new2` is UTF-8 CSV with headers.
- The old helper scripts in that folder did not perform the DB extraction. They only reformatted table/column metadata and added headers after export.

## Verified Reference Client

The live database was queried on 2026-06-15 after the test client was created.

- `creator.account` contains 5 rows.
- The newest account row is `code=6`, `account_code=3`, `account_type=CUST`.
- The row has `acc_name=last name שם`, `first_name=שם`, `last_name=last name`.
- `last_action=2026-06-15 15:19:17.371`.
- The generated CSV export includes that row in `account.csv`.

## Verified Large Copied DB

The copied database at:

`C:\Users\daniel benassayag\Downloads\old_db\back\RRDB.db`

was tested with a read-only count query using SQL Anywhere 8 tooling.

- `creator.account` contains 22,759 rows.
- This confirms copied `.db` files can be opened directly with `UID=dba;PWD=sql`.

## Exporter

The repeatable exporter is:

`C:\Users\daniel benassayag\Documents\db migration\tools\export_opticsoft_csv.ps1`

It:

- Locates `dbisql.exe` from the DSN driver path or common OpticSoft install paths.
- Connects through DSN `RRDB` or directly to a supplied `.db` file.
- Reads the table list and column list from SQL Anywhere system catalogs.
- Exports every `creator` base table.
- Converts SQL Anywhere output from Hebrew codepage 1255 to UTF-8.
- Adds CSV headers.
- Writes a `manifest.json` with exported table/file metadata.

## Recommended Client-Store Flow

Fast path when OpticSoft is installed and working:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\path\to\tools\export_opticsoft_csv.ps1" -OutputDir "C:\opticsoft_export"
```

Fallback when you only copied database files:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\path\to\tools\export_opticsoft_csv.ps1" -DbFile "C:\copied\Data\RRDB.db" -OutputDir "C:\opticsoft_export"
```

Expected result:

- One UTF-8 CSV per OpticSoft business table.
- `account.csv` is the main client table.
- Optical clinical/order data is mainly in `optic_eye_tests.csv`, `optic_glasses_presc.csv`, `optic_contact_presc.csv`, `optic_contact_lens_chk.csv`, `optic_reference.csv`, `optic_presc_prices.csv`, and related lookup tables.

## Notes

- Do not use SQLite tooling for the original `.db` files. The `RRDB.db` files are SQL Anywhere databases.
- Prefer DSN export on a live client machine because it uses the installed SQL Anywhere engine and current database path.
- If exporting from copied files, copy both `RRDB.db` and `rrdb.log` together from the client machine.
- The exporter currently exports tables, not external scanned documents under `C:\RR\Document`. Those can be handled later if the migration needs file attachments.
