import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import i18n from "@/localization/i18n";
import { TeamHoursDashboard, formatDuration, presetRange } from "@/components/attendance/TeamHoursDashboard";

const api = vi.hoisted(() => ({
  getTeamWorkSummary: vi.fn(), getWorkShiftsByUserAndRange: vi.fn(), updateWorkShift: vi.fn(),
  createWorkShift: vi.fn(), deleteWorkShift: vi.fn(),
}));
vi.mock("@/lib/api-client", () => ({ apiClient: api }));

Element.prototype.hasPointerCapture = () => false;
Element.prototype.scrollIntoView = vi.fn();

const users = [
  { id: 1, username: "dana", full_name: "Dana" },
  { id: 2, username: "eli", full_name: "Eli" },
  { id: 3, username: "noa", full_name: "Noa" },
] as any[];

beforeEach(async () => {
  await i18n.changeLanguage("he");
  api.getTeamWorkSummary.mockResolvedValue({
    data: [
      { user_id: 1, total_minutes: 300, shifts: 1, active_days: 1, open_shifts: 0 },
      { user_id: 2, total_minutes: 1032, shifts: 4, active_days: 3, open_shifts: 0 },
      { user_id: 3, total_minutes: 0, shifts: 0, active_days: 0, open_shifts: 0 },
    ],
  });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const renderDashboard = (canEditShifts = false, canManageShifts = canEditShifts) =>
  render(<QueryClientProvider client={new QueryClient()}><TeamHoursDashboard users={users} canEditShifts={canEditShifts} canManageShifts={canManageShifts} /></QueryClientProvider>);

test("ranges start on the first of the month by default", () => {
  const today = new Date(2026, 10, 14);
  expect(presetRange("thisMonth", today)).toEqual({ from: "2026-11-01", to: "2026-11-14" });
  expect(presetRange("lastMonth", today)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
  expect(presetRange("thisYear", today)).toEqual({ from: "2026-01-01", to: "2026-11-14" });
  // Hours and minutes carry their units, so 23 minutes never reads as 23 hours.
  expect(formatDuration(i18n.t, 1032)).toBe("17 ש׳ 12 ד׳");
  expect(formatDuration(i18n.t, 23)).toBe("23 ד׳");
  expect(formatDuration(i18n.t, 120)).toBe("2 ש׳");
});

test("lists who worked most first, totals the team, and folds the idle workers", async () => {
  renderDashboard();
  expect(api.getTeamWorkSummary).toHaveBeenCalledWith([1, 2, 3], presetRange("thisMonth").from, presetRange("thisMonth").to);
  const workers = await screen.findAllByRole("button", { name: /הצג את המשמרות של/ });
  expect(workers.map((button) => button.getAttribute("aria-label"))).toEqual(["הצג את המשמרות של Eli", "הצג את המשמרות של Dana"]);
  expect(screen.getByLabelText("22 ש׳ 12 ד׳")).toBeInTheDocument();
  expect(screen.getByText("2/3")).toBeInTheDocument();
  expect(screen.getByText("4 משמרות · 3 ימי עבודה")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "הצג עובד אחד ללא משמרות" }));
  expect(screen.getByText("אין משמרות בתקופה")).toBeInTheDocument();

});

test("a worker's row opens their shifts in the period, with hours and length", async () => {
  api.getWorkShiftsByUserAndRange.mockResolvedValue({
    data: [
      { id: 1, user_id: 2, date: "2026-11-03", start_time: "08:59", end_time: "14:03", duration_minutes: 304, status: "completed" },
      { id: 2, user_id: 2, date: "2026-11-03", start_time: "16:00", end_time: "18:00", duration_minutes: 120, status: "completed" },
      { id: 3, user_id: 2, date: "2026-11-04", start_time: "09:00", end_time: null, duration_minutes: null, status: "active" },
    ],
  });
  renderDashboard();
  const row = await screen.findByRole("button", { name: "הצג את המשמרות של Eli" });
  expect(row).toHaveAttribute("aria-expanded", "false");
  await userEvent.click(row);
  expect(row).toHaveAttribute("aria-expanded", "true");
  const { from, to } = presetRange("thisMonth");
  expect(api.getWorkShiftsByUserAndRange).toHaveBeenCalledWith(2, from, to);
  expect(await screen.findByText("08:59")).toBeInTheDocument();
  expect(screen.getByText("14:03")).toBeInTheDocument();
  expect(screen.getByLabelText("5 ש׳ 4 ד׳")).toBeInTheDocument();
  expect(screen.getByText("עכשיו")).toBeInTheDocument();
  // A worker with no shifts has nothing to open.
  await userEvent.click(screen.getByRole("button", { name: "הצג עובד אחד ללא משמרות" }));
  expect(screen.getByRole("button", { name: "הצג את המשמרות של Noa" })).toBeDisabled();
});

test("a preset changes the period the team is summed over", async () => {
  renderDashboard();
  await screen.findByLabelText("22 ש׳ 12 ד׳");
  await userEvent.click(screen.getByRole("button", { name: "החודש הקודם" }));
  const { from, to } = presetRange("lastMonth");
  await waitFor(() => expect(api.getTeamWorkSummary).toHaveBeenLastCalledWith([1, 2, 3], from, to));
  expect(screen.getByRole("button", { name: "החודש הקודם" })).toHaveAttribute("aria-pressed", "true");
});

test("a CEO edits a shift's hours from the list; others get no pencil", async () => {
  api.getWorkShiftsByUserAndRange.mockResolvedValue({
    data: [{ id: 7, user_id: 2, date: "2026-11-03", start_time: "08:59", end_time: "14:03", duration_minutes: 304, status: "completed" }],
  });
  api.updateWorkShift.mockResolvedValue({ data: {} });
  const view = renderDashboard();
  await userEvent.click(await screen.findByRole("button", { name: "הצג את המשמרות של Eli" }));
  await screen.findByText("08:59");
  expect(screen.queryByRole("button", { name: "עריכת משמרת" })).toBeNull();
  expect(screen.queryByRole("button", { name: "הוספת משמרת" })).toBeNull();
  expect(screen.queryByRole("button", { name: "מחיקת משמרת" })).toBeNull();
  view.unmount();

  renderDashboard(true);
  await userEvent.click(await screen.findByRole("button", { name: "הצג את המשמרות של Eli" }));
  await userEvent.click(await screen.findByRole("button", { name: "עריכת משמרת" }));
  const end = screen.getByLabelText("שעת סיום");
  await userEvent.clear(end);
  await userEvent.type(end, "15:00");
  expect(screen.getByLabelText("6 ש׳ 1 ד׳")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "שמירה" }));
  await waitFor(() => expect(api.updateWorkShift).toHaveBeenCalledWith(7, { start_time: "08:59", end_time: "15:00", duration_minutes: 361 }));
});

