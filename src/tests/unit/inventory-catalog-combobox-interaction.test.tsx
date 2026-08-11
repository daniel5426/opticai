import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  catalogProductName,
  InventoryCatalogCombobox,
  rankCatalogLookupOptions,
} from "@/components/inventory/InventoryCatalogCombobox";
import { CatalogVariant } from "@/lib/inventory";

vi.mock("@/hooks/useLookupData", () => ({
  useLookupData: () => ({
    data: [],
    loading: false,
    createItem: vi.fn(),
    isCreating: false,
  }),
}));

const variant = (id: number, model: string): CatalogVariant => ({
  id,
  company_id: 1,
  product_id: id,
  display_name: model,
  attributes: {},
  currency: "ILS",
  is_stockable: true,
  product: {
    id,
    company_id: 1,
    category: "contact_lens",
    model,
  },
});

describe("inventory catalog combobox interaction", () => {
  it("ranks values that match the entered product combination first", () => {
    expect(
      rankCatalogLookupOptions(["Blue", "Black", "Gold"], ["Black", "Gold"]),
    ).toEqual(["Black", "Gold", "Blue"]);
  });

  it("keeps variant details out of the primary product label", () => {
    expect(
      catalogProductName({
        ...variant(1, "RB-01 Black / 52"),
        product: {
          ...variant(1, "RB-01 Black / 52").product,
          brand: "Ray-Ban",
          model: "RB-01",
        },
      }),
    ).toBe("Ray-Ban RB-01");
  });

  it("uses an existing input value when the dropdown first opens", async () => {
    const user = userEvent.setup();
    render(
      <InventoryCatalogCombobox
        lookupType="contactLensModel"
        lookupLabel="דגמי עדשות מגע"
        value="Biofinity"
        placeholder="דגם"
        catalogOptions={[]}
        suggestions={[variant(1, "Biofinity"), variant(2, "Proclear")]}
        onChange={vi.fn()}
        onSelectProduct={vi.fn()}
      />,
    );

    await user.click(screen.getByPlaceholderText("דגם"));

    expect(await screen.findByText("Biofinity")).toBeInTheDocument();
    expect(screen.queryByText("Proclear")).not.toBeInTheDocument();
  });
});
