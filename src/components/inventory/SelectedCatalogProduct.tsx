import React from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CatalogVariant } from "@/lib/inventory";
import { catalogProductName } from "./InventoryCatalogCombobox";

export function SelectedCatalogProduct({ variant, onClear, clearLabel }: {
  variant: CatalogVariant;
  onClear?: () => void;
  clearLabel?: string;
}) {
  const { t } = useTranslation();
  return (
    <span className="bg-muted inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs">
      <span className="min-w-0 break-words font-medium">{catalogProductName(variant)}</span>
      {onClear && <button
        type="button"
        onClick={onClear}
        aria-label={clearLabel || t("orderWorkspace.catalogClear")}
        className="text-muted-foreground hover:bg-card hover:text-foreground focus-visible:ring-ring/50 shrink-0 rounded-sm p-1 outline-none focus-visible:ring-2"
      >
        <X aria-hidden="true" className="size-3" />
      </button>}
    </span>
  );
}
