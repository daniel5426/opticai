/** Read-only OpticPlus discovery/export. Never invokes the legacy application. */
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { inflateRawSync } from "node:zlib";
import { parse } from "csv-parse/sync";
import PizZip from "pizzip";

const execute = promisify(execFile);
const MAX_FILE = 512 * 1024 * 1024;
const MAX_TOTAL = 2 * 1024 ** 3;
const managedTransfers = new Set<string>();
export type OpticPlusCandidate = {
  id: string; kind: "access-db"; sourceSystem: "opticplus"; label: string;
  dbFile: string; sizeBytes: number; score: number; recommended: boolean;
  reasons: string[]; fingerprint: string; clients: number;
};
type Runner = (file: string, args: string[]) => Promise<string>;
const nativeRun: Runner = async (file, args) => (await execute(file, args, { maxBuffer: 16 * 1024 * 1024, windowsHide: true })).stdout;
export async function fileHash(file: string) {
  const hash = createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
function safeName(name: string) {
  const normalized = name.replace(/\\/g, "/");
  if (!normalized || normalized.startsWith("/") || normalized.includes(":") || normalized.split("/").some(p => p === ".." || p === "."))
    throw new Error("opticplus.unsafeArchive");
  return normalized;
}

/** Bounded ZIP extraction: no ZIP64, encrypted entries, links, or executable payloads. */
export async function extractOpticPlusTransfer(buffer: Buffer, destination: string) {
  let bytes = 0, entries = 0;
  const seen = new Set<string>();
  async function extract(data: Buffer, directory: string, depth: number) {
    if (data.length > MAX_FILE || depth > 2) throw new Error("opticplus.archiveLimit");
    const eocd = data.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (eocd < Math.max(0, data.length - 65557) || eocd + 22 > data.length) throw new Error("opticplus.invalidArchive");
    const count = data.readUInt16LE(eocd + 10);
    let offset = data.readUInt32LE(eocd + 16);
    if (count === 65535 || offset === 0xffffffff) throw new Error("opticplus.archiveLimit");
    for (let index = 0; index < count; index++) {
      if (++entries > 10000 || offset + 46 > data.length || data.readUInt32LE(offset) !== 0x02014b50)
        throw new Error("opticplus.invalidArchive");
      const flags = data.readUInt16LE(offset + 8), method = data.readUInt16LE(offset + 10);
      const compressed = data.readUInt32LE(offset + 20), size = data.readUInt32LE(offset + 24);
      const nameLength = data.readUInt16LE(offset + 28), extra = data.readUInt16LE(offset + 30), comment = data.readUInt16LE(offset + 32);
      const attributes = data.readUInt32LE(offset + 38), local = data.readUInt32LE(offset + 42);
      if (offset + 46 + nameLength + extra + comment > data.length) throw new Error("opticplus.invalidArchive");
      const name = safeName(data.subarray(offset + 46, offset + 46 + nameLength).toString("utf8"));
      offset += 46 + nameLength + extra + comment;
      if (flags & 1 || ((attributes >>> 16) & 0o170000) === 0o120000) throw new Error("opticplus.unsafeArchive");
      bytes += size;
      if (size > MAX_FILE || bytes > MAX_TOTAL || size > Math.max(1, compressed) * 2000) throw new Error("opticplus.archiveLimit");
      const target = path.resolve(directory, name), identity = target.toLowerCase();
      if (!target.startsWith(path.resolve(directory) + path.sep) || seen.has(identity)) throw new Error("opticplus.unsafeArchive");
      seen.add(identity);
      if (name.endsWith("/")) continue;
      // Do not unpack installers or execute/archive their embedded templates.
      if (!/\.(accdb|accdr|zip|pdf|jpe?g|png|tiff?|bmp)$/i.test(name) || /(?:^|\/)OpticSetup\//i.test(name)) continue;
      if (local + 30 > data.length || data.readUInt32LE(local) !== 0x04034b50) throw new Error("opticplus.invalidArchive");
      const start = local + 30 + data.readUInt16LE(local + 26) + data.readUInt16LE(local + 28);
      if (start + compressed > data.length) throw new Error("opticplus.invalidArchive");
      const packed = data.subarray(start, start + compressed);
      const content = method === 0 ? packed : method === 8 ? inflateRawSync(packed, { maxOutputLength: Math.max(1, size) }) : null;
      if (!content || content.length !== size) throw new Error("opticplus.invalidArchive");
      if (/\.zip$/i.test(name)) {
        await extract(content, target + ".contents", depth + 1);
      } else {
        await fs.promises.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
        await fs.promises.writeFile(target, content, { flag: "wx", mode: 0o600 });
      }
    }
  }
  await extract(buffer, destination, 0);
}

export async function discoverOpticPlus(input: string[], reader: string, run: Runner = nativeRun) {
  try {
    const capabilities = JSON.parse(await run(reader, ["--profiles"]));
    if (!capabilities.profiles?.includes("opticplus") || capabilities.opticplus_format_version !== 2) throw new Error();
  } catch { throw new Error("opticplus.readerUnavailable"); }
  const files: string[] = [], visited = new Set<string>();
  let inspected = 0;
  async function walk(target: string, depth = 0): Promise<void> {
    if (depth > 6 || ++inspected > 10000 || visited.has(target.toLowerCase())) return;
    visited.add(target.toLowerCase());
    const stat = await fs.promises.lstat(target).catch(() => null);
    if (!stat || stat.isSymbolicLink()) return;
    if (stat.isDirectory()) {
      if (/^(?:OpticSetup|installer-payloads)$/i.test(path.basename(target))) return;
      for (const entry of await fs.promises.readdir(target)) await walk(path.join(target, entry), depth + 1);
    } else if (/\.(accdb|accdr)$/i.test(target)) files.push(target);
  }
  for (const target of input) await walk(target);
  const linked = new Set<string>(), backends: Array<{ file: string; clients: number }> = [];
  const offlineTransfer = input.some(root => managedTransfers.has(root));
  for (let i = 0; i < files.length; i++) {
    let probe;
    try { probe = JSON.parse(await run(reader, ["--profile", "opticplus", "--probe", "--db", files[i]])); }
    catch { continue; }
    if (probe.backend && probe.clients > 0) backends.push({ file: files[i], clients: probe.clients });
    for (const link of probe.links || []) {
      if (typeof link !== "string" || !/\.accdb$/i.test(link)) continue;
      linked.add(path.resolve(link).toLowerCase());
      // Follow exact installed backend references using existing OS permissions.
      if (!offlineTransfer && process.platform === "win32" && !visited.has(link.toLowerCase()) && files.length < 10000) {
        const stat = await fs.promises.lstat(link).catch(() => null);
        if (stat?.isFile() && !stat.isSymbolicLink()) { visited.add(link.toLowerCase()); files.push(link); }
      }
    }
  }
  const candidates: OpticPlusCandidate[] = [];
  for (const { file, clients } of backends) {
    const fingerprint = await fileHash(file);
    const exactLink = linked.has(path.resolve(file).toLowerCase());
    const currentName = path.basename(file).toLowerCase() === "optic_dt.accdb";
    const backup = /\.zip\.contents|backup|optic_dt\d/i.test(file);
    const candidate: OpticPlusCandidate = { id: fingerprint, kind: "access-db", sourceSystem: "opticplus", label: path.basename(file), dbFile: file,
      sizeBytes: (await fs.promises.stat(file)).size, fingerprint, clients,
      score: (exactLink ? 100 : 0) + (currentName && !backup ? 30 : 0), recommended: false,
      reasons: [exactLink ? "linked_backend" : backup ? "backup" : "schema_match"] };
    const duplicate = candidates.findIndex(c => c.fingerprint === fingerprint);
    if (duplicate === -1) candidates.push(candidate);
    else if (candidate.score > candidates[duplicate].score) candidates[duplicate] = candidate;
  }
  candidates.sort((a, b) => b.score - a.score);
  if (candidates.length === 1 || (candidates.length > 1 && candidates[0].score > candidates[1].score)) candidates[0].recommended = true;
  return candidates;
}

export async function prepareOpticPlusInput(input: string, tempRoot: string) {
  const stat = await fs.promises.lstat(input);
  if (stat.isSymbolicLink()) throw new Error("opticplus.unsafeArchive");
  if (stat.isFile() && /\.zip$/i.test(input)) {
    if (stat.size > MAX_FILE) throw new Error("opticplus.archiveLimit");
    const directory = await fs.promises.mkdtemp(path.join(tempRoot, "opticplus-transfer-"));
    try { await extractOpticPlusTransfer(await fs.promises.readFile(input), directory); }
    catch (error) { await fs.promises.rm(directory, { recursive: true, force: true }); throw error; }
    managedTransfers.add(directory);
    return directory;
  }
  return input;
}

async function snapshot(source: string, target: string, run: Runner) {
  if (process.platform === "win32") {
    const quote = (s: string) => `'${s.replace(/'/g, "''")}'`;
    // Deny writer sharing for the duration of the copy. An already-open writer
    // causes failure; timestamps alone do not establish a consistent snapshot.
    const command = `$ErrorActionPreference='Stop'; $s=[IO.File]::Open(${quote(source)},'Open','Read','Read'); try { $d=[IO.File]::Create(${quote(target)}); try { $s.CopyTo($d) } finally { $d.Dispose() } } finally { $s.Dispose() }`;
    await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command]);
  } else {
    // This branch is used by offline-transfer tooling/tests, not live discovery.
    const before = await fileHash(source);
    await fs.promises.copyFile(source, target);
    if (before !== await fileHash(source) || before !== await fileHash(target)) throw new Error("opticplus.sourceChanged");
  }
}

