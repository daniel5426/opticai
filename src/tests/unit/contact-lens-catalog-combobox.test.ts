import { describe, expect, it } from "vitest";

import {
  contactLensCatalogFieldOptions,
  contactLensCatalogSuggestions,
} from "@/components/inventory/ContactLensCatalogCombobox";
import { CatalogVariant } from "@/lib/inventory";

const contactLens = ({
  id,
  model,
  material,
  sph,
  bc,
  brand = "CooperVision",
}: {
  id: number;
  model: string;
  material: string;
  sph: number;
  bc: number;
  brand?: string;
}): CatalogVariant => ({
  id,
  company_id: 1,
  product_id: id,
  display_name: `${brand} ${model}`,
  attributes: { sph, bc, dia: 14.2, color: "Clear" },
  currency: "ILS",
  is_stockable: true,
  product: {
    id,
    company_id: 1,
    category: "contact_lens",
    brand,
    model,
    product_type: "Monthly",
    preferred_supplier: "Lens Supply",
    material,
  },
});

const variants = [
  contactLens({
    id: 1,
    model: "Biofinity",
    material: "Silicone",
    sph: -2,
    bc: 8.6,
  }),
  contactLens({
    id: 2,
    model: "Proclear",
    material: "Hydrogel",
    sph: -2,
    bc: 8.6,
  }),
  contactLens({
    id: 3,
    model: "MyDay",
    material: "Silicone",
    sph: -1.5,
    bc: 8.4,
    brand: "Alcon",
  }),
];

describe("contact-lens catalog combobox", () => {
  it("filters product suggestions using identity and prescription values", () => {
    expect(
      contactLensCatalogSuggestions(variants, {
        material: "Silicone",
        sph: "-2.00",
        bc: "8.60",
      }).map((variant) => variant.id),
    ).toEqual([1]);
  });

  it("derives field options from all other entered values", () => {
    expect(
      contactLensCatalogFieldOptions(
        variants,
        { material: "Silicone", sph: -2 },
        "model",
      ),
    ).toEqual(["Biofinity"]);
  });

  it("uses manufacturer as shared catalog context", () => {
    expect(
      contactLensCatalogFieldOptions(
        variants,
        { manufacturer: "CooperVision" },
        "model",
      ),
    ).toEqual(["Biofinity", "Proclear"]);
  });

  it("keeps suggestions available while the active field contains partial text", () => {
    expect(
      contactLensCatalogSuggestions(
        variants,
        { model: "Bio", sph: -2 },
        "model",
      ).map((variant) => variant.id),
    ).toEqual([1, 2]);
  });
});
