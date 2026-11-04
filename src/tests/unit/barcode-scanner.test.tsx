import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import i18n from "@/localization/i18n";
import { BarcodeScanButton, ProductBarcodeScan } from "@/components/inventory/BarcodeScanButton";
import { BarcodeScannerPreferences } from "@/components/settings/BarcodeScannerPreferences";
import { barcodePreferenceKey } from "@/hooks/use-barcode-scanner";

const { lookup } = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ apiClient: { getInventoryVariants: lookup } }));
const variant = { id: 7, barcode: "0012345", product: { category: "frame" }, balance: { available: 2 } };
beforeEach(async () => { localStorage.clear(); vi.clearAllMocks(); await i18n.changeLanguage("en"); });
afterEach(cleanup);
function enable() { localStorage.setItem(barcodePreferenceKey(1), "true"); }
async function scan(code = "0012345", key = "Enter") {
  fireEvent.click(screen.getByRole("button", { name: "Scan barcode" }));
  const field = await screen.findByRole("textbox", { name: "Barcode" });
  fireEvent.change(field, { target: { value: code } });
  await act(async () => { fireEvent.keyDown(field, { key }); });
}

test("is opt-in and updates scan controls immediately when the device preference changes", () => {
  render(<><BarcodeScannerPreferences /><BarcodeScanButton onScan={vi.fn()} /></>);
  expect(screen.queryByRole("button", { name: "Scan barcode" })).toBeNull();
  fireEvent.click(screen.getByRole("switch"));
  expect(localStorage.getItem(barcodePreferenceKey(1))).toBe("true");
  expect(screen.getByRole("button", { name: "Scan barcode" })).toBeVisible();
  fireEvent.click(screen.getByRole("switch"));
  expect(screen.queryByRole("button", { name: "Scan barcode" })).toBeNull();
});

test.each([["he", "rtl"], ["en", "ltr"], ["fr", "ltr"]])("localizes scanner settings and dialog in %s", async (locale, direction) => {
  await i18n.changeLanguage(locale); enable();
  render(<><BarcodeScannerPreferences /><BarcodeScanButton onScan={vi.fn()} /></>);
  fireEvent.click(screen.getByRole("button", { name: i18n.t("barcode.scan") }));
  expect(screen.getByRole("dialog")).toHaveAttribute("dir", direction);
  expect(screen.getByRole("textbox", { name: i18n.t("barcode.code") })).toHaveAttribute("dir", "ltr");
  expect(screen.getByRole("textbox")).toHaveFocus();
});

test.each(["Enter", "Tab"])("uses an exact clinic/category barcode lookup with %s without submitting the parent form", async key => {
  enable(); lookup.mockResolvedValue({ data: { items: [variant] } });
  const select = vi.fn(), submit = vi.fn();
  render(<form onSubmit={submit}><ProductBarcodeScan clinicId={3} category="frame" orderId={5} orderKind="regular" stockableOnly onSelect={select} /></form>);
  await scan("0012345", key);
  await waitFor(() => expect(select).toHaveBeenCalledWith(variant));
  expect(lookup).toHaveBeenCalledWith(3, { barcode: "0012345", category: "frame", orderId: 5, orderKind: "regular", stockableOnly: true });
  expect(submit).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).toBeNull();
});

test.each([
  [[], "No active product matches"],
  [[{ ...variant, barcode: "10012345" }], "No active product matches"],
  [[{ ...variant, archived_at: "2026-01-01" }], "No active product matches"],
  [[variant, { ...variant, id: 8 }], "More than one product"],
])("does not select missing, partial, archived or ambiguous matches", async (items, message) => {
  enable(); lookup.mockResolvedValue({ data: { items } }); const select = vi.fn();
  render(<ProductBarcodeScan clinicId={3} onSelect={select} />);
  await scan();
  expect(await screen.findByRole("alert")).toHaveTextContent(message);
  expect(select).not.toHaveBeenCalled();
});

test("canceling a pending lookup prevents a late product selection", async () => {
  enable(); let resolve: (value: unknown) => void;
  lookup.mockImplementation(() => new Promise(done => { resolve = done; }));
  const select = vi.fn(); render(<ProductBarcodeScan clinicId={3} onSelect={select} />);
  await scan(); fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await act(async () => { resolve!({ data: { items: [variant] } }); });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(select).not.toHaveBeenCalled();
});

test("continuous counts accept repeated scans and retain leading zeros", async () => {
  enable(); const receive = vi.fn(); render(<BarcodeScanButton keepOpen onScan={receive} />);
  await scan();
  await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue(""));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "0012345" } });
  await act(async () => { fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" }); });
  await waitFor(() => expect(receive).toHaveBeenCalledTimes(2));
  expect(receive.mock.calls.map(call => call[0])).toEqual(["0012345", "0012345"]);
  expect(screen.getByRole("status")).toHaveTextContent("0012345");
});
