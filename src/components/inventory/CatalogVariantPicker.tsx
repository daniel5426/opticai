import React, { useEffect, useMemo, useState } from "react";
import { Barcode, Boxes, Loader2, RotateCcw, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/lib/api-client";
import {
  CatalogVariant,
  FulfillmentSource,
  InventoryCategory,
  inventoryVariantDescription,
} from "@/lib/inventory";

type Facet = {
  key: string;
  label: string;
  getValue: (variant: CatalogVariant) => unknown;
};

const FRAME_FACETS: Facet[] = [
  { key: "brand", label: "מותג", getValue: (variant) => variant.product.brand },
  { key: "model", label: "דגם", getValue: (variant) => variant.product.model },
  { key: "material", label: "חומר", getValue: (variant) => variant.product.material },
  { key: "color", label: "צבע", getValue: (variant) => variant.attributes.color },
  { key: "eye_size", label: "גודל", getValue: (variant) => variant.attributes.eye_size },
];

const CONTACT_FACETS: Facet[] = [
  { key: "brand", label: "יצרן", getValue: (variant) => variant.product.brand },
  { key: "model", label: "דגם", getValue: (variant) => variant.product.model },
  { key: "product_type", label: "סוג", getValue: (variant) => variant.product.product_type },
  { key: "material", label: "חומר", getValue: (variant) => variant.product.material },
  { key: "color", label: "צבע", getValue: (variant) => variant.attributes.color },
];

const normalized = (value: unknown) => String(value ?? "").trim();

const facetsForCategory = (category: InventoryCategory) =>
  category === "frame" ? FRAME_FACETS : CONTACT_FACETS;

export function filterCatalogVariants(
  variants: CatalogVariant[],
  category: InventoryCategory,
  filters: Record<string, string>,
  query = "",
  except?: string,
) {
  const facets = facetsForCategory(category);
  const search = query.trim().toLocaleLowerCase();
  return variants.filter((variant) => {
    const matches = facets.every((facet) => {
      if (facet.key === except || !filters[facet.key]) return true;
      return normalized(facet.getValue(variant)) === filters[facet.key];
    });
    if (!matches || !search) return matches;
    return [
      variant.display_name,
      variant.sku,
      variant.barcode,
      inventoryVariantDescription(variant),
    ].some((value) => normalized(value).toLocaleLowerCase().includes(search));
  });
}

export function catalogFacetOptions(
  variants: CatalogVariant[],
  category: InventoryCategory,
  filters: Record<string, string>,
  facetKey: string,
) {
  const facet = facetsForCategory(category).find((entry) => entry.key === facetKey);
  if (!facet) return [];
  return Array.from(
    new Set(
      filterCatalogVariants(variants, category, filters, "", facetKey)
        .map((variant) => normalized(facet.getValue(variant)))
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right, "he"));
}

export function CatalogVariantPicker({
  category,
  clinicId,
  selected,
  selectedSource,
  disabled,
  title,
  onSelect,
  onClear,
}: {
  category: InventoryCategory;
  clinicId: number;
  selected?: CatalogVariant | null;
  selectedSource?: FulfillmentSource;
  disabled?: boolean;
  title?: string;
  onSelect: (variant: CatalogVariant, source: FulfillmentSource) => void;
  onClear: () => void;
}) {
  const [variants, setVariants] = useState<CatalogVariant[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(!selected);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const facets = facetsForCategory(category);

  useEffect(() => {
    if (!expanded) return;
    let active = true;
    setLoading(true);
    void apiClient
      .getInventoryVariants(clinicId, {
        category,
        stockableOnly: category === "frame",
      })
      .then((response) => {
        if (active) setVariants(response.data?.items || []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [category, clinicId, expanded]);

  useEffect(() => {
    if (selected) setExpanded(false);
  }, [selected?.id]);

  const results = useMemo(
    () => filterCatalogVariants(variants, category, filters, query),
    [category, filters, query, variants],
  );

  const optionsFor = (facet: Facet) =>
    catalogFacetOptions(variants, category, filters, facet.key);

  if (!expanded && selected) {
    const available = selected.balance?.available || 0;
    return (
      <div className="rounded-md border bg-emerald-50/35 p-3" dir="rtl">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Boxes className="h-4 w-4 text-emerald-700" />
              <p className="truncate text-sm font-medium">{selected.display_name}</p>
              <Badge variant="outline">
                {selectedSource === "supplier_ordered"
                  ? "הזמנה מספק"
                  : available + " זמין"}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {inventoryVariantDescription(selected)}
              {selected.sku ? " · " + selected.sku : ""}
            </p>
          </div>
          {!disabled ? (
            <Button variant="outline" size="sm" onClick={() => setExpanded(true)}>
              שנה
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border bg-muted/10 p-3" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{title || "בחירה מהמלאי"}</p>
          <p className="text-muted-foreground text-xs">אפשר להתחיל מכל שדה; שאר האפשרויות מתעדכנות אוטומטית.</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setFilters({});
            setQuery("");
          }}
          disabled={disabled}
        >
          <RotateCcw className="h-4 w-4" />
          נקה
        </Button>
      </div>
      <div className={"grid gap-2 " + (category === "frame" ? "md:grid-cols-5" : "md:grid-cols-4")}>
        {facets.map((facet) => (
          <div key={facet.key} className="space-y-1">
            <Label className="text-xs">{facet.label}</Label>
            <Select
              value={filters[facet.key] || "__all"}
              onValueChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  [facet.key]: value === "__all" ? "" : value,
                }))
              }
              disabled={disabled}
              dir="rtl"
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">הכל</SelectItem>
                {optionsFor(facet).map((option) => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
      <div className="relative">
        {query.match(/^\d+$/) ? (
          <Barcode className="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2" />
        ) : (
          <Search className="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2" />
        )}
        <Input
          className="h-9 pr-9"
          placeholder="חיפוש או סריקת ברקוד..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={disabled}
        />
      </div>
      <div className="max-h-48 divide-y overflow-y-auto rounded-md border bg-background">
        {loading ? (
          <div className="flex h-20 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : results.map((variant) => {
          const available = variant.balance?.available || 0;
          const source: FulfillmentSource = available > 0 ? "inventory" : "supplier_ordered";
          return (
            <button
              type="button"
              key={variant.id}
              className="hover:bg-muted/40 flex w-full items-center justify-between gap-3 p-3 text-right"
              onClick={() => {
                onSelect(variant, source);
                setExpanded(false);
              }}
              disabled={disabled}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{variant.display_name}</p>
                <p className="text-muted-foreground truncate text-xs">{inventoryVariantDescription(variant)}</p>
              </div>
              <Badge variant={available > 0 ? "outline" : "secondary"}>
                {available > 0 ? available + " זמין" : "הזמנה מספק"}
              </Badge>
            </button>
          );
        })}
        {!loading && !results.length ? (
          <p className="text-muted-foreground p-6 text-center text-xs">לא נמצאו וריאנטים מתאימים.</p>
        ) : null}
      </div>
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            onClear();
            setExpanded(false);
          }}
          disabled={disabled}
        >
          הזנה ידנית / מוצר של הלקוח
        </Button>
      </div>
    </div>
  );
}
