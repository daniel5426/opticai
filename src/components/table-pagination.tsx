import { Button } from "@/components/ui/button";

interface TablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  loading = false,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

  return (
    <div className="mt-4 flex shrink-0 items-center justify-between" dir="rtl">
      <div className="text-muted-foreground text-sm">
        עמוד {page} מתוך {totalPages} · סה&quot;כ {total}
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
          disabled={loading || page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          הבא
        </Button>
      </div>
    </div>
  );
}
