import React from "react";
import { cn } from "@/lib/utils";
import {
  computeCardMinGridCols,
  EXAM_LAYOUT_GRID_COLUMNS,
  EXAM_LAYOUT_REFERENCE_WIDTH_PX,
  getOccupiedExamColumns,
  type GridLayoutItem,
} from "@/pages/exam-detail/utils";

export const EXAM_CARD_GAP_PX = 16;
export const examColumnPitch = (columns = EXAM_LAYOUT_GRID_COLUMNS) =>
  (EXAM_LAYOUT_REFERENCE_WIDTH_PX + EXAM_CARD_GAP_PX) / columns;
export const examCardWidth = (width: number, columns = EXAM_LAYOUT_GRID_COLUMNS) =>
  width * examColumnPitch(columns) - EXAM_CARD_GAP_PX;

export function examLaneColumnLimit(lane: HTMLElement | null, items: GridLayoutItem[]) {
  if (!lane) return getOccupiedExamColumns(items);
  const style = getComputedStyle(lane);
  const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
  const visibleColumns = (lane.clientWidth - padding + EXAM_CARD_GAP_PX) / examColumnPitch();
  return Math.max(visibleColumns, getOccupiedExamColumns(items));
}

/** Use empty space first, then the width above each card's minimum. */
export const ExamLayoutLane = React.forwardRef<HTMLDivElement, {
  items: GridLayoutItem[];
  columns?: number;
  children: (item: GridLayoutItem, index: number, style: React.CSSProperties) => React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "children">>(function ExamLayoutLane(
  { items, columns = EXAM_LAYOUT_GRID_COLUMNS, className, children, ...props }, ref,
) {
  const cardWidths = items.map(item => {
    const minColumns = Math.min(item.w, computeCardMinGridCols(item.type, columns));
    return {
      preferred: examCardWidth(item.w, columns),
      minimum: examCardWidth(minColumns, columns),
    };
  });
  const minWidth = cardWidths.reduce((total, card) => total + card.minimum, 0)
    + Math.max(0, items.length - 1) * EXAM_CARD_GAP_PX;
  const totalStretch = cardWidths.reduce((total, card) => total + card.preferred - card.minimum, 0);
  return (
    <div tabIndex={0} {...props} ref={ref} data-exam-lane className={cn("app-scrollbar min-w-0 overflow-x-auto rounded-sm focus-visible:outline-2 focus-visible:outline-ring", className)} dir="ltr">
      <div className="flex w-full items-stretch" style={{ minWidth }}>
        {items.map((item, index) => {
          const previous = items[index - 1];
          const emptyColumns = Math.max(0, item.x - (previous ? previous.x + previous.w : 0));
          const gap = previous ? EXAM_CARD_GAP_PX : 0;
          const { preferred, minimum } = cardWidths[index];
          const stretch = preferred - minimum;
          // Cards share available width above the row minimum. Saved gaps can
          // shrink independently and never reserve room ahead of a wider card.
          const maxWidth = stretch > 0
            ? `clamp(${minimum}px, ${minimum}px + (100% - ${minWidth}px) * ${stretch / totalStretch}, ${preferred}px)`
            : undefined;
          return (
            <React.Fragment key={item.id}>
              <div aria-hidden="true" style={{ flexBasis: emptyColumns * examColumnPitch(columns) + gap, flexShrink: 1, minWidth: gap }} />
              {children(item, index, { width: preferred, maxWidth, flexShrink: 0 })}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
});

export function examCardColumnOffset(item: GridLayoutItem, clientX: number, rect: DOMRect) {
  const renderedWidth = rect.right - rect.left;
  const scale = renderedWidth > 0 ? examCardWidth(item.w) / renderedWidth : 1;
  return (clientX - rect.left) * scale / examColumnPitch();
}

/** Translate the rendered card and gap positions back to saved columns. */
export function examColumnFromPointer(lane: HTMLElement, clientX: number, items: GridLayoutItem[]) {
  const cards = Array.from(lane.querySelectorAll<HTMLElement>("[data-grid-card]"));
  let previousRight = lane.getBoundingClientRect().left + parseFloat(getComputedStyle(lane).paddingLeft || "0") - lane.scrollLeft;
  let previousColumn = 0;
  for (const item of items) {
    const card = cards.find(element => element.dataset.gridCard === item.id);
    if (!card) continue;
    const rect = card.getBoundingClientRect();
    if (clientX < rect.left) {
      const fraction = Math.max(0, (clientX - previousRight) / Math.max(1, rect.left - previousRight));
      return previousColumn + fraction * (item.x - previousColumn);
    }
    if (clientX <= rect.right) return item.x + examCardColumnOffset(item, clientX, rect);
    previousRight = rect.right;
    previousColumn = item.x + item.w;
  }
  return previousColumn + (clientX - previousRight - (items.length ? EXAM_CARD_GAP_PX : 0)) / examColumnPitch();
}
