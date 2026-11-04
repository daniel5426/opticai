import React from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import i18n from "@/localization/i18n";
import { SoftOpticOcularMotTab } from "@/components/exam/SoftOpticOcularMotTab";
import { SoftOpticRgTab } from "@/components/exam/SoftOpticRgTab";

vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
afterEach(cleanup);

describe("SoftOptic Bino cards", () => {
  test("Ocular Mot. row shows ACC R / L and CNP", async () => {
    await i18n.changeLanguage("en");
    render(
      <SoftOpticOcularMotTab
        data={{ layout_instance_id: 1, acc_r: 21, acc_l: 222, cnp_cm: 1, cnp_eye: "R" }}
        onChange={vi.fn()}
        isEditing={false}
      />,
    );
    expect(screen.getByText("Ocular Mot.")).toBeTruthy();
    expect(screen.getByText("ACC")).toBeTruthy();
    expect(screen.getByDisplayValue("21")).toBeTruthy();
    expect(screen.getByDisplayValue("222")).toBeTruthy();
  });

  test("R/G shows the diplopia selection and its prism", async () => {
    await i18n.changeLanguage("he");
    render(
      <SoftOpticRgTab
        data={{ layout_instance_id: 1, rg_status: "diplopia", pr_h: 2, base_h: "In", pr_v: 3, base_v: "UPR" }}
        onChange={vi.fn()}
        isEditing={false}
      />,
    );
    expect(screen.getByText("כפל ראייה")).toBeTruthy();
    const values = Array.from(document.querySelectorAll("input")).map((input) => input.value);
    expect(values.some((value) => /^2(\.0+)?$/.test(value))).toBe(true);
    expect(values.some((value) => /^3(\.0+)?$/.test(value))).toBe(true);
  });
});
