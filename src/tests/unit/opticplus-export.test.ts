// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import PizZip from "pizzip";
import { afterEach, expect, test, vi } from "vitest";
import { discoverOpticPlus, extractOpticPlusTransfer, exportOpticPlus, fileHash } from "@/lib/opticplus-export";

const roots: string[] = [];
const temp = () => { const p = fs.mkdtempSync(path.join(os.tmpdir(), "opticplus-test-")); roots.push(p); return p; };
afterEach(() => { for (const p of roots.splice(0)) fs.rmSync(p, { recursive: true, force: true }); });

test("nested transfers exclude installers and retain database candidates", async () => {
  const nested = new PizZip(); nested.file("optic_dt.accdb", "backup");
  const zip = new PizZip(); zip.file("OpticPlus_Data/optic_dt.accdb", "current");
  zip.file("OpticPlus_Data/backup.zip", nested.generate({ type: "nodebuffer" }));
  zip.file("OpticSetup/optic_dt.accdb", "empty template"); zip.file("tool.exe", "never extract");
  const root = temp(); await extractOpticPlusTransfer(zip.generate({ type: "nodebuffer" }), root);
  expect(fs.existsSync(path.join(root, "OpticPlus_Data/backup.zip.contents/optic_dt.accdb"))).toBe(true);
  expect(fs.existsSync(path.join(root, "tool.exe"))).toBe(false);
  expect(fs.existsSync(path.join(root, "OpticSetup/optic_dt.accdb"))).toBe(false);
});

test("rejects path traversal instead of writing outside extraction root", async () => {
  const zip = new PizZip(); zip.file("../outside.accdb", "unsafe");
  await expect(extractOpticPlusTransfer(zip.generate({ type: "nodebuffer" }), temp())).rejects.toThrow("unsafeArchive");
});

test("recommends one current backend and deduplicates byte-identical copies", async () => {
  const root = temp(); fs.mkdirSync(path.join(root, "backups"));
  fs.writeFileSync(path.join(root, "optic_dt.accdb"), "current");
  fs.writeFileSync(path.join(root, "copy.accdb"), "current");
  fs.writeFileSync(path.join(root, "backups/optic_dt2024.accdb"), "older");
  const run = vi.fn().mockImplementation(async (_file, args) => JSON.stringify(args[0] === "--profiles"
    ? { profiles: ["opticplus"], opticplus_format_version: 2 } : { backend: true, clients: 2, links: [] }));
  const candidates = await discoverOpticPlus([root], "reader", run);
  expect(candidates).toHaveLength(2);
  expect(candidates.filter(c => c.recommended)).toHaveLength(1);
});

test("an older packaged reader fails with an actionable compatibility error", async () => {
  await expect(discoverOpticPlus([temp()], "reader", vi.fn().mockResolvedValue(""))).rejects.toThrow("readerUnavailable");
});

test("source modification between discovery and export aborts the bundle", async () => {
  const root = temp(); const source = path.join(root, "optic_dt.accdb"); fs.writeFileSync(source, "old");
  const fingerprint = await fileHash(source); fs.writeFileSync(source, "new");
  await expect(exportOpticPlus({ dbFile: source, fingerprint } as any,
    { tempRoot: root, reader: "reader", run: vi.fn() })).rejects.toThrow("sourceChanged");
  expect(fs.readdirSync(root).some(f => f.startsWith("opticplus-export-"))).toBe(false);
  expect(fs.readFileSync(source, "utf8")).toBe("new");
});

test('explicit client selection rejects duplicates and mixing selection with a first-N limit', async () => {
  const root=temp();const source=path.join(root,'optic_dt.accdb');fs.writeFileSync(source,'unchanged');
  const candidate={dbFile:source,fingerprint:await fileHash(source)} as any;
  const run=vi.fn();
  for(const options of [{selectedClientIds:[49822,49822]}, {selectedClientIds:[49822],clientLimit:1}, {selectedClientIds:[0]}]) {
    await expect(exportOpticPlus(candidate,{tempRoot:root,reader:'reader',run,...options})).rejects.toThrow('invalidSelection');
  }
  expect(run).not.toHaveBeenCalled();
  expect(fs.readFileSync(source,'utf8')).toBe('unchanged');
  expect(fs.readdirSync(root).some(name=>name.startsWith('opticplus-export-'))).toBe(false);
});
