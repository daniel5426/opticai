import React from "react";
import { cn } from "@/lib/utils";
import { ExamLayoutLane } from "./ExamLayoutLane";
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
  separators?: boolean;
  compact?: boolean;
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
  separators = false,
  compact = false,
  renderItem,
}: ExamGridLayoutProps) {
  const [heights, setHeights] = React.useState<Record<string, number>>({});
  const contentRefs = React.useRef(new Map<string, HTMLDivElement>());
  const measurementKey = items.map(item => item.id).join('|');
  React.useLayoutEffect(() => {
    if (!compact) return;
    const observer = new ResizeObserver(entries => {
      setHeights(previous => {
        const next = {...previous};
        let changed = false;
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.compactCardId!;
          const height = Math.ceil(entry.target.getBoundingClientRect().height) + 16;
          if (next[id] !== height) {next[id] = height; changed = true;}
        }
        return changed ? next : previous;
      });
    });
    contentRefs.current.forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [compact, measurementKey]);
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

  if (!compact) {
    return (
      <div className={cn("flex w-full min-w-0 flex-col gap-4", separators && "gap-0", className)} dir="ltr">
        {resolvedLanes.map(lane => {
          const laneItems = sortedItems.filter(item => item.y === lane);
          return (
            <ExamLayoutLane key={lane} items={laneItems} columns={columns}
              style={{ minHeight: laneItems.length ? undefined : EXAM_LAYOUT_LANE_MIN_HEIGHT_PX }}>
              {(item, index, style) => (
                <div className={cn("min-w-0", item.type === "notes" && "h-full self-stretch", separators && "border-border border px-5 py-3", itemClassName)} style={style}>
                  {renderItem(item, index, laneItems)}
                </div>
              )}
            </ExamLayoutLane>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={cn("grid w-full gap-4", separators && "gap-0", className)}
      dir="ltr"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        alignItems: "start",
        ...(compact ? {gridAutoRows:"1px",gridAutoFlow:"row dense",rowGap:0} : {}),
        alignContent: separators ? "start" : undefined,
      }}
    >
      {!compact && resolvedLanes.map((lane) => {
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
      {separators && sortedItems.map((item) => {
        const laneItems = sortedItems.filter((candidate) => candidate.y === item.y);
        const nextItem = laneItems[laneItems.findIndex((candidate) => candidate.id === item.id) + 1];
        const hasStartSeparator = laneItems[0]?.id !== item.id || item.x > 0;
        const hasEndSeparator = item.x + item.w < (nextItem?.x ?? columns);

        return (
          <div
            key={`card-separator-${item.id}`}
            aria-hidden="true"
            className="pointer-events-none relative self-stretch"
            style={{
              gridColumn: `${Math.floor(item.x) + 1} / span ${Math.ceil(item.w)}`,
              gridRow: item.y + 1,
            }}
          >
            {item.y !== resolvedLanes[0] && <div className="absolute inset-x-0 top-0 border-t border-border" />}
            <div className="absolute inset-x-0 -bottom-px border-t border-border" />
            {hasStartSeparator && <div className="absolute inset-y-0 start-0 border-s border-border" />}
            {hasEndSeparator && <div className="absolute inset-y-0 end-0 border-e border-border" />}
          </div>
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
            className={cn(
              "min-w-0",
              separators && "self-stretch px-5 py-3",
              item.type === "notes" && !compact && "h-full self-stretch",
              itemClassName,
            )}
            style={{
              gridColumn: `span ${Math.ceil(item.w)}`,
              gridRow: compact ? `span ${heights[item.id] || 200}` : item.y + 1,
            }}
          >
            <div className={!compact ? "contents" : undefined} data-compact-card-id={item.id} ref={element => {if (element) contentRefs.current.set(item.id, element); else contentRefs.current.delete(item.id);}}>
              {renderItem(item, laneIndex, laneItems)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
