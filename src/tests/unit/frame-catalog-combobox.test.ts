import { describe, expect, it } from "vitest";

import {
  combinedFrameFieldOptions,
  frameCatalogSuggestions,
} from "@/components/inventory/FrameCatalogCombobox";
import { CatalogVariant } from "@/lib/inventory";

const frame = ({
  id,
  supplier,
  brand,
  model,
  color,
  width,
  barcode,
}: {
  id: number;
  supplier: string;
  brand: string;
  model: string;
  color: string;
  width: number;
  barcode?: string;
}): CatalogVariant => ({
  id,
  company_id: 1,
  product_id: id,
  display_name: `${brand} ${model} ${color}`,
  attributes: { color, eye_size: width },
  sku: `FRAME-${id}`,
  barcode,
  currency: "ILS",
  is_stockable: true,
  product: {
    id,
    company_id: 1,
    category: "frame",
    preferred_supplier: supplier,
    brand,
    model,
  },
});

const variants = [
  frame({
    id: 1,
    supplier: "Optic Supply",
    brand: "Ray-Ban",
    model: "RB-01",
    color: "Black",
    width: 52,
    barcode: "729000001",
  }),
  frame({
    id: 2,
    supplier: "Optic Supply",
    brand: "Ray-Ban",
    model: "RB-02",
    color: "Gold",
    width: 54,
  }),
  frame({
    id: 3,
    supplier: "Local Frames",
    brand: "Nova",
    model: "N-10",
    color: "Black",
    width: 52,
  }),
];

describe("frame catalog combobox", () => {
  it("combines lookup and catalog values without normalized duplicates", () => {
    expect(
      combinedFrameFieldOptions(
        [" Ray-Ban ", "Independent"],
        variants,
        {},
        "manufacturer",
      ),
    ).toEqual(["Independent", "Nova", "Ray-Ban"]);
  });

  it("derives field options from the other entered frame values", () => {
    expect(
      combinedFrameFieldOptions(
        [],
        variants,
        { supplier: "Optic Supply", color: "Black" },
        "model",
      ),
    ).toEqual(["RB-01"]);
  });

  it("suggests only products matching all entered fields when search is empty", () => {
    expect(
      frameCatalogSuggestions(variants, {
        manufacturer: "Ray-Ban",
        width: 52,
      }).map((variant) => variant.id),
    ).toEqual([1]);
  });

  it("searches product identity, attributes, SKU, and barcode globally", () => {
    expect(
      frameCatalogSuggestions(variants, {}, "729000001").map(
        (variant) => variant.id,
      ),
    ).toEqual([1]);
    expect(
      frameCatalogSuggestions(variants, {}, "gold").map(
        (variant) => variant.id,
      ),
    ).toEqual([2]);
  });
});
