import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "@/localization/i18n";
import translations from "@/localization/opticplus.json";
import { MigrationTab } from "@/components/settings/MigrationTab";
import { OpticPlusMigrationTab } from "@/components/settings/OpticPlusMigrationTab";
import { OpticPlusImportedItems } from "@/components/migration/OpticPlusImportedItems";
import { BillingLineItem } from "@/components/billing/BillingLineItem";

const api = vi.hoisted(() => ({ getMigrationReferenceData: vi.fn(), getMigrationCapabilities: vi.fn(), listMigrationImports: vi.fn(), createMigrationImport: vi.fn(),
  uploadMigrationBundle: vi.fn(), getMigrationImport: vi.fn(), pauseMigrationImport: vi.fn(), resumeMigrationImport: vi.fn(),
  cancelMigrationImport: vi.fn(), getMigrationReportDownload: vi.fn(), getMigrationSourceArchiveDownload: vi.fn(), getMigrationUploadStatus: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ apiClient: api }));
vi.mock("@/components/settings/SoftOpticMigrationTab", () => ({ SoftOpticMigrationTab: () => <div>Existing migration</div> }));

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  api.getMigrationReferenceData.mockResolvedValue({ data: { items: [], total: 0 } });
  api.getMigrationCapabilities.mockResolvedValue({ data: { sources: { opticplus: { enabled: true } } } });
  api.listMigrationImports.mockResolvedValue({ data: [] });
  api.getMigrationUploadStatus.mockResolvedValue(null);
});
afterEach(() => cleanup());

test("total-only source charges do not invent a unit price or quantity", async () => {
  await i18n.changeLanguage("en");
  render(<BillingLineItem item={{ id: 1, billings_id: 1, description: "Source lens amount", line_total: 225, currency: "ILS" }}
    editable={false} open={false} onOpenChange={vi.fn()} onChange={vi.fn()} onDelete={vi.fn()}
    formatCurrency={value => `${value ?? 0} ILS`} formatNumber={value => String(value ?? "")} />);
  expect(screen.getByText("225 ILS")).toBeTruthy();
  expect(screen.queryByText(/×/)).toBeNull();
});

test("reload recovers an upload whose background import already completed", async () => {
  await i18n.changeLanguage("en");
  localStorage.setItem("opticplus-export:1", JSON.stringify({ exported: { zipPath: "temporary.zip", summary: { clients: 2 } } }));
  api.listMigrationImports.mockResolvedValue({ data: [{ id: "recover", status: "awaiting_upload" }] });
  api.getMigrationUploadStatus.mockResolvedValue({ status: "completed" });
  api.getMigrationImport.mockResolvedValue({ data: { id: "recover", status: "completed", progress: 100 } });
  render(<OpticPlusMigrationTab clinicId={1} />);
  await screen.findByText(translations.en.phase.completed);
  expect(localStorage.getItem("opticplus-export:1")).toBeNull();
});

describe.each(["en", "he", "fr"] as const)("OpticPlus %s", locale => {
  test("source selection and imported slots follow the active direction", async () => {
    await i18n.changeLanguage(locale);
    const view = render(<MigrationTab clinicId={1} />);
    const choose = screen.getByText("OpticPlus").closest("button")!;
    fireEvent.click(choose);
    await screen.findByText(translations[locale].title);
    expect(screen.getByText(translations[locale].title).closest('[dir]')?.getAttribute("dir")).toBe(locale === "he" ? "rtl" : "ltr");
    view.unmount();
    render(<OpticPlusImportedItems orderData={{ opticplus_source: { slots: [
      { slot: "1", values: { color: "משקפיים מרחק", amount: "0", ar: false } },
      { slot: "2", values: { color: "מגע", amount: "2" } },
    ] } }} />);
    expect(screen.getByRole("region", { name: translations[locale].items }).getAttribute("dir")).toBe(locale === "he" ? "rtl" : "ltr");
    expect(screen.getByText("0")).toBeTruthy(); expect(screen.getByText(i18n.t("opticplusCards.no"))).toBeTruthy();
    expect(screen.getAllByText(i18n.t("opticplusCards.fields.color"))).toHaveLength(2);
  });
});

