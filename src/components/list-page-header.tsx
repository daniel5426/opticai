import type { ReactNode } from "react";

import { cn } from "@/utils/tailwind";

interface ListPageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function ListPageHeader({
  title,
  description,
  actions,
  className,
}: ListPageHeaderProps) {
  return (
    <header
      className={cn(
        "mb-5 flex shrink-0 flex-wrap items-start justify-between gap-4",
        className,
      )}
      dir="rtl"
    >
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {description ? (
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
