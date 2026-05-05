import React from "react";
import { cn } from "@/lib/utils";
import {
  EXAM_LAYOUT_GRID_COLUMNS,
  GridLayoutItem,
  sortGridItems,
} from "@/pages/exam-detail/utils";

interface ExamGridLayoutProps {
  items: GridLayoutItem[];
  columns?: number;
  className?: string;
  itemClassName?: string;
  renderItem: (
    item: GridLayoutItem,
    index: number,
    laneItems: GridLayoutItem[],
  ) => React.ReactNode;
}

export function ExamGridLayout({
  items,
  columns = EXAM_LAYOUT_GRID_COLUMNS,
  className,
  itemClassName,
  renderItem,
}: ExamGridLayoutProps) {
  const sortedItems = sortGridItems(items);

  return (
    <div
      className={cn("grid w-full gap-4", className)}
      dir="ltr"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        alignItems: "start",
      }}
    >
      {sortedItems.map((item) => {
        const laneItems = sortedItems.filter(
          (candidate) => candidate.y === item.y,
        );
        const laneIndex = laneItems.findIndex(
          (candidate) => candidate.id === item.id,
        );

        return (
          <div
            key={item.id}
            className={cn("min-w-0", itemClassName)}
            style={{
              gridColumn: `${item.x + 1} / span ${item.w}`,
              gridRow: item.y + 1,
            }}
          >
            {renderItem(item, laneIndex, laneItems)}
          </div>
        );
      })}
    </div>
  );
}
