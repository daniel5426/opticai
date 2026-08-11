import { useMemo } from "react";

import { InventoryCatalogCombobox } from "@/components/inventory/InventoryCatalogCombobox";
import {
  CatalogVariant,
  FulfillmentSource,
  inventoryVariantDescription,
} from "@/lib/inventory";

export type FrameCatalogField = "supplier" | "manufacturer" | "model" | "color";

export type FrameCatalogValues = {
  supplier?: string;
  manufacturer?: string;
  model?: string;
  color?: string;
  width?: number;
};

const normalized = (value: unknown) =>
  String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase();

export const frameCatalogValue = (
  variant: CatalogVariant,
  field: FrameCatalogField,
) => {
  if (field === "supplier") return variant.product.preferred_supplier;
  if (field === "manufacturer") return variant.product.brand;
  if (field === "model") return variant.product.model;
  return variant.attributes?.color;
};

const matchesFrameContext = (
  variant: CatalogVariant,
  values: FrameCatalogValues,
  except?: FrameCatalogField,
) => {
  const entries: Array<[FrameCatalogField, unknown, unknown]> = [
    ["supplier", values.supplier, variant.product.preferred_supplier],
    ["manufacturer", values.manufacturer, variant.product.brand],
    ["model", values.model, variant.product.model],
    ["color", values.color, variant.attributes?.color],
  ];
  const textMatches = entries.every(
    ([field, selected, candidate]) =>
      field === except ||
      !normalized(selected) ||
      normalized(selected) === normalized(candidate),
  );
  if (!textMatches || values.width == null) return textMatches;
  return Number(variant.attributes?.eye_size) === Number(values.width);
};

const matchesSearch = (variant: CatalogVariant, query: string) => {
  const search = normalized(query);
  if (!search) return true;
  return [
    variant.display_name,
    variant.product.brand,
    variant.product.model,
    variant.product.preferred_supplier,
    variant.product.material,
    variant.attributes?.color,
    variant.attributes?.eye_size,
    variant.sku,
    variant.barcode,
    inventoryVariantDescription(variant),
  ].some((value) => normalized(value).includes(search));
};

export function frameCatalogSuggestions(
  variants: CatalogVariant[],
  values: FrameCatalogValues,
  query = "",
  except?: FrameCatalogField,
) {
  return variants.filter((variant) =>
    query.trim()
      ? matchesSearch(variant, query)
      : matchesFrameContext(variant, values, except),
  );
}

export function combinedFrameFieldOptions(
  lookupValues: string[],
  variants: CatalogVariant[],
  values: FrameCatalogValues,
  field: FrameCatalogField,
  query = "",
) {
  const catalogValues = variants
    .filter((variant) => matchesFrameContext(variant, values, field))
    .map((variant) => String(frameCatalogValue(variant, field) ?? "").trim())
    .filter(Boolean);
  const search = normalized(query);
  const seen = new Set<string>();
  return [...lookupValues, ...catalogValues]
    .map((value) => value.trim())
    .filter((value) => {
      const key = normalized(value);
      if (!key || seen.has(key) || (search && !key.includes(search)))
        return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => left.localeCompare(right, "he"));
}

export function FrameCatalogCombobox({
  field,
  lookupType,
  lookupLabel,
  value,
  placeholder,
  values,
  variants,
  loadingCatalog,
  disabled,
  className = "",
  portalContainer,
  onChange,
  onSelectProduct,
}: {
  field: FrameCatalogField;
  lookupType: string;
  lookupLabel: string;
  value: string;
  placeholder: string;
  values: FrameCatalogValues;
  variants: CatalogVariant[];
  loadingCatalog?: boolean;
  disabled?: boolean;
  className?: string;
  portalContainer?: HTMLElement | null;
  onChange: (value: string) => void;
  onSelectProduct: (variant: CatalogVariant, source: FulfillmentSource) => void;
}) {
  const catalogOptions = useMemo(
    () => combinedFrameFieldOptions([], variants, values, field),
    [field, values, variants],
  );
  const suggestions = useMemo(
    () => frameCatalogSuggestions(variants, values, "", field),
    [field, values, variants],
  );

  return (
    <InventoryCatalogCombobox
      lookupType={lookupType}
      lookupLabel={lookupLabel}
      value={value}
      placeholder={placeholder}
      catalogOptions={catalogOptions}
      suggestions={suggestions}
      loadingCatalog={loadingCatalog}
      disabled={disabled}
      className={className}
      portalContainer={portalContainer}
      onChange={onChange}
      onSelectProduct={onSelectProduct}
    />
  );
}
