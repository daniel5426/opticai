import React, { useMemo, useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import {
  Check,
  ChevronDown,
  Loader2,
  PackageCheck,
  Plus,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLookupData } from "@/hooks/useLookupData";
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
) {
  return variants.filter((variant) =>
    query.trim()
      ? matchesSearch(variant, query)
      : matchesFrameContext(variant, values),
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
  onChange: (value: string) => void;
  onSelectProduct: (variant: CatalogVariant, source: FulfillmentSource) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { data, loading, createItem, isCreating } = useLookupData(lookupType);

  const options = useMemo(
    () =>
      combinedFrameFieldOptions(
        data.map((item) => item.name),
        variants,
        values,
        field,
        query,
      ),
    [data, field, query, values, variants],
  );
  const suggestions = useMemo(
    () => frameCatalogSuggestions(variants, values, query).slice(0, 8),
    [query, values, variants],
  );
  const createValue = query.trim() || value.trim();
  const exactOption = [
    ...data.map((item) => item.name),
    ...variants.map((variant) =>
      String(frameCatalogValue(variant, field) ?? ""),
    ),
  ].some((option) => normalized(option) === normalized(createValue));

  const chooseOption = (option: string) => {
    onChange(option);
    setQuery("");
    setOpen(false);
  };

  const createLookup = async () => {
    if (!createValue || exactOption) return;
    try {
      const created = await createItem(createValue);
      if (!created) throw new Error("Lookup creation failed");
      chooseOption(created.name);
      toast.success(`${created.name} נוסף לרשימת ${lookupLabel}`);
    } catch {
      toast.error(`לא ניתן להוסיף את ${createValue} לרשימת ${lookupLabel}`);
    }
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>
        <div className={`relative ${className}`} dir="rtl">
          <Input
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="off"
            className="bg-card disabled:bg-accent/50 pl-8 text-right disabled:cursor-default disabled:opacity-100"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-0 left-0 h-full w-8 hover:bg-transparent"
            onClick={() => setOpen((current) => !current)}
            disabled={disabled}
            aria-label={`פתח אפשרויות ${lookupLabel}`}
          >
            <ChevronDown
              aria-hidden="true"
              className={`text-muted-foreground size-4 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </Button>
        </div>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          sideOffset={6}
          align="start"
          collisionPadding={16}
          className="bg-popover text-popover-foreground z-[9999] w-[min(440px,calc(100vw-2rem))] overflow-hidden rounded-lg border shadow-lg outline-none"
          dir="rtl"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="flex h-10 items-center gap-2 border-b px-3">
            <Search
              aria-hidden="true"
              className="text-muted-foreground size-4 shrink-0"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="חיפוש באפשרויות ובקטלוג…"
              className="placeholder:text-muted-foreground h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
              aria-label={`חיפוש ${lookupLabel} ומוצרי קטלוג`}
              autoComplete="off"
            />
          </div>

          <div className="grid max-h-[360px] min-h-[220px] grid-rows-[minmax(0,1fr)_auto_minmax(0,1.15fr)]">
            <section
              className="no-scrollbar min-h-0 overflow-y-auto p-1.5"
              aria-label={lookupLabel}
            >
              <p className="text-muted-foreground px-2 py-1 text-xs font-medium">
                אפשרויות {lookupLabel}
              </p>
              {loading ? (
                <div className="flex h-16 items-center justify-center">
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                </div>
              ) : options.length ? (
                options.map((option) => (
                  <button
                    type="button"
                    key={option}
                    className="hover:bg-accent focus-visible:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm focus-visible:outline-none"
                    onClick={() => chooseOption(option)}
                  >
                    <Check
                      aria-hidden="true"
                      className={`size-4 shrink-0 ${normalized(option) === normalized(value) ? "opacity-100" : "opacity-0"}`}
                    />
                    <span className="min-w-0 flex-1 truncate">{option}</span>
                  </button>
                ))
              ) : (
                <p className="text-muted-foreground px-2 py-3 text-center text-xs">
                  לא נמצאו אפשרויות מתאימות
                </p>
              )}
              {createValue && !exactOption ? (
                <button
                  type="button"
                  className="text-primary hover:bg-accent focus-visible:ring-ring mt-1 flex w-full items-center gap-2 rounded-md border-t px-2 py-2 text-start text-sm focus-visible:ring-2 focus-visible:outline-none"
                  onClick={() => void createLookup()}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <Loader2
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                  ) : (
                    <Plus aria-hidden="true" className="size-4" />
                  )}
                  <span className="min-w-0 truncate">
                    הוסף “{createValue}” לרשימת {lookupLabel}
                  </span>
                </button>
              ) : null}
            </section>

            <div className="mx-3 border-t" />

            <section
              className="no-scrollbar min-h-0 overflow-y-auto p-1.5"
              aria-label="הצעות מהקטלוג"
            >
              <div className="flex items-center justify-between px-2 py-1">
                <p className="text-muted-foreground text-xs font-medium">
                  הצעות מהקטלוג
                </p>
                {suggestions.length ? (
                  <span className="text-muted-foreground text-[11px]">
                    בחירה תמלא את פרטי המסגרת
                  </span>
                ) : null}
              </div>
              {loadingCatalog ? (
                <div className="flex h-20 items-center justify-center">
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                </div>
              ) : suggestions.length ? (
                suggestions.map((variant) => {
                  const available = variant.balance?.available || 0;
                  const source: FulfillmentSource =
                    available > 0 ? "inventory" : "supplier_ordered";
                  return (
                    <button
                      type="button"
                      key={variant.id}
                      className="hover:bg-accent focus-visible:bg-accent flex w-full items-center gap-3 rounded-md px-2 py-2 text-start focus-visible:outline-none"
                      onClick={() => {
                        onSelectProduct(variant, source);
                        setQuery("");
                        setOpen(false);
                      }}
                    >
                      <PackageCheck
                        aria-hidden="true"
                        className="text-primary size-4 shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {variant.display_name}
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {inventoryVariantDescription(variant)}
                        </span>
                      </span>
                      <Badge
                        variant={available > 0 ? "outline" : "secondary"}
                        className="shrink-0"
                      >
                        {available > 0 ? `${available} זמין` : "הזמנה מספק"}
                      </Badge>
                    </button>
                  );
                })
              ) : (
                <p className="text-muted-foreground px-2 py-6 text-center text-xs">
                  אין מוצרי קטלוג שמתאימים לחיפוש
                </p>
              )}
            </section>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
