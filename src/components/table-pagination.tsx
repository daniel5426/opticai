import { Button } from "@/components/ui/button";

interface TablePaginationProps {
  page: number;
  pageSize: number;
  total: number | null;
  hasMore?: boolean;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

export function TablePagination({
  page,
  pageSize,
  total,
  hasMore = false,
  onPageChange,
  loading = false,
}: TablePaginationProps) {
  const totalPages = total === null ? null : Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const isLastPage = totalPages === null ? !hasMore : page >= totalPages;

  return (
    <div className="mt-4 flex shrink-0 items-center justify-between" dir="rtl">
      <div className="text-muted-foreground text-sm">
        {totalPages === null
          ? `עמוד ${page} · סופר תוצאות…`
          : `עמוד ${page} מתוך ${totalPages} · סה"כ ${total}`}
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={loading || page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          הקודם
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={loading || isLastPage}
          onClick={() => onPageChange(totalPages === null ? page + 1 : Math.min(totalPages, page + 1))}
        >
          הבא
        </Button>
      </div>
    </div>
  );
}
