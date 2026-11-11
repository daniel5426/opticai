import { TableExportContext } from "@/components/table-export/context";
import { TableExportButton } from "@/components/table-export/TableExportButton";
import type { ExportConfig, ExportFilter, ExportTable } from "@/lib/table-exports";
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
import { canvasSurfaceClassName } from "@/components/ui/canvas-surface";
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

export const TableFiltersContext = React.createContext<TableFiltersBarSelect[]>([]);

export function TableFilterSelect({ filter }: { filter: TableFiltersBarSelect }) {
  const { direction } = useAppLocale();
  return (
    <Select value={filter.value} onValueChange={filter.onChange} dir={direction}>
      <SelectTrigger
        aria-label={filter.ariaLabel || filter.placeholder}
        data-canvas-surface=""
        className={cn(canvasSurfaceClassName, "h-9", filter.widthClassName || "w-[160px]")}
      >
        <SelectValue placeholder={filter.placeholder} />
      </SelectTrigger>
      <SelectContent dir={direction}>
        {filter.options.map(option => (
          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface TableFiltersBarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  filters?: TableFiltersBarSelect[];
  /** Shown where the search box is, for tables that search by field instead. */
  leadingControls?: React.ReactNode;
  inlineControls?: React.ReactNode;
  navigation?: React.ReactNode;
  actions?: React.ReactNode;
  onReset?: () => void;
  hasActiveFilters?: boolean;
  className?: string;
  compact?: boolean;
  exportConfig?: ExportConfig;
  exportTable?: ExportTable;
}

export function TableFiltersBar({
  searchValue = "",
  onSearchChange,
  searchPlaceholder,
  searchAriaLabel,
  filters = [],
  leadingControls,
  inlineControls,
  navigation,
  actions,
  onReset,
  hasActiveFilters = false,
  className,
  compact = false,
  exportConfig: explicitExportConfig,
  exportTable,
}: TableFiltersBarProps) {
  const { direction } = useAppLocale();
  const { t } = useTranslation();
  const resolvedSearchPlaceholder = searchPlaceholder ?? `${t("search")}…`;
  const inheritedExportConfig = React.useContext(TableExportContext);
  const exportConfig = explicitExportConfig || (inheritedExportConfig?.table === exportTable ? inheritedExportConfig : null);
  const hasLeftContent = Boolean(navigation || actions || exportConfig);
  const inheritedFilters = React.useContext(TableFiltersContext);
  const effectiveFilters = [...filters, ...inheritedFilters.filter(filter => !filters.some(explicit => explicit.key === filter.key))];
  const filterKeys: Record<string, string> = { "test-name": "test_name", "exam-type": "exam_name", "date-scope": "date_scope", "file-category": "file_category", urgency: "urgency_level", type: "referral_type" };
  const filterLabels: Record<string, string> = { test_name: "column.test_name", exam_name: "column.exam_name", date_scope: "dates", file_category: "column.category", urgency_level: "column.urgency", referral_type: "column.type" };
  const exportFilters: ExportFilter[] = effectiveFilters.filter(filter => filter.key !== "clinic").map(filter => {
    const key = filterKeys[filter.key] || filter.key;
    return { key, value: filter.value || "all", label: t(`tableExport.${filterLabels[key] || `column.${key}`}`), options: filter.options.map(option => ({ value: option.value, label: option.value === "all" ? t("tableExport.all") : t(`tableExport.value.${option.value}`, { defaultValue: option.label }) })) };
  });
  const clinicFilter = effectiveFilters.find(filter => filter.key === "clinic");
  const clinicName = exportConfig?.clinicId == null ? t("tableExport.allClinics") : clinicFilter?.value === "current" ? t("companyClients.currentClinic") : clinicFilter?.options.find(option => option.value === String(exportConfig.clinicId))?.label || String(exportConfig.clinicId);
  const exportButton = exportConfig ? <TableExportButton snapshot={{ ...exportConfig, search: searchValue, filters: [...exportFilters, ...(exportConfig.filters || [])], clinicName }} /> : null;
  const orderedFilters = direction === "rtl" ? [...effectiveFilters].reverse() : effectiveFilters;
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
          "order-1 flex min-w-0 flex-1 flex-row-reverse flex-wrap items-center justify-start gap-2",
          compact ? "md:order-2" : "xl:order-2",
        );

  return (
    <div data-canvas-toolbar className={cn("w-full", className)}>
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
            {exportConfig?.placement === "beforeNavigation" && exportButton}
            {navigation}
            {actions}
            {exportConfig?.placement !== "beforeNavigation" && exportButton}
          </div>
        ) : null}

        <div
          dir="ltr"
          className={controlsOrder}
        >
          {onSearchChange ? (
            <div
              className="relative min-w-[220px] flex-1 md:max-w-[320px]"
            >
              <Search
                aria-hidden="true"
                className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              />
              <Input
                aria-label={searchAriaLabel || resolvedSearchPlaceholder}
                placeholder={resolvedSearchPlaceholder}
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                data-canvas-surface=""
                className={cn(canvasSurfaceClassName, "h-9 ps-9")}
                dir={direction}
              />
            </div>
          ) : null}

          {leadingControls}

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

          {orderedFilters.map(filter => <TableFilterSelect key={filter.key} filter={filter} />)}

          {inlineControls ? <div dir={direction}>{inlineControls}</div> : null}

        </div>
      </div>
    </div>
  );
}
