import fs from "fs";
import os from "os";
import path from "path";

import { parse } from "csv-parse/sync";
import { afterEach, describe, expect, test } from "vitest";

import { pruneSoftOpticExport } from "@/lib/softoptic-prune";

const tempDirs: string[] = [];

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "softoptic-prune-"));
  tempDirs.push(dir);
  return dir;
}

function writeCsv(dir: string, name: string, rows: string[][]) {
  fs.writeFileSync(path.join(dir, name), rows.map(row => row.join(",")).join("\n") + "\n", "utf8");
}

function readRows(dir: string, name: string) {
  const text = fs.readFileSync(path.join(dir, name), "utf8");
  return parse(text, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("pruneSoftOpticExport", () => {
  test("keeps selected clients, related rows, lookup rows, and matched documents", async () => {
    const outputDir = makeTempDir();
    const documentRoot = makeTempDir();
    fs.mkdirSync(path.join(outputDir, "_raw_cp1255"));
    fs.writeFileSync(path.join(outputDir, "_raw_cp1255", "account.csv"), "raw full export", "utf8");

    writeCsv(outputDir, "account.csv", [
      ["account_code", "account_type", "first_name"],
      ["101", "CUST", "A"],
      ["102", "A", "B"],
      ["103", "OTHER", "Not client"],
      ["104", "CUSTOMER", "C"],
    ]);
    writeCsv(outputDir, "optic_eye_tests.csv", [
      ["code", "account_code"],
      ["e1", "101"],
      ["e2", "102"],
      ["e4", "104"],
    ]);
    writeCsv(outputDir, "optic_exp_eyetests.csv", [
      ["code", "account_code"],
      ["e1x", "101"],
      ["e4x", "104"],
    ]);
    writeCsv(outputDir, "optic_contact_presc.csv", [
      ["code", "account_code"],
      ["cp1", "101"],
      ["cp4", "104"],
    ]);
    writeCsv(outputDir, "optic_glasses_presc.csv", [
      ["code", "account_code"],
      ["gp2", "102"],
      ["gp4", "104"],
    ]);
    writeCsv(outputDir, "optic_reference.csv", [
      ["presc_code", "account_code"],
      ["rp2", "102"],
      ["rp4", "104"],
    ]);
    writeCsv(outputDir, "optic_presc_prices.csv", [
      ["presc_code", "item_name"],
      ["cp1", "contact"],
      ["gp2", "glasses"],
      ["rp2", "referral"],
      ["cp4", "drop"],
    ]);
    writeCsv(outputDir, "account_files.csv", [
      ["code", "account_code", "file_description"],
      ["f1", "101", "Alpha"],
      ["f2", "102", "Beta"],
      ["f4", "104", "Drop"],
    ]);
    writeCsv(outputDir, "account_files_blob.csv", [
      ["code", "file_blob"],
      ["f1", "aaaa"],
      ["f2", "bbbb"],
      ["f4", "cccc"],
    ]);
    writeCsv(outputDir, "account_memos.csv", [
      ["account_code", "memo"],
      ["101", "keep"],
      ["104", "drop"],
    ]);
    writeCsv(outputDir, "account_chart.csv", [
      ["account_code", "chart"],
      ["102", "keep"],
      ["104", "drop"],
    ]);
    writeCsv(outputDir, "diary_timetab.csv", [
      ["account_code", "date"],
      ["101", "2024-01-01"],
      ["104", "2024-01-02"],
    ]);
    writeCsv(outputDir, "optic_contact_lens_chk.csv", [
      ["account_code", "contact_presc_code"],
      ["102", "gp2"],
      ["104", "cp4"],
    ]);
    writeCsv(outputDir, "optic_tv_lens_supplier.csv", [
      ["code", "name"],
      ["1", "Supplier A"],
      ["2", "Supplier B"],
    ]);
    writeCsv(outputDir, "random_unused.csv", [
      ["id", "value"],
      ["1", "drop"],
    ]);
    fs.writeFileSync(path.join(outputDir, "manifest.json"), JSON.stringify({ tables: [{ table: "account", data_lines: 4 }] }), "utf8");

    fs.mkdirSync(path.join(documentRoot, "101"), { recursive: true });
    fs.mkdirSync(path.join(documentRoot, "misc"), { recursive: true });
    fs.mkdirSync(path.join(documentRoot, "104"), { recursive: true });
    fs.writeFileSync(path.join(documentRoot, "101", "f1.pdf"), "f1", "utf8");
    fs.writeFileSync(path.join(documentRoot, "misc", "Beta.pdf"), "f2", "utf8");
    fs.writeFileSync(path.join(documentRoot, "104", "f4.pdf"), "f4", "utf8");

    const result = await pruneSoftOpticExport({
      outputDir,
      clientImportLimit: 2,
      includeDocuments: true,
      documentRoot,
    });

    expect(result.selectedClientCount).toBe(2);
    expect(readRows(outputDir, "account.csv").map(row => row.account_code)).toEqual(["101", "102"]);
    expect(readRows(outputDir, "optic_eye_tests.csv").map(row => row.code)).toEqual(["e1", "e2"]);
    expect(readRows(outputDir, "optic_exp_eyetests.csv").map(row => row.code)).toEqual(["e1x"]);
    expect(readRows(outputDir, "optic_presc_prices.csv").map(row => row.presc_code)).toEqual(["cp1", "gp2", "rp2"]);
    expect(readRows(outputDir, "account_files_blob.csv").map(row => row.code)).toEqual(["f1", "f2"]);
    expect(readRows(outputDir, "optic_tv_lens_supplier.csv")).toHaveLength(2);
    expect(readRows(outputDir, "random_unused.csv")).toEqual([]);
    expect(fs.existsSync(path.join(outputDir, "_raw_cp1255"))).toBe(false);
    expect(fs.existsSync(path.join(outputDir, "documents", "101", "f1.pdf"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "documents", "misc", "Beta.pdf"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "documents", "104", "f4.pdf"))).toBe(false);
    expect(result.copiedExternalDocuments).toBe(2);
  });

  test("does not modify export when no limit is set", async () => {
    const outputDir = makeTempDir();
    writeCsv(outputDir, "account.csv", [
      ["account_code", "account_type"],
      ["101", "CUST"],
      ["102", "CUST"],
    ]);
    const before = fs.readFileSync(path.join(outputDir, "account.csv"), "utf8");

    const result = await pruneSoftOpticExport({ outputDir, clientImportLimit: null });

    expect(result.limited).toBe(false);
    expect(fs.readFileSync(path.join(outputDir, "account.csv"), "utf8")).toBe(before);
  });
});