export async function exportOpticPlus(candidate: OpticPlusCandidate, options: {
  tempRoot: string; reader: string; clientLimit?: number | null; selectedClientIds?: number[]; includeDocuments?: boolean; run?: Runner;
}) {
  const run = options.run || nativeRun;
  const outputDir = await fs.promises.mkdtemp(path.join(options.tempRoot, "opticplus-export-"));
  try {
    if (options.clientLimit != null && (!Number.isSafeInteger(options.clientLimit) || options.clientLimit < 1)) throw new Error("opticplus.invalidLimit");
    const selected = options.selectedClientIds;
    if (selected && (!selected.length || selected.length > 10000 || options.clientLimit || new Set(selected).size !== selected.length ||
        selected.some(id => !Number.isSafeInteger(id) || id < 1 || id > 2147483647))) throw new Error("opticplus.invalidSelection");
    const sourceDir = path.join(outputDir, "source");
    await fs.promises.mkdir(sourceDir);
    const original = path.join(sourceDir, "optic_dt.accdb");
    await snapshot(candidate.dbFile, original, run);
    const fingerprint = await fileHash(original);
    if (fingerprint !== candidate.fingerprint) throw new Error("opticplus.sourceChanged");
    const args = ["--profile", "opticplus", "--db", original, "--output", outputDir];
    if (options.clientLimit) args.push("--client-limit", String(options.clientLimit));
    for (const id of selected || []) args.push("--client-id", String(id));
    await run(options.reader, args);
    const inventoryPath = path.join(outputDir, "source-schema.json");
    const inventory = JSON.parse(await fs.promises.readFile(inventoryPath, "utf8"));
    if (selected && JSON.stringify([...selected].sort((a, b) => a - b)) !== JSON.stringify(inventory.selected_client_ids))
      throw new Error("opticplus.invalidSelection");
    if (![1, 2].includes(inventory.extractor_version)) throw new Error("opticplus.readerUnavailable");
    const tables = await Promise.all(inventory.tables.map(async (t: any) => {
      if (typeof t.name !== "string" || /[\\/:]/.test(t.name)) throw new Error("opticplus.invalidArchive");
      const file = `tables/${t.name}.csv`, rawFile = `raw/${t.name}.jsonl`;
      return { name: t.name, file, raw_file: rawFile, row_count: t.row_count,
        sha256: await fileHash(path.join(outputDir, file)), raw_sha256: await fileHash(path.join(outputDir, rawFile)) };
    }));
    const counts = Object.fromEntries(tables.map(t => [t.name.toLowerCase(), t.row_count]));
    if (!counts.cust_list) throw new Error("opticplus.noDatabase");
    const documents = await collectOpticPlusDocuments(outputDir, candidate.dbFile, options.includeDocuments === true);
    const manifest = { source_system: "opticplus", format_version: 2, mapping_version: 2, extractor_version: inventory.extractor_version,
      exported_at: new Date().toISOString(), source_fingerprint: fingerprint,
      selected_client_ids: inventory.selected_client_ids, client_limit: options.clientLimit || null,
      source_archive: { file: "source/optic_dt.accdb", complete: true, size: (await fs.promises.stat(original)).size, sha256: fingerprint },
      source_schema_inventory: { file: "source-schema.json", sha256: await fileHash(inventoryPath) }, tables, documents };
    const coverage = Object.fromEntries(Object.entries(counts).map(([name, rows]) => [name, { rows, disposition: !rows ? "empty"
      : ["cust_list", "checks", "adchecks", "orders"].includes(name) ? "mapped"
      : ["sapakim", "tb_ad_catalog", "tb_catalog", "bank_list", "credit_list", "presence_type", "add_num", "add_order", "companyn", "doc_title"].includes(name) ? "reference_data"
      : ["person_remarks", "tb_comp", "tb_gnrl_tests", "tb_quest"].includes(name) ? "visibly_preserved" : "archive_only" }]));
    for (const table of inventory.unrecognized_tables || []) coverage[table.name] = { rows: table.row_count, disposition: "archive_only" };
    await fs.promises.writeFile(path.join(outputDir, "manifest.json"), JSON.stringify(manifest));
    const zip = new PizZip();
    for (const relative of ["manifest.json", "source/optic_dt.accdb", "source-schema.json", ...tables.flatMap(t => [t.file, t.raw_file]), ...documents.files.map(d => d.file)])
      zip.file(relative, await fs.promises.readFile(path.join(outputDir, relative)));
    const zipPath = `${outputDir}.zip`;
    await fs.promises.writeFile(zipPath, zip.generate({ type: "nodebuffer", compression: "DEFLATE" }), { mode: 0o600 });
    for (const directory of managedTransfers) {
      if (path.resolve(candidate.dbFile).startsWith(path.resolve(directory) + path.sep)) {
        await fs.promises.rm(directory, { recursive: true, force: true }).catch(() => undefined);
        managedTransfers.delete(directory);
      }
    }
    return { success: true, outputDir, zipPath, summary: { clients: counts.cust_list, exams: counts.checks + counts.adchecks,
      orders: counts.orders, sourceFingerprint: fingerprint,
      manifest: { source_system: "opticplus", format_version: 2, mapping_version: 2, client_limit: manifest.client_limit, selected_client_ids: selected || null,
        source_archive: manifest.source_archive }, counts, coverage } };
  } catch (error) {
    await fs.promises.rm(outputDir, { recursive: true, force: true });
    throw error;
  }
}

