import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import "@/localization/i18n";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OrderPrescriptionSourceButton } from "@/components/orders/OrderPrescriptionSourceButton";

vi.mock("@/lib/db/orders-db", () => ({
  getOrdersByClientId: async () => [
    { id: 7, order_date: "2026-11-01", type: "Current order", order_data: { "final-prescription": { r_sph: 5 } } },
    { id: 3, order_date: "2026-01-01", type: "Earlier order", order_data: { "final-prescription": { r_sph: -2, l_sph: -1.5, r_pd: 31 } } },
  ],
}));
vi.mock("@/lib/db/exams-db", () => ({ getExamsByClientId: async () => [], getExamPageData: async () => null }));

afterEach(cleanup);

test("fills the whole card from an earlier order and leaves the current order out", async () => {
  const onChange = vi.fn();
  render(
    <TooltipProvider>
      <OrderPrescriptionSourceButton source={{ clientId: 5, orderId: 7 }} kind="glasses" onChange={onChange} />
    </TooltipProvider>,
  );
  await userEvent.click(screen.getByRole("button"));
  const earlier = await screen.findByText("Earlier order");
  expect(screen.queryByText("Current order")).toBeNull();
  await userEvent.click(earlier);
  await waitFor(() => expect(onChange).toHaveBeenCalledWith("r_sph", "-2"));
  expect(onChange).toHaveBeenCalledWith("l_sph", "-1.5");
  expect(onChange).toHaveBeenCalledWith("r_pd_far", "31");
  expect(onChange).toHaveBeenCalledWith("r_cyl", "");
  expect(screen.queryByText("Earlier order")).toBeNull();
});
