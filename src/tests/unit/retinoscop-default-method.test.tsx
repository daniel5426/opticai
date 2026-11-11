import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import i18n from "@/localization/i18n";
import { RetinoscopTab } from "@/components/exam/RetinoscopTab";
import { inputSyncManager } from "@/components/exam/shared/OptimizedInputs";

afterEach(cleanup);

const selected = () => screen.getByRole("tab", { selected: true }).textContent;

test("a new card opens on the autorefractor and saves it with the first value", async () => {
  await i18n.changeLanguage("he");
  const onChange = vi.fn();
  render(<RetinoscopTab retinoscopData={{ layout_instance_id: 1 } as any} onRetinoscopChange={onChange} isEditing />);
  expect(selected()).toBe(i18n.t("examAutoRefractor"));
  const input = document.querySelector("input")!;
  fireEvent.input(input, { target: { value: "-1.00" } });
  fireEvent.change(input, { target: { value: "-1.00" } });
  inputSyncManager.flush();
  expect(onChange.mock.calls[0]).toEqual(["method", "auto_refractor"]);
  expect(onChange).toHaveBeenCalledTimes(2);
});

test("an older card with values and no saved method stays a retinoscopy", async () => {
  await i18n.changeLanguage("he");
  render(<RetinoscopTab retinoscopData={{ layout_instance_id: 1, r_sph: -1 } as any} onRetinoscopChange={vi.fn()} isEditing />);
  expect(selected()).toBe(i18n.t("examRetinoscopy"));
});

test("a saved method is kept", async () => {
  await i18n.changeLanguage("he");
  render(<RetinoscopTab retinoscopData={{ layout_instance_id: 1, method: "retinoscopy" } as any} onRetinoscopChange={vi.fn()} isEditing />);
  expect(selected()).toBe(i18n.t("examRetinoscopy"));
});
