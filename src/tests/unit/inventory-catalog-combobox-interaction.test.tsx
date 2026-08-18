import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  catalogProductName,
  InventoryCatalogCombobox,
  rankCatalogLookupOptions,
} from "@/components/inventory/InventoryCatalogCombobox";
import {
  canCreateFrameCatalogProduct,
  hasMatchingFrameCatalogVariant,
} from "@/components/inventory/FrameCatalogCombobox";
import { CatalogVariant } from "@/lib/inventory";
import i18n from "@/localization/i18n";

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

  it("only enables frame creation for a complete, non-duplicate variant", () => {
    const values = {
      manufacturer: "Ray-Ban",
      model: "RX 5228",
      color: "Black",
      width: 50,
    };
    const existingFrame: CatalogVariant = {
      ...variant(3, "RX 5228"),
      product: {
        ...variant(3, "RX 5228").product,
        category: "frame",
        brand: "Ray-Ban",
      },
      attributes: { color: "Black", eye_size: 50 },
    };

    expect(canCreateFrameCatalogProduct(values)).toBe(true);
    expect(hasMatchingFrameCatalogVariant([existingFrame], values)).toBe(true);
    expect(
      canCreateFrameCatalogProduct({ ...values, color: "", width: undefined }),
    ).toBe(false);
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

  it("mounts its dropdown within a supplied dialog boundary", async () => {
    const user = userEvent.setup();
    const portalContainer = document.createElement("div");
    document.body.append(portalContainer);

    render(
      <InventoryCatalogCombobox
        lookupType="contactLensModel"
        lookupLabel="דגמי עדשות מגע"
        value=""
        placeholder="דגם"
        catalogOptions={[]}
        suggestions={[variant(1, "Biofinity")]}
        portalContainer={portalContainer}
        onChange={vi.fn()}
        onSelectProduct={vi.fn()}
      />,
    );

    await user.click(screen.getByPlaceholderText("דגם"));

    expect(
      portalContainer.contains(
        await within(portalContainer).findByText("Biofinity"),
      ),
    ).toBe(true);

    portalContainer.remove();
  });

  it("offers the configured product creation action from the catalog section", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    render(
      <InventoryCatalogCombobox
        lookupType="frameModel"
        lookupLabel="דגמי מסגרות"
        value="Aviator"
        placeholder="דגם"
        catalogOptions={[]}
        suggestions={[]}
        createProduct={{ name: "Ray-Ban Aviator", onCreate }}
        onChange={vi.fn()}
        onSelectProduct={vi.fn()}
      />,
    );

    await user.click(screen.getByPlaceholderText("דגם"));
    await user.click(
      await screen.findByRole("button", {
        name: "Add Ray-Ban Aviator as a new product",
      }),
    );

    expect(onCreate).toHaveBeenCalledOnce();
  });

  it("uses the active locale direction for the input and portal", async () => {
    const user = userEvent.setup();
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    render(
      <InventoryCatalogCombobox
        lookupType="frameModel"
        lookupLabel="Frame models"
        value=""
        placeholder="Model"
        catalogOptions={[]}
        suggestions={[]}
        onChange={vi.fn()}
        onSelectProduct={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText("Model");
    await waitFor(() => {
      expect(input).toHaveAttribute("dir", "ltr");
    });

    await act(async () => {
      await i18n.changeLanguage("he");
    });
    await waitFor(() => {
      expect(input).toHaveAttribute("dir", "rtl");
    });

    await user.click(input);
    expect(
      (await screen.findByLabelText("Frame models")).closest("[dir]"),
    ).toHaveAttribute("dir", "rtl");
  });
});
