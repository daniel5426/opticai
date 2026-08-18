import { useMemo, useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronDown, Loader2, PackageCheck, Plus } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLookupData } from "@/hooks/useLookupData";
import { useAppLocale } from "@/localization/use-app-locale";
import {
  CatalogVariant,
  FulfillmentSource,
  inventoryVariantDescription,
} from "@/lib/inventory";

const normalized = (value: unknown) =>
  String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase();

export const catalogProductName = (variant: CatalogVariant) =>
  [variant.product.brand, variant.product.model]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ") || "מוצר ללא שם";

const matchesVariantText = (variant: CatalogVariant, query: string) => {
  const search = normalized(query);
  if (!search) return true;
  return [
    variant.display_name,
    variant.product.brand,
    variant.product.model,
    variant.product.product_type,
    variant.product.preferred_supplier,
    variant.product.material,
    ...Object.values(variant.attributes || {}),
    variant.sku,
    variant.barcode,
    inventoryVariantDescription(variant),
  ].some((candidate) => normalized(candidate).includes(search));
};

export function rankCatalogLookupOptions(
  lookupOptions: string[],
  catalogOptions: string[],
  query = "",
) {
  const search = normalized(query);
  const catalogKeys = new Set(catalogOptions.map(normalized));
  const seen = new Set<string>();

  return [...lookupOptions, ...catalogOptions]
    .map((option) => option.trim())
    .filter((option) => {
      const key = normalized(option);
      if (!key || seen.has(key) || (search && !key.includes(search))) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((left, right) => {
      const compatibility =
        Number(catalogKeys.has(normalized(right))) -
        Number(catalogKeys.has(normalized(left)));
      return compatibility || left.localeCompare(right, "he");
    });
}

export function InventoryCatalogCombobox({
  lookupType,
  lookupLabel,
  value,
  placeholder,
  catalogOptions,
  suggestions,
  loadingCatalog,
  disabled,
  className = "",
  inputClassName = "",
  center = false,
  portalContainer,
  onChange,
  onSelectProduct,
  createProduct,
}: {
  lookupType: string;
  lookupLabel: string;
  value: string;
  placeholder?: string;
  catalogOptions: string[];
  suggestions: CatalogVariant[];
  loadingCatalog?: boolean;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  center?: boolean;
  /** Keeps an open dropdown inside a dialog's scroll-lock boundary. */
  portalContainer?: HTMLElement | null;
  onChange: (value: string) => void;
  onSelectProduct: (variant: CatalogVariant, source: FulfillmentSource) => void;
  createProduct?: {
    name: string;
    onCreate: () => Promise<void>;
  };
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const { data, loading, createItem, isCreating } = useLookupData(lookupType);
  const { t } = useTranslation();
  const { direction } = useAppLocale();

  const options = useMemo(() => {
    return rankCatalogLookupOptions(
      data.map((item) => item.name),
      catalogOptions,
      query,
    );
  }, [catalogOptions, data, query]);

  const filteredSuggestions = useMemo(
    () =>
      suggestions
        .filter((variant) => matchesVariantText(variant, query))
        .slice(0, 8),
    [query, suggestions],
  );
  const createValue = query.trim() || value.trim();
  const exactOption = [
    ...data.map((item) => item.name),
    ...catalogOptions,
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

  const createCatalogProduct = async () => {
    if (!createProduct || isCreatingProduct) return;
    setIsCreatingProduct(true);
    try {
      await createProduct.onCreate();
      setDropdownOpen(false);
    } catch {
      toast.error(t("inventoryProductCreateFailed"));
    } finally {
      setIsCreatingProduct(false);
    }
  };

  const openAfterFocus = () => {
    setQuery(value);
    window.setTimeout(() => setOpen(true), 0);
  };

  const setDropdownOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setQuery("");
  };

  const toggleDropdown = () => {
    if (open) {
      setDropdownOpen(false);
      return;
    }
    setQuery(value);
    setOpen(true);
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setDropdownOpen}>
      <PopoverPrimitive.Anchor asChild>
        <div className={`relative ${className}`} dir={direction}>
          <Input
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={openAfterFocus}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="off"
            dir={direction}
            className={`bg-card disabled:bg-accent/50 pe-8 disabled:cursor-default disabled:opacity-100 ${center ? "text-center" : "text-start"} ${inputClassName}`}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute end-0 top-0 h-full w-8 hover:bg-transparent"
            onClick={toggleDropdown}
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

      <PopoverPrimitive.Portal container={portalContainer}>
        <PopoverPrimitive.Content
          sideOffset={6}
          align="start"
          collisionPadding={16}
          className="bg-popover text-popover-foreground z-[9999] flex w-max max-w-[min(440px,calc(100vw-2rem))] min-w-[var(--radix-popover-trigger-width)] flex-col overflow-hidden rounded-lg border shadow-lg outline-none"
          dir={direction}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <section
            className="catalog-dropdown-scroll max-h-[168px] shrink-0 touch-pan-y overflow-y-auto overscroll-contain p-1.5"
            aria-label={lookupLabel}
          >
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
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Plus aria-hidden="true" className="size-4" />
                )}
                <span className="min-w-0 truncate">
                  הוסף “{createValue}” לרשימת {lookupLabel}
                </span>
              </button>
            ) : null}
          </section>

          <div className="border-border/50 mx-3 border-t" />

          <section
            className="catalog-dropdown-scroll max-h-[188px] shrink-0 touch-pan-y overflow-y-auto overscroll-contain p-1.5"
            aria-label="הצעות מהקטלוג"
          >
            {loadingCatalog ? (
              <div className="flex h-20 items-center justify-center">
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              </div>
            ) : filteredSuggestions.length ? (
              filteredSuggestions.map((variant) => {
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
                        {catalogProductName(variant)}
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
                אין מוצרי קטלוג מתאימים
              </p>
            )}
            {createProduct ? (
              <button
                type="button"
                className="text-primary hover:bg-accent focus-visible:ring-ring mt-1 flex w-full items-center gap-2 rounded-md border-t px-2 py-2 text-start text-sm focus-visible:ring-2 focus-visible:outline-none"
                onClick={() => void createCatalogProduct()}
                disabled={isCreatingProduct}
              >
                <span className="min-w-0 flex-1 truncate">
                  {t("inventoryCreateProduct", { name: createProduct.name })}
                </span>
                {isCreatingProduct ? (
                  <Loader2
                    aria-hidden="true"
                    className="size-4 shrink-0 animate-spin"
                  />
                ) : (
                  <Plus aria-hidden="true" className="size-4 shrink-0" />
                )}
              </button>
            ) : null}
          </section>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
