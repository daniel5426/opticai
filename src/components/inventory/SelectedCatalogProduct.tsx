import React from "react";
import { Unlink } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CatalogVariant } from "@/lib/inventory";
import { catalogProductName } from "./InventoryCatalogCombobox";

export function SelectedCatalogProduct({ variant, onClear, clearLabel, actions }: {
  variant: CatalogVariant;
  onClear?: () => void;
  clearLabel?: string;
  actions?: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div data-selected-catalog-product className="catalog-product-surface bg-sidebar text-sidebar-foreground flex min-h-10 w-full min-w-0 flex-wrap items-center gap-2 rounded-md px-3 py-2 text-xs">
      <span className="min-w-0 flex-1 break-words font-medium">{catalogProductName(variant)}</span>
      {actions}
      {onClear && <button
        type="button"
        onClick={onClear}
        aria-label={clearLabel || t("orderWorkspace.catalogUnlink")}
        title={clearLabel || t("orderWorkspace.catalogUnlink")}
        className="text-muted-foreground hover:bg-card hover:text-foreground focus-visible:ring-ring/50 shrink-0 rounded-sm p-1 outline-none focus-visible:ring-2"
      >
        <Unlink aria-hidden="true" className="size-3.5" />
      </button>}
    </div>
  );
}
