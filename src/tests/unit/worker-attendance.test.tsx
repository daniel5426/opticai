import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, test, vi } from "vitest";
import i18n from "@/localization/i18n";
import WorkerStatsPage from "@/pages/WorkerStatsPage";

const { owner, api } = vi.hoisted(() => ({
  owner: { id: 1, full_name: "Clinic owner", role_level: 4, clinic_id: null },
  api: {
    getUsersByClinic: vi.fn(),
    getWorkShiftsByUserAndDate: vi.fn(),
    getWorkShiftStats: vi.fn(),
  },
}));

vi.mock("@/components/site-header", () => ({ SiteHeader: () => null }));
vi.mock("@/components/attendance/TeamHoursDashboard", () => ({ TeamHoursDashboard: () => null }));
vi.mock("@/contexts/UserContext", () => ({
  useUser: () => ({ currentUser: owner, currentClinic: { id: 7 } }),
}));
vi.mock("@/lib/api-client", () => ({ apiClient: api }));

test("lists every clinic role with the month's totals, and no day view", async () => {
  await i18n.changeLanguage("en");
  api.getUsersByClinic.mockResolvedValue({
    data: [{ id: 2, full_name: "Clinic viewer", role_level: 1, clinic_id: 7 }, owner],
  });
  api.getWorkShiftStats.mockResolvedValue({ data: { total_shifts: 1, total_minutes: 457 } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><WorkerStatsPage /></QueryClientProvider>);

  expect(await screen.findByRole("tab", { name: /Clinic viewer/ })).toBeVisible();
  fireEvent.click(screen.getByRole("tab", { name: /Clinic owner Owner/ }));
  expect(await screen.findByText("7:37")).toBeVisible();
  // The team hours at the top show each day's shifts, so the page no longer reads a single day.
  expect(screen.queryByText("צפייה לפי יום")).toBeNull();
  expect(api.getWorkShiftsByUserAndDate).not.toHaveBeenCalled();
});
