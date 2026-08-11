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
  searchPlaceholder = "חיפוש…",
  searchAriaLabel,
  filters = [],
  navigation,
  actions,
  onReset,
  hasActiveFilters = false,
  className,
  compact = false,
}: TableFiltersBarProps) {
  const hasLeftContent = Boolean(navigation || actions);

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
            dir="rtl"
            className={cn(
              "order-2 flex shrink-0 flex-wrap items-center justify-end gap-2",
              compact ? "md:order-1" : "xl:order-1",
            )}
          >
            {navigation}
            {actions}
          </div>
        ) : null}

        <div
          dir="ltr"
          className={cn(
            "order-1 flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2",
            compact ? "md:order-2" : "xl:order-2",
          )}
        >
          {onReset && hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-9 rounded-xl px-3"
              dir="rtl"
            >
              נקה
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : null}

          {[...filters].reverse().map((filter) => (
            <Select
              key={filter.key}
              value={filter.value}
              onValueChange={filter.onChange}
              dir="rtl"
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

          {onSearchChange ? (
            <div
              dir="rtl"
              className="relative min-w-[220px] flex-1 md:max-w-[320px]"
            >
              <Search
                aria-hidden="true"
                className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2"
              />
              <Input
                aria-label={searchAriaLabel || searchPlaceholder}
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                className="border-border/80 bg-card h-9 rounded-lg pr-9 shadow-none"
                dir="rtl"
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
