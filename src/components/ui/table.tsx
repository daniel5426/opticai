"use client";

import * as React from "react";

import { cn } from "@/utils/tailwind";

type TableProps = React.ComponentProps<"table"> & {
  containerClassName?: string;
  containerStyle?: React.CSSProperties;
  emptyState?: React.ReactNode;
  showTrailingRowBorder?: boolean;
};

function Table({
  className,
  containerClassName,
  containerStyle,
  emptyState,
  showTrailingRowBorder = false,
  ...props
}: TableProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const tableRef = React.useRef<HTMLTableElement>(null);
  const [hasBottomGap, setHasBottomGap] = React.useState(false);

  React.useLayoutEffect(() => {
    if (!showTrailingRowBorder) {
      setHasBottomGap(false);
      return;
    }

    const updateBottomGap = () => {
      const container = containerRef.current;
      const table = tableRef.current;
      const contentHeight = (table?.offsetHeight || 0) - (hasBottomGap ? 1 : 0);
      setHasBottomGap(Boolean(container && table && contentHeight < container.clientHeight - 1));
    };

    updateBottomGap();
    const observer = new ResizeObserver(updateBottomGap);
    if (containerRef.current) observer.observe(containerRef.current);
    if (tableRef.current) observer.observe(tableRef.current);
    return () => observer.disconnect();
  }, [hasBottomGap, showTrailingRowBorder, props.children]);

  return (
    <div
      ref={containerRef}
      data-slot="table-container"
      className={cn(
        "relative w-full overflow-x-auto rounded-md border",
        containerClassName,
      )}
      style={containerStyle}
    >
      <table
        ref={tableRef}
        data-slot="table"
        className={cn(
          "w-full caption-bottom text-sm",
          hasBottomGap && "[&_tbody_tr:last-child]:border-b",
          className,
        )}
        {...props}
      />
      {emptyState ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 top-10 flex items-center justify-center px-4 text-center text-muted-foreground">
          {emptyState}
        </div>
      ) : null}
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("z-0 [&_tr]:border-b", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
