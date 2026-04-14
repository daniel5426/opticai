import * as React from "react"
import { Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/utils/tailwind"

type FilterOption = {
  value: string
  label: string
}

export type TableFiltersBarSelect = {
  key: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  options: readonly FilterOption[] | FilterOption[]
  widthClassName?: string
  ariaLabel?: string
}

interface TableFiltersBarProps {
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  searchAriaLabel?: string
  filters?: TableFiltersBarSelect[]
  actions?: React.ReactNode
  onReset?: () => void
  hasActiveFilters?: boolean
  className?: string
}

export function TableFiltersBar({
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "חיפוש…",
  searchAriaLabel,
  filters = [],
  actions,
  onReset,
  hasActiveFilters = false,
  className,
}: TableFiltersBarProps) {
  return (
    <div dir="rtl" className={cn("w-full", className)}>
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {onSearchChange ? (
            <div className="relative min-w-[220px] flex-1 md:max-w-[320px]">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                aria-label={searchAriaLabel || searchPlaceholder}
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                className="h-9 rounded-lg border-border/80 bg-background/80 pr-9 shadow-none"
                dir="rtl"
              />
            </div>
          ) : null}

          {filters.map((filter) => (
            <Select key={filter.key} value={filter.value} onValueChange={filter.onChange} dir="rtl">
              <SelectTrigger
                aria-label={filter.ariaLabel || filter.placeholder}
                className={cn(
                  "h-9 rounded-lg border-border/80 bg-background/80 shadow-none",
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

          {onReset && hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-9 rounded-xl px-3"
            >
              נקה
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>

        {actions ? <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}
