import React from 'react';
import { ActiveColumnFilters } from '@/components/column-filter';
import { TableFiltersBar } from '@/components/table-filters-bar';
import { TablePagination } from '@/components/table-pagination';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppLocale } from '@/localization/use-app-locale';

export function TableListPageContent({ children }: { children: React.ReactNode }) {
  const { direction } = useAppLocale();
  return <div className="flex h-full min-h-0 flex-1 flex-col p-4 lg:p-6" dir={direction} style={{ scrollbarWidth: 'none' }}>{children}</div>;
}

interface TableListLayoutProps {
  toolbar: React.ComponentProps<typeof TableFiltersBar>;
  header: React.ReactNode;
  children: React.ReactNode;
  fillHeight?: boolean;
  loading?: boolean;
  columnCount: number;
  emptyState?: React.ReactNode;
  pagination?: React.ComponentProps<typeof TablePagination>;
}

export function TableListLayout({ toolbar, header, children, fillHeight = false, loading = false, columnCount, emptyState, pagination }: TableListLayoutProps) {
  const { direction } = useAppLocale();
  return <div data-slot="table-list-layout" className={fillHeight ? 'flex min-h-0 flex-1 flex-col gap-2.5' : 'space-y-2.5'} dir={direction} style={{ scrollbarWidth: 'none' }}>
    <TableFiltersBar {...toolbar} />
    <ActiveColumnFilters />
    <div className={fillHeight ? 'flex min-h-0 flex-col' : undefined}>
      <Table
        dir={direction}
        containerClassName={fillHeight ? 'min-h-0 overflow-y-auto overscroll-contain' : 'max-h-[70vh] overflow-y-auto overscroll-contain'}
        containerStyle={{ scrollbarWidth: 'none' }}
        showTrailingRowBorder={fillHeight}
      >
        <TableHeader className="bg-card sticky top-0 z-0">{header}</TableHeader>
        <TableBody>{loading ? Array.from({ length: 14 }, (_, row) => <TableRow key={row}>
          {Array.from({ length: columnCount }, (_, column) => <TableCell key={column}><Skeleton className="my-2 h-4 w-[70%]" /></TableCell>)}
        </TableRow>) : emptyState ? <TableRow><TableCell colSpan={columnCount} className="h-24 text-center text-muted-foreground">{emptyState}</TableCell></TableRow> : children}</TableBody>
      </Table>
    </div>
    {pagination && <TablePagination {...pagination} className="mt-0" />}
  </div>;
}
