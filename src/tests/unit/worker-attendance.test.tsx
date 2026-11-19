import React from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, test, vi } from "vitest";
import WorkerStatsPage from "@/pages/WorkerStatsPage";

const { owner, api, dashboard } = vi.hoisted(() => ({
  owner: { id: 1, full_name: "Clinic owner", role_level: 4, clinic_id: null },
  api: { getUsersByClinic: vi.fn() },
  dashboard: vi.fn(),
}));

vi.mock("@/components/site-header", () => ({ SiteHeader: () => null }));
vi.mock("@/components/attendance/TeamHoursDashboard", () => ({
  TeamHoursDashboard: (props: any) => {
    dashboard(props);
    return <div>team hours</div>;
  },
}));
vi.mock("@/contexts/UserContext", () => ({
  useUser: () => ({ currentUser: owner, currentClinic: { id: 7 } }),
}));
vi.mock("@/lib/api-client", () => ({ apiClient: api }));

test("shows only the team hours, for every worker the viewer may read", async () => {
  api.getUsersByClinic.mockResolvedValue({
    data: [
      { id: 2, full_name: "Clinic viewer", role_level: 1, clinic_id: 7 },
      { id: 3, full_name: "Other clinic", role_level: 1, clinic_id: 9 },
      owner,
    ],
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><WorkerStatsPage /></QueryClientProvider>);

  expect(await screen.findByText("team hours")).toBeVisible();
  const { users, canEditShifts } = dashboard.mock.calls.at(-1)![0];
  expect(users.map((user: { id: number }) => user.id)).toEqual([2, 3, 1]);
  expect(canEditShifts).toBe(true);
  expect(screen.queryByRole("tab")).toBeNull();
  expect(screen.queryByText("משמרות החודש")).toBeNull();
});
