import React from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, test, vi } from "vitest";
import WorkerStatsPage from "@/pages/WorkerStatsPage";

const { owner, api, dashboard, viewer } = vi.hoisted(() => ({
  owner: { id: 1, full_name: "Clinic owner", role_level: 4, clinic_id: null },
  api: { getUsersByClinic: vi.fn() },
  dashboard: vi.fn(),
  viewer: { currentUser: {} },
}));

vi.mock("@/components/site-header", () => ({ SiteHeader: () => null }));
vi.mock("@/components/attendance/TeamHoursDashboard", () => ({
  TeamHoursDashboard: (props: any) => {
    dashboard(props);
    return <div>team hours</div>;
  },
}));
vi.mock("@/contexts/UserContext", () => ({
  useUser: () => ({ currentUser: viewer.currentUser, currentClinic: { id: 7 } }),
}));
vi.mock("@/lib/api-client", () => ({ apiClient: api }));

test.each([
  [4, true, true, [2, 3, 1]],
  [3, true, false, [2, 1]],
  [2, false, false, [1]],
  [1, false, false, [1]],
])("shows the team's permitted workers and actions for role %i", async (role, canManage, canEdit, expectedIds) => {
  viewer.currentUser = role === 4 ? owner : { ...owner, role_level: role, clinic_id: 7 };
  api.getUsersByClinic.mockResolvedValue({
    data: [
      { id: 2, full_name: "Clinic viewer", role_level: 1, clinic_id: 7 },
      { id: 3, full_name: "Other clinic", role_level: 1, clinic_id: 9 },
      viewer.currentUser,
    ],
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><WorkerStatsPage /></QueryClientProvider>);

  expect(await screen.findByText("team hours")).toBeVisible();
  const { users, canEditShifts, canManageShifts } = dashboard.mock.calls.at(-1)![0];
  expect(users.map((user: { id: number }) => user.id)).toEqual(expectedIds);
  expect(canEditShifts).toBe(canEdit);
  expect(canManageShifts).toBe(canManage);
  expect(screen.queryByRole("tab")).toBeNull();
  expect(screen.queryByText("משמרות החודש")).toBeNull();
});
