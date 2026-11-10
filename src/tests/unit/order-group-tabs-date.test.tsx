import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { OrderGroupTabs } from "@/components/order-groups/OrderGroupChrome";

describe("order tabs", () => {
  test("show each order's date without opening its menu", () => {
    render(
      <OrderGroupTabs
        entries={[{ key: "a", client: { first_name: "A" } as any, label: "Glasses order", values: { order_date: "2026-02-23" } }]}
        activeKey="a"
        editing={false}
        addDisabled={false}
        direction="rtl"
        onSelect={vi.fn()}
        onReorder={vi.fn()}
        onRemove={vi.fn()}
        onMetadataChange={vi.fn()}
        onAdd={vi.fn()}
      />,
    );
    expect(screen.getByRole("tab").textContent).toContain("23/02/2026");
  });
});
