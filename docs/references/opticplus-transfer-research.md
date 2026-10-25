# OpticPlus transfer research

Last Updated: 2026-10-23

## Conclusion

The supplied transfer is **OpticPlus (אופטיק פלוס)**, a Microsoft Access application with a shared data file and separate workstation frontends. A dedicated `opticplus` migration adapter is feasible. The existing libmdb dependency reads the supplied ACE12 databases without Access, an ODBC DSN, or the original application running.

This is a new application mapping, even though its storage engine overlaps with OptiTech. Reusing OptiTech's table names, clinical mapping, order classifier, or financial assumptions would be incorrect.

Implementation plan: [OpticPlus automatic migration](../exec-plans/active/opticplus-automatic-migration.md). Full file inventory, database schemas, table counts, field population statistics, and comparisons: [sanitized audit JSON](../generated/opticplus-transfer-audit.json).

## Material examined and method

- Source: `/Users/danielbenassaya/Downloads/clinic-transfer/zipped.zip`, 120,588,107 bytes.
- Source SHA-256: `1a9b613f4f046fe15616e11309d939039a262b0ea94f60e3354f5e97e654eadd`.
- The outer archive has 70 entries: 64 files and six directory entries. Five nested ZIPs contribute five more files. Both MSI installers contain CAB payloads, contributing nine additional file instances, including four additional Access files.
- Inspected all **27 Access file instances**: formats, user table schemas, actual row enumeration, table-header counts, query counts, and linked-table targets. This covers **712 user-table instances**. Password-table values were deliberately excluded; their schema and row count were inventoried.
- Profiled every non-password user table in the selected data database, including empty tables, Hebrew text integrity, null/populated fields, key uniqueness, dates, relationships, and financial identities. Inspected frontend configuration, reference lists, calendar/financial scratch tables, and exported all 978 saved-query definitions in the representative current workstation frontend.
- Read the Hebrew installation document and both installer configuration files. Identified and hashed EXE/DLL/font/type-library files; extracted installer payloads as data. No supplied program, installer, VBA, macro, or saved query was executed.
- Extraction tools: Python ZIP/CSV readers, MDB Tools 1.0.1, macOS textutil, olefile, and libarchive. A direct call to the **libmdb 1.0.1 API** reproduced the four core table enumeration counts. This confirms library compatibility, but is not validation against an independent Access engine.
- Source archive remained unchanged. Research copies and parsed patient data stayed in a private temporary directory; the repository artifacts contain schemas and aggregate findings only.

## Installation structure

| Material | Finding | Migration treatment |
| --- | --- | --- |
| `OpticPlus_Data/optic_dt.accdb` | Current shared data candidate, 52,170,752 bytes; business activity reaches 2026-10-22 | Select for this transfer using links, schema, and activity evidence |
| Dated `optic_dt*.accdb` and two nested data ZIPs | Older snapshots with overlapping, changing records | Inventory and compare; never silently union with current data |
| `optic_dtn.accdb` | Empty clinical/customer template | Exclude as a live-source candidate |
| Seven current workstation `optic.accdr` files | Each links 31 business tables to `C:\OpticPlus_Data\optic_dt.accdb` | Discovery hints, reference lists, source semantics; do not import seven copies of the clinic |
| Older/backup workstation files | Earlier application copies; some retain a developer-era absolute link | Recognize stale links and rebase within the supplied transfer; do not follow unrelated paths |
| `dtsetup.accdr`, `updtx.accdr` | Maintenance/update utilities with local settings and application objects | Inspect as metadata; do not execute or treat as clinical databases |
| Six `.laccdb` files | Access lock artifacts | Diagnostic hints only; presence alone does not prove an active writer |
| Installer CAB payloads | Original frontend/update tools and an empty data template | Exclude installer data from patient discovery; the embedded data template is byte-identical to `optic_dtn.accdb` |
| Repeated `7Z.EXE`, `7Z.DLL`, `mailsend-go.exe`; setup programs | Packaging, compression, email, and installation dependencies | No imported business entities |
| Barcode font, Outlook type library, Hebrew installation DOC | Runtime assets and installation instructions | Preserve inventory only |