test("walks from transferred file through export, existing-lineage update and background completion", async () => {
  await i18n.changeLanguage("en");
  api.listMigrationImports.mockResolvedValue({ data: [{ id: "previous", status: "completed" }] });
  const candidate = { id: "source", dbFile: "C:\\OpticPlus_Data\\optic_dt.accdb", recommended: true, clients: 2, fingerprint: "a".repeat(64) };
  const summary = { clients: 2, exams: 3, orders: 1, sourceFingerprint: candidate.fingerprint, manifest: { client_limit: null } };
  window.electronAPI = { migrationSelectSource: vi.fn().mockResolvedValue("C:\\transfer.zip"),
    migrationScan: vi.fn().mockResolvedValue({ supported: true, candidates: [candidate] }),
    migrationStartExport: vi.fn().mockResolvedValue({ success: true, jobId: "export" }),
    migrationExportStatus: vi.fn().mockResolvedValue({ status: "completed", zipPath: "C:\\temp\\bundle.zip", summary }) } as any;
  api.createMigrationImport.mockResolvedValue({ data: { id: "new", status: "awaiting_upload" } });
  api.uploadMigrationBundle.mockResolvedValue({ success: true, data: { id: "new", status: "queued" } });
  api.getMigrationImport.mockResolvedValue({ data: { id: "new", status: "completed", progress: 100 } });
  render(<OpticPlusMigrationTab clinicId={1} />);
  const choose = await screen.findByRole("button", { name: "Choose ZIP or database" });
  await waitFor(() => expect(choose.hasAttribute("disabled")).toBe(false));
  fireEvent.click(choose);
  await screen.findByText(candidate.dbFile);
  fireEvent.click(screen.getByRole("button", { name: "Prepare transfer" }));
  const start = await screen.findByRole("button", { name: "Validate and import" });
  fireEvent.click(start);
  await screen.findByText(translations.en.phase.completed);
  expect(api.createMigrationImport).toHaveBeenCalledWith(expect.objectContaining({ sourceSystem: "opticplus", previousImportJobId: "previous", sourceFingerprint: candidate.fingerprint }));
  expect(api.uploadMigrationBundle).toHaveBeenCalledWith("new", "C:\\temp\\bundle.zip");
  expect(localStorage.getItem("opticplus-export:1")).toBeNull();
});

test("older server cannot enable an unsupported import", async () => {
  await i18n.changeLanguage("en");
  api.getMigrationCapabilities.mockResolvedValue({ error: "not found" });
  render(<OpticPlusMigrationTab clinicId={1} />);
  await screen.findByText(translations.en.notEnabled);
  expect(screen.getByRole("button", { name: "Scan computer" }).hasAttribute("disabled")).toBe(true);
  expect(api.createMigrationImport).not.toHaveBeenCalled();
});

test("all locale keys match", () => {
  const flatten = (v: Record<string, any>, prefix = ""): string[] => Object.entries(v).flatMap(([k, x]) =>
    typeof x === "object" ? flatten(x, `${prefix}${k}.`) : [`${prefix}${k}`]);
  expect(flatten(translations.he).sort()).toEqual(flatten(translations.en).sort());
  expect(flatten(translations.fr).sort()).toEqual(flatten(translations.en).sort());
});

test('order display uses readable financial labels and avoids duplicated extras and technical flags',async()=>{
  await i18n.changeLanguage('en');
  render(<OpticPlusImportedItems orderData={{opticplus_source:{slots:[{slot:'1',values:{color:'Glasses',amount:'0',ar:false,alut:'0'}}],
    context:{gf_price:'340',othp1:'12',swh:false},extras:{othp1:'12'}}}} />);
  expect(screen.getByText('Final total')).toBeTruthy();
  expect(screen.getAllByText('12')).toHaveLength(1);
  expect(screen.queryByText(/swh|alut/)).toBeNull();
});
