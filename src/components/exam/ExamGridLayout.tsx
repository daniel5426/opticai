import React from "react";
import { cn } from "@/lib/utils";
import {
  EXAM_LAYOUT_GRID_COLUMNS,
  GridLayoutItem,
  sortGridItems,
} from "@/pages/exam-detail/utils";

export const EXAM_LAYOUT_LANE_MIN_HEIGHT_PX = 178;

interface ExamGridLayoutProps {
  items: GridLayoutItem[];
  lanes?: number[];
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
  lanes,
  columns = EXAM_LAYOUT_GRID_COLUMNS,
  className,
  itemClassName,
  renderItem,
}: ExamGridLayoutProps) {
  const sortedItems = sortGridItems(items);
  const resolvedLanes = React.useMemo(() => {
    if (lanes && lanes.length) return lanes;
    const maxLane = sortedItems.reduce(
      (max, item) => Math.max(max, item.y),
      -1,
    );
    return Array.from(
      { length: Math.max(0, maxLane + 1) },
      (_, index) => index,
    );
  }, [lanes, sortedItems]);

  return (
    <div
      className={cn("grid w-full gap-4", className)}
      dir="ltr"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        alignItems: "start",
      }}
    >
      {resolvedLanes.map((lane) => {
        const laneItems = sortedItems.filter((item) => item.y === lane);
        if (laneItems.length > 0) return null;

        return (
          <div
            key={`lane-placeholder-${lane}`}
            className="col-span-full"
            style={{
              gridColumn: `1 / span ${columns}`,
              gridRow: lane + 1,
              minHeight: EXAM_LAYOUT_LANE_MIN_HEIGHT_PX,
            }}
          />
        );
      })}
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
