import * as React from "react"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"

import { TableHead } from "@/components/ui/table"
import { SortState, toggleSort } from "@/lib/table-sorting"
import { cn } from "@/utils/tailwind"

type SortableTableHeadProps = React.ComponentProps<typeof TableHead> & {
  sortKey: string
  sort?: SortState
  onSortChange: (sort: SortState) => void
}

export function SortableTableHead({
  sortKey,
  sort,
  onSortChange,
  className,
  children,
  ...props
}: SortableTableHeadProps) {
  const active = sort?.key === sortKey
  const Icon = active ? (sort.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown

  return (
    <TableHead
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
      className={className}
      {...props}
    >
      <button
        type="button"
        onClick={() => onSortChange(toggleSort(sort, sortKey))}
        className={cn(
          "inline-flex h-8 items-center gap-1 rounded-md px-1 text-right hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "rtl:flex-row-reverse",
        )}
      >
        <span>{children}</span>
        <Icon className={cn("h-3.5 w-3.5", active ? "text-foreground" : "text-muted-foreground")} />
      </button>
    </TableHead>
  )
}