The local installation document explicitly describes separate program installation on each workstation and data installation either locally or on a network. The observed linked-table catalog confirms that architecture. This matches Microsoft's documented [split Access database structure](https://support.microsoft.com/en-us/access/split-an-access-database). `.accdr` denotes runtime deployment; it is not a separate SQL engine or a reason to install the application to extract data. See Microsoft's [Access deployment documentation](https://support.microsoft.com/en-gb/access/deploy-an-access-application?nochrome=true).

The seven current workstation copies share the same backend link, prescription-category list, product-kind list, and payment-method list. `parameters.scan_path` and `alt_scan_path` are empty in those copies. `companyn` has no populated company name/address/contact identifiers in the selected database, so it cannot establish a globally unique source identity.

## Selected database: every business table

Counts below are **enumerated CSV records**, rather than the cached table header. Fifteen tables are populated and sixteen are empty.

| Table | Rows | Meaning / treatment |
| --- | ---: | --- |
| `cust_list` | 39,141 | Customer identity, demographics, contact details, clinical/profile remnants |
| `checks` | 50,762 | Glasses prescriptions and exam records, classified by `qtyp` |
| `adchecks` | 26,314 | Contact-lens prescriptions and checks, classified by `qtyp` |
| `orders` | 14,642 | Sales/order header, two product slots, totals, paid amount, outstanding balance |
| `tb_ad_catalog` | 570 | Spectacle-lens price/catalog entries, including materials and coatings |
| `tb_catalog` | 28 | Frame catalog; all `amount` values are `-1`, not usable opening-stock quantities |
| `SAPAKIM` | 8 | Supplier lookup |
| `BANK_LIST` | 36 | Bank/payment reference data |
| `CREDIT_LIST` | 4 | Credit/payment reference data |
| `presence_type` | 7 | Attendance-type definitions; no actual attendance rows |
| `add_num` | 1 | Legacy numbering state; do not change Prysm sequences from it |
| `add_order` | 1 | Numbering/configuration state; preserve approved context only |
| `companyn` | 1 | Company/settings row with business identity fields empty |
| `doc_title` | 1 | Document header/logo/signature definition; all fields empty |
| `pass` | 1 | Legacy authentication secret; exclude from structured migration and reports |
| `employees` | 0 | Employee definitions |
| `items_sales` | 0 | Order-related sale/payment detail; FK points to `orders.rnum`, not directly to a patient |
| `person_remarks` | 0 | Remarks/document references; frontend `qfile_cust` selects this table for files |
| `presence` | 0 | Attendance records |
| `presence_back` | 0 | Attendance backup records |
| `proposals` | 0 | Quotes/proposals |
| `tb_amlot` | 0 | Credit commission definitions |
| `tb_comp` | 0 | Additional patient measurements; exact clinical meanings require validation |
| `tb_date_list` | 0 | Authoritative diary/appointment records |
| `tb_gnrl_tests` | 0 | Additional clinical values (`tst1`–`tst60`) |
| `tb_hsapakim` | 0 | Supplier financial documents |
| `tb_kabala` | 0 | Receipt/payment detail, FK `rnum -> orders.rnum` |
| `tb_q_checks` | 0 | Supplier check/payment records |
| `tb_quest` | 0 | Patient questionnaires |
| `tb_upd_amount` | 0 | Inventory updates linked to frame catalog |
| `TT  TELEFONE  SAPAKIM` | 0 | Supplier contacts |

There are no scanned patient files or external document folders in the transfer. The frontend `tb_yoman` tables contain 49 time-grid rows each, with no populated appointment text/client/end-time cells. These are not 49 appointments per workstation. Current frontend `tb_credits` tables do contain a single scratch financial row; retain that fact as diagnostic evidence, but do not assume it is a new receipt. Its authoritative status has not been established.

## Identity, relationships, and data quality

### Customer and record keys

- `cust_list.numw`: 39,141 distinct, populated keys; canonical patient identity within this source.
- `checks.bdikanum`: 50,762 distinct keys. `adchecks.bdikanum`: 26,314 distinct keys. Their numeric spaces are separate; include the table name in identity.
- `orders.rnum`: 14,642 distinct keys. Preserve `ordernum` as the displayed legacy order number, not as the import identity.
- Every enumerated glasses, contact-lens, and order record resolves to an existing `cust_list.numw`: **zero orphan customer references** in these three domains.
- National ID is populated for only 6,381 customers, with 108 duplicate-ID groups. Mobile and home numbers also have many duplicates. These values cannot drive automatic merging.
- `cust_list.number` is not unique. Do not substitute it for `numw`.
- `fname -> last_name` and `pname -> first_name` are the proposed customer-name mapping based on legacy naming and query usage; validate against the original UI before release. `wsort` is a separate sort/file value, not another name field.
- The misleading `ocupation` field is used as a status filter by `q_cust_list` (`-1` is filtered). All current values are `0`. Do not map the column by its spelling into Prysm occupation.

### Record-count discrepancies

The active `checks` header reports **50,760**, while CSV parsing and direct libmdb row iteration each return **50,762**, all with unique keys and valid customer links. Some backups have analogous one-row discrepancies. Therefore the importer must record header and enumerated counts separately and never stop after the header count.

The two extra glasses rows need comparison with an independent Windows Access/ACE read before treating 50,762 as a clinically accepted production count. This research confirms readable rows, not the reason the metadata disagrees.

### Dates and text

- 7,040 glasses records have no `chdate`; one additional glasses record exports an invalid calendar token.
- Birth dates: 3,678 missing, two invalid calendar tokens, three future dates relative to 2026-10-23.
- Order dates: one invalid calendar token and two future dates. `mwdate` also contains implausible future years.
- Some exports produce `1900-01-00T00:00:00`. Preserve the source representation and, where available, original date serial before deciding whether this is a legacy sentinel or a conversion issue. Never turn it into today's date.
- No Unicode replacement characters were found in exported selected-database text. Hebrew survives extraction.
- Prescription fields contain numerals, `PLANO`, `BAL`, blanks, dashes, compound expressions, mistyped characters, and numeric outliers. Do not strip all non-numeric characters or assume a missing decimal point.
- Contact-lens columns can contain older free-text/model codes rather than clean categorical values. Patient-level `nrmm*`/`nrdd*` distributions do not justify assuming that similarly named columns have consistent units.

## Clinical semantics

`qtyp` carries the record category. In `checks`, the current export contains 50,199 final prescriptions, 453 old prescriptions including a spelling variant, 95 subjective records, 11 objective records, and four unknown/blank categories. In `adchecks`, it contains 26,062 final, 138 old, 57 trial, 48 subjective, eight objective, and one blank category.

Each source row must remain independently traceable. Shared customer/date values do not prove that two rows are the same encounter. Use the category to select existing Prysm cards; preserve unclassified or unsupported content visibly with its source labels.

Main field families are `cr*/cl*` for right/left glasses values and `cnr*/cnl*` for right/left contact-lens values. `ct` expresses glasses usage, with values such as distance, reading, multifocal, and intermediate. Preserve distance and near PD, binocular/monocular VA, prism amount and direction, additions, fitting heights, contact type/model/base curve/diameter, over-refraction, remarks, and examiner names separately.

## Orders and finances: important differences from the other importers

### Order kind and product slots

All 14,642 order rows have `cn=0`, yet **1,253 rows** have a contact-lens product label. Therefore `cn` must not select glasses versus contact-lens order type. The relevant labels are `color` and `color2`, interpreted through the frontend `tb_lens` list. These columns are not ordinary color values; `ocolor` is a frame-color field.

Orders have first and second product slots, including repeated frame, lens, quantity, price, supplier, and eye-selection fields. The second product label is populated on 12,306 rows, but only 7,784 second slots have a nonzero frame or lens amount. There are 112 rows with a nonzero frame amount in both slots. Labels alone can be defaults, and a second slot is not automatically a second pair of glasses. Slot meaning, eye selection, and quantity interpretation need original-UI verification. No mixed glasses/contact row was found here, but the mapping must handle that supported shape when tested synthetically.

### Financial field meanings

The legacy balance query `q_yitra` filters `gpay > 0` for outstanding debts. Together with the values, this supports:

| Source | Meaning | Proposed Prysm mapping |
| --- | --- | --- |
| `gf_price` | Final total | `Billing.total_after_discount` |
| `tpay` | Accumulated paid amount | Opening imported paid balance / `prepayment_amount` |
| `gpay` | Remaining balance | Must equal final total minus imported paid balance |
| `gprice`, `greduce`, `gdisc` | Before-discount and discount context | Preserve separately; do not force an inconsistent reconstruction |
| `tb_kabala` | Individual payment history when populated | Payment events only after event semantics are verified |

For **all 14,642 orders**, `gf_price = tpay + gpay` within 0.01. `gprice - greduce = gf_price` holds on 14,626 rows and differs on 16. Negative values and credit/overpayment balances exist. Preserve signs and the authoritative final total.

The receipt-detail table is empty in this transfer despite populated accumulated payments. Importing an opening paid balance must not manufacture transaction dates, payment methods, or receipt numbers, or count the same amount again as a new payment.

### Exam association

`orders.number` is zero on every current order, so it provides no exam foreign key. Source report queries use the patient, `mwdate`, prescription category, and product/usage context. A same-patient/date search alone yields 2,652 orders with multiple eligible clinical rows and 1,820 with none; 290 have missing/invalid `mwdate`. Usage filtering improves this but does not eliminate ambiguity.

Do not associate an order with the latest exam or an arbitrary row. Attach only when the validated source rules yield exactly one compatible candidate; otherwise preserve the order and flag the unresolved association.

## Backups are not interchangeable

| Snapshot | Customers | Glasses rows | Contact rows | Orders |
| --- | ---: | ---: | ---: | ---: |
| Current `optic_dt.accdb` | 39,141 | 50,762 | 26,314 | 14,642 |
| 2025-12-08 snapshot | 38,737 | 49,772 | 25,685 | 13,894 |
| 2024-06-06 snapshot | 38,016 | 48,049 | 24,650 | 12,382 |
| 2024-04-18 snapshot | 33,907 | 36,045 | 15,855 | 12,194 |
| 2024-04-15 snapshot | 33,905 | 36,034 | 15,850 | 12,152 |
| Empty template | 0 | 0 | 0 | 0 |

The 2025 snapshot has **one customer key, 267 glasses keys, 15 contact keys, and three order keys absent from the current file**. Older snapshots have further differences. These might reflect deletions, repairs, or other changes; their cause is unproven. Automatic union would change the selected snapshot's meaning. Keep a recovery comparison separate from normal migration.

All data variants share the core business schema. Older files lack a few newer columns (`msgdone`, messaging settings, and one company flag). This supports a core-schema detector plus optional-column handling, rather than matching one exact file hash or requiring every recent field.

## What is established and what remains unverified

Established: application identity, split-file topology, every supplied database's table inventory, readable current business rows, source key relationships, Hebrew extraction, major prescription categories, financial balance identity, backup differences, empty domains, and libmdb compatibility.

Still required before production: independent Access count/date comparison; original-screen confirmation of names, obscure clinical units, two-slot/quantity/eye semantics, status flags, and financial display; handling of encrypted/corrupt/newer schema variants; actual Windows packaging, network-share discovery and snapshot consistency; populated receipts, appointments, questionnaires, attendance, documents, and supplier-finance fixtures. No claim is made to have fully decompiled forms/VBA or validated every saved-query expression's reconstruction.

The [MDB Tools project](https://github.com/mdbtools/mdbtools) documents its Access-reading library and separate command-line utilities. Research used local utilities; a shipped Prysm reader should follow the existing project's direct-library packaging approach and notices.

Migration note: Not needed; this research adds documentation and aggregate audit evidence only. No application behavior, persisted data, public API, or database schema was changed.
