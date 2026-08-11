import { useMemo } from "react";

import { InventoryCatalogCombobox } from "@/components/inventory/InventoryCatalogCombobox";
import { CatalogVariant, FulfillmentSource } from "@/lib/inventory";

export type ContactLensCatalogField =
  | "type"
  | "manufacturer"
  | "model"
  | "supplier"
  | "material"
  | "color";

export type ContactLensCatalogValues = {
  type?: string;
  manufacturer?: string;
  model?: string;
  supplier?: string;
  material?: string;
  color?: string;
  sph?: string | number;
  bc?: string | number;
  diam?: string | number;
  cyl?: string | number;
  ax?: string | number;
  read_ad?: string | number;
};

const normalized = (value: unknown) =>
  String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase();

const normalizedOpticalValue = (value: unknown) => {
  const text = normalized(value);
  if (!text) return "";
  const number = Number(text);
  return Number.isFinite(number) ? String(number) : text;
};

export const contactLensCatalogValue = (
  variant: CatalogVariant,
  field: ContactLensCatalogField,
) => {
  if (field === "type") return variant.product.product_type;
  if (field === "manufacturer") return variant.product.brand;
  if (field === "model") return variant.product.model;
  if (field === "supplier") return variant.product.preferred_supplier;
  if (field === "material") return variant.product.material;
  return variant.attributes?.color;
};

const matchesContactLensContext = (
  variant: CatalogVariant,
  values: ContactLensCatalogValues,
  except?: ContactLensCatalogField,
) => {
  const textEntries: Array<[ContactLensCatalogField, unknown, unknown]> = [
    ["type", values.type, variant.product.product_type],
    ["manufacturer", values.manufacturer, variant.product.brand],
    ["model", values.model, variant.product.model],
    ["supplier", values.supplier, variant.product.preferred_supplier],
    ["material", values.material, variant.product.material],
    ["color", values.color, variant.attributes?.color],
  ];
  const opticalEntries: Array<[unknown, unknown]> = [
    [values.sph, variant.attributes?.sph],
    [values.bc, variant.attributes?.bc],
    [values.diam, variant.attributes?.dia],
    [values.cyl, variant.attributes?.cyl],
    [values.ax, variant.attributes?.axis],
    [values.read_ad, variant.attributes?.add],
  ];

  return (
    textEntries.every(
      ([field, selected, candidate]) =>
        field === except ||
        !normalized(selected) ||
        normalized(selected) === normalized(candidate),
    ) &&
    opticalEntries.every(
      ([selected, candidate]) =>
        !normalizedOpticalValue(selected) ||
        normalizedOpticalValue(selected) === normalizedOpticalValue(candidate),
    )
  );
};

export function contactLensCatalogSuggestions(
  variants: CatalogVariant[],
  values: ContactLensCatalogValues,
  except?: ContactLensCatalogField,
) {
  return variants.filter((variant) =>
    matchesContactLensContext(variant, values, except),
  );
}

export function contactLensCatalogFieldOptions(
  variants: CatalogVariant[],
  values: ContactLensCatalogValues,
  field: ContactLensCatalogField,
) {
  return variants
    .filter((variant) => matchesContactLensContext(variant, values, field))
    .map((variant) =>
      String(contactLensCatalogValue(variant, field) ?? "").trim(),
    )
    .filter(Boolean);
}

export function ContactLensCatalogCombobox({
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
  inputClassName = "h-8 bg-white text-xs",
  center = true,
  portalContainer,
  onChange,
  onSelectProduct,
}: {
  field: ContactLensCatalogField;
  lookupType: string;
  lookupLabel: string;
  value: string;
  placeholder?: string;
  values: ContactLensCatalogValues;
  variants: CatalogVariant[];
  loadingCatalog?: boolean;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  center?: boolean;
  portalContainer?: HTMLElement | null;
  onChange: (value: string) => void;
  onSelectProduct: (variant: CatalogVariant, source: FulfillmentSource) => void;
}) {
  const catalogOptions = useMemo(
    () => contactLensCatalogFieldOptions(variants, values, field),
    [field, values, variants],
  );
  const suggestions = useMemo(
    () => contactLensCatalogSuggestions(variants, values, field),
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
      inputClassName={inputClassName}
      center={center}
      portalContainer={portalContainer}
      onChange={onChange}
      onSelectProduct={onSelectProduct}
    />
  );
}
