import * as React from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/utils/tailwind";
import { useAppLocale } from "@/localization/use-app-locale";
import { useTranslation } from "react-i18next";

type FilterOption = {
  value: string;
  label: string;
};

export type TableFiltersBarSelect = {
  key: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: readonly FilterOption[] | FilterOption[];
  widthClassName?: string;
  ariaLabel?: string;
};

interface TableFiltersBarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  filters?: TableFiltersBarSelect[];
  navigation?: React.ReactNode;
  actions?: React.ReactNode;
  onReset?: () => void;
  hasActiveFilters?: boolean;
  className?: string;
  compact?: boolean;
}

export function TableFiltersBar({
  searchValue = "",
  onSearchChange,
  searchPlaceholder,
  searchAriaLabel,
  filters = [],
  navigation,
  actions,
  onReset,
  hasActiveFilters = false,
  className,
  compact = false,
}: TableFiltersBarProps) {
  const { direction } = useAppLocale();
  const { t } = useTranslation();
  const resolvedSearchPlaceholder = searchPlaceholder ?? `${t("search")}…`;
  const hasLeftContent = Boolean(navigation || actions);
  const orderedFilters = direction === "rtl" ? [...filters].reverse() : filters;
  const navigationOrder =
    direction === "ltr"
      ? "order-2 flex shrink-0 flex-wrap items-center justify-end gap-2"
      : cn(
          "order-2 flex shrink-0 flex-wrap items-center justify-end gap-2",
          compact ? "md:order-1" : "xl:order-1",
        );
  const controlsOrder =
    direction === "ltr"
      ? "order-1 flex min-w-0 flex-1 flex-wrap items-center justify-start gap-2"
      : cn(
          "order-1 flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2",
          compact ? "md:order-2" : "xl:order-2",
        );

  return (
    <div className={cn("w-full", className)}>
      <div
        dir="ltr"
        className={cn(
          "flex flex-col gap-2",
          compact
            ? "md:flex-row md:items-center md:justify-between"
            : "xl:flex-row xl:items-center xl:justify-between",
        )}
      >
        {hasLeftContent ? (
          <div
            dir={direction}
            className={navigationOrder}
          >
            {navigation}
            {actions}
          </div>
        ) : null}

        <div
          dir={direction}
          className={controlsOrder}
        >
          {onSearchChange ? (
            <div
              className="relative min-w-[220px] flex-1 md:max-w-[320px]"
            >
              <Search
                aria-hidden="true"
                className="text-muted-foreground pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2"
              />
              <Input
                aria-label={searchAriaLabel || resolvedSearchPlaceholder}
                placeholder={resolvedSearchPlaceholder}
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                className="border-border/80 bg-card h-9 rounded-lg pe-9 shadow-none"
                dir={direction}
              />
            </div>
          ) : null}

          {onReset && hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-9 rounded-xl px-3"
              dir={direction}
            >
              {t("clear")}
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : null}

          {orderedFilters.map((filter) => (
            <Select
              key={filter.key}
              value={filter.value}
              onValueChange={filter.onChange}
              dir={direction}
            >
              <SelectTrigger
                aria-label={filter.ariaLabel || filter.placeholder}
                className={cn(
                  "border-border/80 bg-card h-9 rounded-lg shadow-none",
                  filter.widthClassName || "w-[160px]",
                )}
              >
                <SelectValue placeholder={filter.placeholder} />
              </SelectTrigger>
              <SelectContent>
                {filter.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}

        </div>
      </div>
    </div>
  );
}