test.each([
  ["he", "rtl", "הוספת משמרת", "מחיקת משמרת"],
  ["en", "ltr", "Add shift", "Delete shift"],
  ["fr", "ltr", "Ajouter un poste", "Supprimer le poste"],
])("a manager can add and delete a shift in %s", async (locale, direction, addLabel, deleteLabel) => {
  await i18n.changeLanguage(locale);
  const date = presetRange("thisMonth").to;
  const shift = { id: 8, user_id: 3, date, start_time: "22:00", end_time: "06:00", duration_minutes: 480, status: "completed" };
  api.createWorkShift.mockImplementation(async () => {
    api.getTeamWorkSummary.mockResolvedValue({
      data: [{ user_id: 3, total_minutes: 480, shifts: 1, active_days: 1, open_shifts: 0 }],
    });
    return { data: shift };
  });
  api.getWorkShiftsByUserAndRange.mockResolvedValue({ data: [shift] });
  api.deleteWorkShift.mockImplementation(async () => {
    api.getWorkShiftsByUserAndRange.mockResolvedValue({ data: [] });
    api.getTeamWorkSummary.mockResolvedValue({
      data: [{ user_id: 3, total_minutes: 0, shifts: 0, active_days: 0, open_shifts: 0 }],
    });
    return { data: {} };
  });

  renderDashboard(false, true);
  await userEvent.click(screen.getByRole("button", { name: addLabel }));
  const addDialog = await screen.findByRole("dialog", { name: addLabel });
  expect(addDialog).toHaveAttribute("dir", direction);
  const save = within(addDialog).getByRole("button", { name: i18n.t("teamHoursSave") });
  expect(save).toBeDisabled();
  await userEvent.click(within(addDialog).getByRole("combobox", { name: i18n.t("teamHoursWorker") }));
  await userEvent.click(await screen.findByRole("option", { name: "Noa" }));
  fireEvent.change(within(addDialog).getByLabelText(i18n.t("teamHoursStart")), { target: { value: "22:00" } });
  fireEvent.change(within(addDialog).getByLabelText(i18n.t("teamHoursEnd")), { target: { value: "06:00" } });
  await userEvent.click(save);
  const { id, ...payload } = shift;
  expect(api.createWorkShift).toHaveBeenCalledWith(payload);
  await userEvent.click(await screen.findByRole("button", { name: i18n.t("teamHoursShowShifts", { name: "Noa" }) }));
  expect(await screen.findByText("22:00")).toBeVisible();
  expect(screen.queryByRole("button", { name: i18n.t("teamHoursEditShift") })).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: deleteLabel }));
  const deleteDialog = await screen.findByRole("dialog", { name: deleteLabel });
  expect(deleteDialog).toHaveAttribute("dir", direction);
  expect(api.deleteWorkShift).not.toHaveBeenCalled();
  await userEvent.click(within(deleteDialog).getByRole("button", { name: i18n.t("teamHoursDelete") }));
  await waitFor(() => expect(api.deleteWorkShift).toHaveBeenCalledWith(id));
  await waitFor(() => expect(screen.queryByText("22:00")).not.toBeInTheDocument());
});
