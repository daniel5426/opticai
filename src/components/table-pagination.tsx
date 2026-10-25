import React from "react";
import { useTranslation } from "react-i18next";
import { useAppLocale } from "@/localization/use-app-locale";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/tailwind";

interface TablePaginationProps {
  page: number;
  pageSize: number;
  total: number | null;
  hasMore?: boolean;
  onPageChange: (page: number) => void;
  loading?: boolean;
  className?: string;
}

export function TablePagination({
  page,
  pageSize,
  total,
  hasMore = false,
  onPageChange,
  loading = false,
  className,
}: TablePaginationProps) {
  const { t } = useTranslation();
  const { direction } = useAppLocale();
  const totalPages = total === null ? null : Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const isLastPage = totalPages === null ? !hasMore : page >= totalPages;

  return (
    <div className={cn("mt-2 flex shrink-0 items-center justify-between", className)} dir={direction}>
      <div className="text-muted-foreground text-sm">
        {totalPages === null
          ? t("orderGroupPagePending", { page })
          : t("orderGroupPageSummary", { page, totalPages, total })}
      </div>
      <div data-canvas-toolbar className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={loading || page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          {t("orderGroupPrevious")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={loading || isLastPage}
          onClick={() => onPageChange(totalPages === null ? page + 1 : Math.min(totalPages, page + 1))}
        >
          {t("orderGroupNext")}
        </Button>
      </div>
    </div>
  );
}
