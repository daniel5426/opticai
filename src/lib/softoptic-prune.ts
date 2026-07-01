import fs from "fs";
import path from "path";
import { finished } from "stream/promises";

import { parse } from "csv-parse";
import { stringify } from "csv-stringify";
import { stringify as stringifySync } from "csv-stringify/sync";

type CsvRow = Record<string, string>;

export type SoftOpticPruneResult = {
  limited: boolean;
  clientImportLimit?: number | null;
  selectedClientCount: number;
  copiedExternalDocuments: number;
  rowCounts: Record<string, number>;
  headerOnlyTables: string[];
};

export type PruneSoftOpticExportOptions = {
  outputDir: string;
  clientImportLimit?: number | null;
  includeDocuments?: boolean;
  documentRoot?: string;
};

const LOOKUP_TABLES = new Set([
  "optic_tv_lens_supplier.csv",
  "optic_tv_lens_model.csv",
  "optic_tv_lens_mater.csv",
  "optic_tv_lens_color.csv",
  "optic_tv_lens_coat.csv",
  "optic_tv_frame_model.csv",
  "optic_tv_frame_manuf.csv",
  "optic_tv_contact_type.csv",
  "optic_tv_contact_model.csv",
  "optic_tv_contact_manuf.csv",
  "optic_tv_contact_color.csv",
  "optic_tv_contact_mater.csv",
  "optic_tv_clean_sol.csv",
  "optic_tv_dis_sol.csv",
  "optic_tv_wash_sol.csv",
  "optic_tv_order_type.csv",
  "account_tv_memo_type.csv",
]);

const ACCOUNT_LINKED_TABLES = new Set([
  "optic_eye_tests.csv",
  "optic_exp_eyetests.csv",
  "optic_contact_presc.csv",
  "optic_glasses_presc.csv",
  "optic_contact_lens_chk.csv",
  "optic_reference.csv",
  "account_files.csv",
  "account_memos.csv",
  "account_chart.csv",
  "diary_timetab.csv",
]);

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function cleanLower(value: unknown): string {
  return clean(value).toLowerCase();
}

function getField(row: CsvRow, ...names: string[]): string {
  for (const name of names) {
    if (row[name] != null) return clean(row[name]);
  }
  const entries = Object.entries(row);
  for (const name of names) {
    const found = entries.find(([key]) => key.toLowerCase() === name.toLowerCase());
    if (found) return clean(found[1]);
  }
  return "";
}

