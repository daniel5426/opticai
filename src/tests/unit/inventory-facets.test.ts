import { describe, expect, it } from "vitest";

import {
  catalogFacetOptions,
  filterCatalogVariants,
} from "@/components/inventory/CatalogVariantPicker";
import { CatalogVariant } from "@/lib/inventory";

const frame = (
  id: number,
  brand: string,
  model: string,
  material: string,
  color: string,
  eyeSize: number,
): CatalogVariant => ({
  id,
  company_id: 1,
  product_id: id,
  display_name: `${brand} ${model}`,
  attributes: { color, eye_size: eyeSize },
  sku: `SKU-${id}`,
  barcode: `1000000${id}`,
  default_retail: 100,
  currency: "ILS",
  is_stockable: true,
  product: {
    id,
    company_id: 1,
    category: "frame",
    brand,
    model,
    material,
  },
});

const variants = [
  frame(1, "Alpha", "One", "Metal", "Black", 50),
  frame(2, "Alpha", "One", "Acetate", "Red", 52),
  frame(3, "Beta", "Two", "Metal", "Black", 54),
];

describe("inventory catalog facets", () => {
  it("filters identically regardless of field selection order", () => {
    const materialThenBrand = filterCatalogVariants(variants, "frame", {
      material: "Metal",
      brand: "Alpha",
    });
    const brandThenMaterial = filterCatalogVariants(variants, "frame", {
      brand: "Alpha",
      material: "Metal",
    });

    expect(materialThenBrand.map((variant) => variant.id)).toEqual([1]);
    expect(brandThenMaterial.map((variant) => variant.id)).toEqual([1]);
  });

  it("derives each field's choices from all other active fields", () => {
    expect(
      catalogFacetOptions(
        variants,
        "frame",
        { brand: "Alpha", color: "Black" },
        "material",
      ),
    ).toEqual(["Metal"]);
    expect(
      catalogFacetOptions(
        variants,
        "frame",
        { material: "Acetate" },
        "brand",
      ),
    ).toEqual(["Alpha"]);
  });

  it("supports exact barcode search", () => {
    expect(
      filterCatalogVariants(variants, "frame", {}, "10000003").map(
        (variant) => variant.id,
      ),
    ).toEqual([3]);
  });
});
