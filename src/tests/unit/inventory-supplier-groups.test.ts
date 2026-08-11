import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  CatalogVariant,
  InventorySupplierGroup,
  UNASSIGNED_INVENTORY_SUPPLIER_KEY,
  filterInventoryVariantsBySupplier,
  groupInventoryVariantsBySupplier,
  inventorySupplierKey,
} from "@/lib/inventory";
import { SupplierCards } from "@/pages/InventoryPage";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);

const variant = (
  id: number,
  preferredSupplier?: string | null,
): CatalogVariant => ({
  id,
  company_id: 1,
  product_id: id,
  display_name: `Product ${id}`,
  attributes: {},
  currency: "ILS",
  is_stockable: true,
  product: {
    id,
    company_id: 1,
    category: "frame",
    model: `Model ${id}`,
    preferred_supplier: preferredSupplier,
  },
});

describe("inventory supplier groups", () => {
  it("groups trimmed supplier names without hiding unassigned products", () => {
    const groups = groupInventoryVariantsBySupplier([
      variant(1, " Optic Supply "),
      variant(2, "optic supply"),
      variant(3, null),
      variant(4, ""),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      key: "optic supply",
      label: "Optic Supply",
      isUnassigned: false,
    });
    expect(groups[0].variants.map((item) => item.id)).toEqual([1, 2]);
    expect(groups[1]).toMatchObject({
      key: UNASSIGNED_INVENTORY_SUPPLIER_KEY,
      label: "ללא ספק",
      isUnassigned: true,
    });
    expect(groups[1].variants.map((item) => item.id)).toEqual([3, 4]);
  });

  it("filters the existing filtered variant set by a selected supplier", () => {
    const alreadyFiltered = [variant(1, "Optic Supply"), variant(2, "Zeiss")];

    expect(
      filterInventoryVariantsBySupplier(
        alreadyFiltered,
        inventorySupplierKey(" optic supply "),
      ).map((item) => item.id),
    ).toEqual([1]);
    expect(
      filterInventoryVariantsBySupplier(
        alreadyFiltered,
        UNASSIGNED_INVENTORY_SUPPLIER_KEY,
      ),
    ).toEqual([]);
  });

  it("selects a supplier card and only offers quick add for assigned suppliers", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onCreate = vi.fn();
    const groups: InventorySupplierGroup[] = [
      {
        key: "optic supply",
        label: "Optic Supply",
        variants: [variant(1, "Optic Supply")],
        isUnassigned: false,
      },
      {
        key: UNASSIGNED_INVENTORY_SUPPLIER_KEY,
        label: "ללא ספק",
        variants: [variant(2)],
        isUnassigned: true,
      },
    ];

    render(
      React.createElement(SupplierCards, {
        groups,
        page: 1,
        pageSize: 12,
        onPageChange: vi.fn(),
        loading: false,
        canWrite: true,
        onSelect,
        onCreate,
      }),
    );

    await user.click(
      screen.getByRole("button", { name: "הצג פריטים של Optic Supply" }),
    );
    expect(onSelect).toHaveBeenCalledWith({
      key: "optic supply",
      label: "Optic Supply",
    });

    await user.click(
      screen.getByRole("button", { name: "הוסף פריט עבור Optic Supply" }),
    );
    expect(onCreate).toHaveBeenCalledWith("Optic Supply");
    expect(
      screen.queryByRole("button", { name: "הוסף פריט עבור ללא ספק" }),
    ).not.toBeInTheDocument();
  });
});
