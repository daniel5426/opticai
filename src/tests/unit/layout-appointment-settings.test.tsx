import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "@/localization/i18n";
import { LayoutAppointmentDurations } from "@/components/settings/LayoutAppointmentDurations";
import { apiClient } from "@/lib/api-client";

vi.mock("@/contexts/UserContext", () => ({ useUser: () => ({ currentClinic: { id: 1 } }) }));
vi.mock("@/lib/db/exam-layouts-db", () => ({
  getAllExamLayouts: async () => [{ id: 1, name: "Synthetic exam", layout_data: "{}", appointment_duration: 45 }],
}));
vi.mock("@/lib/api-client", () => ({ apiClient: { updateExamLayout: vi.fn() } }));

beforeEach(() => {
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe.each(["he", "en", "fr"])("layout duration settings in %s", (locale) => {
  test("localizes the direction, choices and save failure without losing the saved duration", async () => {
    await i18n.changeLanguage(locale);
    vi.mocked(apiClient.updateExamLayout).mockRejectedValueOnce(new Error("Network unavailable"));
    render(<LayoutAppointmentDurations defaultDuration={30} />);
    const trigger = await screen.findByRole("combobox", { name: "Synthetic exam" });
    expect(trigger.getAttribute("dir")).toBe(locale === "he" ? "rtl" : "ltr");
    expect(screen.getByText(i18n.t("layoutDuration.title"))).toBeTruthy();
    expect(trigger.textContent).toContain(i18n.t("layoutDuration.minutes", { minutes: 45 }));
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("option", { name: i18n.t("layoutDuration.default", { minutes: 30 }) }));
    await waitFor(() => expect(apiClient.updateExamLayout).toHaveBeenLastCalledWith(1, { appointment_duration: null }));
    await waitFor(() => expect(trigger.textContent).toContain(i18n.t("layoutDuration.minutes", { minutes: 45 })));
    expect(trigger).toBeEnabled();
  });
});