async function collectOpticPlusDocuments(output: string, source: string, include: boolean) {
  const result = { included: include, files: [] as Array<{ file: string; client_id: string; sha256: string; size: number; original_name: string }>,
    missing_referenced_count: 0, unresolved_references: 0 };
  const csv = path.join(output, "tables", "person_remarks.csv");
  if (!include || !fs.existsSync(csv)) return result;
  const rows = parse(await fs.promises.readFile(csv, "utf8"), { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  // Resolve relative paths only inside the selected backend's directory. Other
  // roots must be supplied explicitly; never follow arbitrary absolute paths.
  const root = path.dirname(source);
  for (const raw of rows) {
    const row = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.toLowerCase(), v]));
    if (row.qtyp !== "1" || !row.addw) continue;
    const relative = row.addw.replace(/\\/g, "/");
    if (!/\.(pdf|jpe?g|png|tiff?|bmp)$/i.test(relative) || relative.startsWith("/") || relative.includes(":") || relative.split("/").includes("..")) {
      result.unresolved_references++; continue;
    }
    const file = path.join(root, relative);
    const stat = await fs.promises.lstat(file).catch(() => null);
    if (!stat?.isFile() || stat.isSymbolicLink() || stat.size > 50 * 1024 * 1024) { result.missing_referenced_count++; continue; }
    const real = await fs.promises.realpath(file);
    if (!real.startsWith(await fs.promises.realpath(root) + path.sep)) { result.unresolved_references++; continue; }
    const sha256 = await fileHash(real), destination = `documents/${sha256}/${path.basename(relative)}`;
    await fs.promises.mkdir(path.dirname(path.join(output, destination)), { recursive: true });
    await fs.promises.copyFile(real, path.join(output, destination));
    result.files.push({ file: destination, client_id: row.numw, sha256, size: stat.size, original_name: path.basename(relative) });
  }
  return result;
}