function isClientAccount(row: CsvRow): boolean {
  const value = getField(row, "account_type", "ACCOUNT_TYPE", "type", "Type").replace(/^['"]|['"]$/g, "").toUpperCase();
  return value === "A" || value === "CUST" || value === "CUSTOMER";
}

async function readCsvHeaders(filePath: string): Promise<string[]> {
  if (!fs.existsSync(filePath)) return [];
  const parser = fs.createReadStream(filePath, { encoding: "utf8" }).pipe(
    parse({
      bom: true,
      to_line: 1,
      relax_column_count: true,
    }),
  );
  for await (const record of parser) {
    return Array.isArray(record) ? record.map(value => String(value)) : [];
  }
  return [];
}

async function writeHeaderOnlyCsv(filePath: string): Promise<string[]> {
  const headers = await readCsvHeaders(filePath);
  const content = headers.length ? stringifySync([], { header: true, columns: headers }) : "";
  await fs.promises.writeFile(filePath, content, "utf8");
  return headers;
}

async function filterCsvFile(
  filePath: string,
  predicate: (row: CsvRow) => boolean,
  onKept?: (row: CsvRow) => void,
): Promise<number> {
  const headers = await readCsvHeaders(filePath);
  let kept = 0;
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  const parser = fs.createReadStream(filePath, { encoding: "utf8" }).pipe(
    parse({
      bom: true,
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      relax_quotes: true,
    }),
  );
  const output = fs.createWriteStream(tempPath, { encoding: "utf8" });
  const stringifier = stringify({ header: true, columns: headers });
  const outputFinished = finished(output);
  stringifier.pipe(output);

  try {
    for await (const row of parser as AsyncIterable<CsvRow>) {
      if (!predicate(row)) continue;
      kept += 1;
      onKept?.(row);
      if (!stringifier.write(row)) {
        await new Promise(resolve => stringifier.once("drain", resolve));
      }
    }
    stringifier.end();
    await outputFinished;
    if (!headers.length) {
      await fs.promises.writeFile(tempPath, "", "utf8");
    }
    await fs.promises.rename(tempPath, filePath);
    return kept;
  } catch (error) {
    stringifier.destroy();
    output.destroy();
    await fs.promises.rm(tempPath, { force: true });
    throw error;
  }
}

async function listTopLevelCsvFiles(outputDir: string): Promise<string[]> {
  const entries = await fs.promises.readdir(outputDir, { withFileTypes: true });
  return entries
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith(".csv"))
    .map(entry => entry.name)
    .sort();
}

async function removeRawExportDirs(outputDir: string): Promise<void> {
  const entries = await fs.promises.readdir(outputDir, { withFileTypes: true });
  await Promise.all(
    entries
      .filter(entry => entry.isDirectory() && entry.name.toLowerCase().startsWith("_raw_cp"))
      .map(entry => fs.promises.rm(path.join(outputDir, entry.name), { recursive: true, force: true })),
  );
}

async function collectSelectedAccountCodes(accountPath: string, limit: number): Promise<Set<string>> {
  const selected = new Set<string>();
  const parser = fs.createReadStream(accountPath, { encoding: "utf8" }).pipe(
    parse({
      bom: true,
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      relax_quotes: true,
    }),
  );
  for await (const row of parser as AsyncIterable<CsvRow>) {
    if (!isClientAccount(row)) continue;
    const accountCode = getField(row, "account_code");
    if (!accountCode || selected.has(accountCode)) continue;
    selected.add(accountCode);
    if (selected.size >= limit) break;
  }
  return selected;
}

async function listFilesRecursive(root: string): Promise<string[]> {
  const results: string[] = [];
  async function visit(current: string) {
    const entries = await fs.promises.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  }
  if (root && fs.existsSync(root)) {
    await visit(root);
  }
  return results;
}

function findExternalDocument(candidates: string[], root: string, row: CsvRow): string | null {
  const code = cleanLower(getField(row, "code"));
  const account = cleanLower(getField(row, "account_code"));
  const fileDescription = getField(row, "file_description");
  const nameStem = cleanLower(path.parse(fileDescription).name || fileDescription);
  let best: string | null = null;

  for (const candidate of candidates) {
    const loweredName = path.basename(candidate).toLowerCase();
    const relativeParts = path.relative(root, candidate).split(path.sep).map(part => part.toLowerCase());
    if (code && loweredName.includes(code)) return candidate;
    if (nameStem && loweredName.includes(nameStem)) {
      best = candidate;
    } else if (account && relativeParts.includes(account)) {
      best = candidate;
    }
  }
  return best;
}

async function copyMatchedDocuments(
  outputDir: string,
  documentRoot: string | undefined,
  fileRows: CsvRow[],
): Promise<number> {
  const targetRoot = path.join(outputDir, "documents");
  await fs.promises.rm(targetRoot, { recursive: true, force: true });
  if (!documentRoot || !fs.existsSync(documentRoot) || !fileRows.length) return 0;

  const candidates = await listFilesRecursive(documentRoot);
  const copied = new Set<string>();
  for (const row of fileRows) {
    const match = findExternalDocument(candidates, documentRoot, row);
    if (!match || copied.has(match)) continue;
    const relative = path.relative(documentRoot, match);
    const target = path.join(targetRoot, relative);
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.copyFile(match, target);
    copied.add(match);
  }
  return copied.size;
}

async function updateManifest(outputDir: string, result: SoftOpticPruneResult): Promise<void> {
  const manifestPath = path.join(outputDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) return;
  try {
    const raw = await fs.promises.readFile(manifestPath, "utf8");
    const manifest = raw ? JSON.parse(raw.replace(/^\uFEFF/, "")) : {};
    const tables = Array.isArray(manifest.tables) ? manifest.tables : [];
    manifest.tables = tables.map((table: Record<string, unknown>) => {
      const tableName = clean(table.table);
      const fileName = tableName.toLowerCase().endsWith(".csv") ? tableName : `${tableName}.csv`;
      if (Object.prototype.hasOwnProperty.call(result.rowCounts, fileName)) {
        return { ...table, data_lines: result.rowCounts[fileName] };
      }
      return table;
    });
    manifest.client_import_limit = result.clientImportLimit ?? null;
    manifest.pruned_export = {
      selected_client_count: result.selectedClientCount,
      copied_external_documents: result.copiedExternalDocuments,
      header_only_tables: result.headerOnlyTables,
    };
    await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  } catch {
    // Manifest is informational; pruning should not fail because it is malformed.
  }
}

export async function pruneSoftOpticExport(options: PruneSoftOpticExportOptions): Promise<SoftOpticPruneResult> {
  const limit = options.clientImportLimit ?? null;
  if (!limit || limit < 1) {
    return {
      limited: false,
      clientImportLimit: null,
      selectedClientCount: 0,
      copiedExternalDocuments: 0,
      rowCounts: {},
      headerOnlyTables: [],
    };
  }

  const outputDir = options.outputDir;
  const accountPath = path.join(outputDir, "account.csv");
  if (!fs.existsSync(accountPath)) {
    throw new Error("SoftOptic export is missing account.csv");
  }

  await removeRawExportDirs(outputDir);

  const selectedAccountCodes = await collectSelectedAccountCodes(accountPath, limit);
  const referencedPrescCodes = new Set<string>();
  const referencedFileCodes = new Set<string>();
  const keptFileRows: CsvRow[] = [];
  const processed = new Set<string>();
  const rowCounts: Record<string, number> = {};
  const headerOnlyTables: string[] = [];

  rowCounts["account.csv"] = await filterCsvFile(accountPath, row => selectedAccountCodes.has(getField(row, "account_code")));
  processed.add("account.csv");

  for (const fileName of ACCOUNT_LINKED_TABLES) {
    const filePath = path.join(outputDir, fileName);
    if (!fs.existsSync(filePath)) continue;
    rowCounts[fileName] = await filterCsvFile(
      filePath,
      row => selectedAccountCodes.has(getField(row, "account_code")),
      row => {
        if (fileName === "optic_contact_presc.csv" || fileName === "optic_glasses_presc.csv") {
          const code = getField(row, "code");
          if (code) referencedPrescCodes.add(code);
        }
        if (fileName === "optic_reference.csv") {
          const code = getField(row, "presc_code");
          if (code) referencedPrescCodes.add(code);
        }
        if (fileName === "account_files.csv") {
          const code = getField(row, "code");
          if (code) referencedFileCodes.add(code);
          keptFileRows.push(row);
        }
      },
    );
    processed.add(fileName);
  }

  const prescPricesPath = path.join(outputDir, "optic_presc_prices.csv");
  if (fs.existsSync(prescPricesPath)) {
    rowCounts["optic_presc_prices.csv"] = await filterCsvFile(
      prescPricesPath,
      row => referencedPrescCodes.has(getField(row, "presc_code")),
    );
    processed.add("optic_presc_prices.csv");
  }

  const fileBlobPath = path.join(outputDir, "account_files_blob.csv");
  if (fs.existsSync(fileBlobPath)) {
    rowCounts["account_files_blob.csv"] = await filterCsvFile(
      fileBlobPath,
      row => referencedFileCodes.has(getField(row, "code")),
    );
    processed.add("account_files_blob.csv");
  }

  for (const fileName of LOOKUP_TABLES) {
    if (!fs.existsSync(path.join(outputDir, fileName))) continue;
    processed.add(fileName);
    rowCounts[fileName] = await countCsvRows(path.join(outputDir, fileName));
  }

  for (const fileName of await listTopLevelCsvFiles(outputDir)) {
    if (processed.has(fileName)) continue;
    await writeHeaderOnlyCsv(path.join(outputDir, fileName));
    rowCounts[fileName] = 0;
    headerOnlyTables.push(fileName);
  }

  const copiedExternalDocuments = options.includeDocuments
    ? await copyMatchedDocuments(outputDir, options.documentRoot, keptFileRows)
    : 0;

  const result: SoftOpticPruneResult = {
    limited: true,
    clientImportLimit: limit,
    selectedClientCount: selectedAccountCodes.size,
    copiedExternalDocuments,
    rowCounts,
    headerOnlyTables,
  };
  await updateManifest(outputDir, result);
  return result;
}

async function countCsvRows(filePath: string): Promise<number> {
  let count = 0;
  const parser = fs.createReadStream(filePath, { encoding: "utf8" }).pipe(
    parse({
      bom: true,
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      relax_quotes: true,
    }),
  );
  for await (const _row of parser) {
    count += 1;
  }
  return count;
}
