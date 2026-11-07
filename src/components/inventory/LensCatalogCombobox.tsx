import React from "react";
import { InventoryCatalogCombobox } from './InventoryCatalogCombobox';
import type { CatalogVariant, FulfillmentSource } from '@/lib/inventory';

export type LensCatalogField = 'supplier' | 'material' | 'model' | 'coating' | 'color' | 'diameter';
export type LensCatalogValues = Partial<Record<LensCatalogField, string>>;
const normalize = (value: unknown) => String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase();
export const lensCatalogValue = (variant: CatalogVariant, field: LensCatalogField) =>
  field === 'supplier' ? variant.product.preferred_supplier : field === 'model' ? variant.product.model : field === 'material' ? variant.product.material : variant.attributes[field];
export function lensCatalogSuggestions(variants: CatalogVariant[], values: LensCatalogValues, except?: LensCatalogField) {
  return variants.filter(variant => Object.entries(values).every(([field, value]) =>
    field === except || !normalize(value) || normalize(value) === normalize(lensCatalogValue(variant, field as LensCatalogField))));
}
export function LensCatalogCombobox({ field, values, variants, onSelectProduct, ...props }: {
  field: LensCatalogField; values: LensCatalogValues; variants: CatalogVariant[];
  value: string; onChange: (value: string) => void; lookupType: string; lookupLabel: string;
  ariaLabel?: string;
  loadingCatalog?: boolean; disabled?: boolean; createProduct?: { name: string; onCreate: () => Promise<void> };
  onSelectProduct: (variant: CatalogVariant, source: FulfillmentSource) => void;
}) {
  const suggestions = lensCatalogSuggestions(variants, values, field);
  return <InventoryCatalogCombobox {...props} placeholder="" suggestions={suggestions}
    catalogOptions={suggestions.map(variant => String(lensCatalogValue(variant, field) ?? '')).filter(Boolean)}
    onSelectProduct={onSelectProduct} />;
}
