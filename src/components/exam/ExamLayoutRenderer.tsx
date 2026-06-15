import React, { useEffect, useMemo, useState } from "react";
import {
  ExamCardRenderer,
  CardItem,
  DetailProps,
  hasNoteCard,
} from "@/components/exam/ExamCardRenderer";
import { ExamFieldMapper, ExamComponentType } from "@/lib/exam-field-mappings";
import { CardRow } from "@/pages/exam-detail/types";
import { ExamGridLayout } from "@/components/exam/ExamGridLayout";
import {
  GridLayoutItem,
  legacyRowsToGridItems,
  sortGridItems,
} from "@/pages/exam-detail/utils";

interface ExamLayoutRendererProps {
  cardRows: CardRow[];
  customWidths: Record<string, Record<string, number>>;
  gridItems?: GridLayoutItem[];
  rowWidths: Record<string, number>;
  rowRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  isEditing: boolean;
  detailProps: DetailProps;
  clipboardContentType: ExamComponentType | null;
  activeCoverTestTabs: Record<string, number>;
  computedCoverTestTabs: Record<string, string[]>;
  activeOldRefractionTabs: Record<string, string>;
  computedOldRefractionTabs: Record<string, string[]>;
  examFormData: Record<string, any>;
  setExamFormData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  toolboxActions: {
    clearData: (type: ExamComponentType, key?: string) => void;
    copyToLeft: (
      sourceType: ExamComponentType,
      targetType: ExamComponentType,
      sourceKey?: string,
      targetKey?: string,
    ) => void;
    copyToRight: (
      sourceType: ExamComponentType,
      targetType: ExamComponentType,
      sourceKey?: string,
      targetKey?: string,
    ) => void;
    copyToBelow: (
      sourceType: ExamComponentType,
      targetType: ExamComponentType,
      sourceKey?: string,
      targetKey?: string,
    ) => void;
    copyEyeRow: (
      componentType: ExamComponentType,
      fromEye: "R" | "L",
      key?: string,
    ) => void;
  };
  onCopy: (card: CardItem) => void;
  onPaste: (card: CardItem) => void;
}

export function ExamLayoutRenderer({
  cardRows,
  customWidths,
  gridItems,
  isEditing,
  detailProps,
  clipboardContentType,
  activeCoverTestTabs,
  computedCoverTestTabs,
  activeOldRefractionTabs,
  computedOldRefractionTabs,
  examFormData,
  setExamFormData,
  toolboxActions,
  onCopy,
  onPaste,
}: ExamLayoutRendererProps) {
  const layoutItems = useMemo(
    () =>
      gridItems && gridItems.length > 0
        ? sortGridItems(gridItems)
        : legacyRowsToGridItems(cardRows, customWidths),
    [gridItems, cardRows, customWidths],
  );

  const rowRenderKey = useMemo(
    () =>
      layoutItems
        .map(
          (item) =>
            `${item.id}:${item.type}:${item.title || ""}:${item.x}:${item.y}:${item.w}:${item.showEyeLabels ? "1" : "0"}`,
        )
        .join("|"),
    [layoutItems],
  );

  const lanes = useMemo(() => {
    const maxLane = layoutItems.reduce(
      (max, item) => Math.max(max, item.y),
      -1,
    );
    return Array.from(
      { length: Math.max(0, maxLane + 1) },
      (_, index) => index,
    );
  }, [layoutItems]);
  const [visibleRowCount, setVisibleRowCount] = useState(() =>
    Math.min(3, lanes.length),
  );

  useEffect(() => {
    const initialCount = Math.min(3, lanes.length);
    setVisibleRowCount(initialCount);
    if (lanes.length <= initialCount) return;

    let frameId = 0;
    let nextCount = initialCount;
    const mountNextBatch = () => {
      nextCount = Math.min(lanes.length, nextCount + 4);
      setVisibleRowCount(nextCount);
      if (nextCount < lanes.length) {
        frameId = window.requestAnimationFrame(mountNextBatch);
      }
    };

    frameId = window.requestAnimationFrame(mountNextBatch);
    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [rowRenderKey, lanes.length]);

  const visibleLaneSet = useMemo(
    () => new Set(lanes.slice(0, visibleRowCount)),
    [lanes, visibleRowCount],
  );

  const visibleItems = useMemo(
    () => layoutItems.filter((item) => visibleLaneSet.has(item.y)),
    [layoutItems, visibleLaneSet],
  );

  const layoutRows = useMemo(
    () => {
      const sortedItems = sortGridItems(layoutItems);
      return lanes.map((lane) =>
        sortedItems
          .filter((item) => item.y === lane)
          .map(({ x, y, w, ...card }) => card),
      );
    },
    [lanes, layoutItems],
  );

  const detailPropsWithLayoutRows = useMemo(
    () => ({
      ...detailProps,
      allRows: layoutRows,
    }),
    [detailProps, layoutRows],
  );

  const getCardKey = (card: CardItem) => {
    if (card.type === "cover-test") {
      const activeTabIndex = activeCoverTestTabs[card.id] ?? 0;
      const activeTabId = computedCoverTestTabs[card.id]?.[activeTabIndex];
      return activeTabId ? `cover-test-${card.id}-${activeTabId}` : undefined;
    } else if (card.type === "old-refraction") {
      const activeTabId =
        activeOldRefractionTabs[card.id] ||
        computedOldRefractionTabs[card.id]?.[0];
      return activeTabId
        ? `old-refraction-${card.id}-${activeTabId}`
        : undefined;
    }
    return `${card.type}-${card.id}`;
  };

  const findCompatibleTarget = (
    source: GridLayoutItem,
    direction: "left" | "right" | "below",
  ) => {
    const sourceType = source.type as ExamComponentType;
    const candidates = layoutItems.filter((candidate) => {
      if (candidate.id === source.id || candidate.type === "notes")
        return false;
      const available = ExamFieldMapper.getAvailableTargets(sourceType, [
        candidate.type as ExamComponentType,
      ]);
      return available.length > 0;
    });

    if (direction === "left") {
      return candidates
        .filter(
          (candidate) => candidate.y === source.y && candidate.x < source.x,
        )
        .sort((a, b) => b.x + b.w - (a.x + a.w))[0];
    }

    if (direction === "right") {
      return candidates
        .filter(
          (candidate) => candidate.y === source.y && candidate.x > source.x,
        )
        .sort((a, b) => a.x - b.x)[0];
    }

    return candidates
      .filter((candidate) => candidate.y > source.y)
      .sort((a, b) => {
        if (a.y !== b.y) return a.y - b.y;
        return Math.abs(a.x - source.x) - Math.abs(b.x - source.x);
      })[0];
  };

  return (
    <div
      data-clinical-nav-scope="true"
      className="no-scrollbar"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <ExamGridLayout
        items={visibleItems}
        lanes={lanes.slice(0, visibleRowCount)}
        renderItem={(item, cardIndex, laneItems) => {
          const rowIndex = lanes.findIndex((lane) => lane === item.y);
          return (
            <div
              data-clinical-nav-card="true"
              style={{
                contentVisibility: "auto",
                containIntrinsicSize: "0 190px",
              }}
            >
              <ExamCardRenderer
                item={item}
                rowCards={laneItems}
                isEditing={isEditing}
                mode="detail"
                detailProps={detailPropsWithLayoutRows}
                hideEyeLabels={item.showEyeLabels === false}
                matchHeight={hasNoteCard(laneItems) && laneItems.length > 1}
                currentRowIndex={rowIndex}
                currentCardIndex={cardIndex}
                clipboardSourceType={clipboardContentType}
                onCopy={() => onCopy(item)}
                onPaste={() => onPaste(item)}
                onClearData={() => {
                  const key = getCardKey(item);
                  if (item.type === "cover-test" && key) {
                    setExamFormData((prev) => ({
                      ...prev,
                      [key]: {
                        ...prev[key],
                        deviation_type: "",
                        deviation_direction: "",
                        fv_1: "",
                        fv_2: "",
                        nv_1: "",
                        nv_2: "",
                        __deleted: true,
                      },
                    }));
                  } else if (item.type === "old-refraction" && key) {
                    const currentData = examFormData[key];
                    if (currentData) {
                      const cleared = ExamFieldMapper.clearData(
                        currentData,
                        "old-refraction",
                      );
                      setExamFormData((prev) => ({
                        ...prev,
                        [key]: { ...prev[key], ...cleared },
                      }));
                    }
                  }
                  toolboxActions.clearData(item.type as ExamComponentType, key);
                }}
                onCopyLeft={() => {
                  const sourceKey = getCardKey(item);
                  const target = findCompatibleTarget(item, "left");
                  if (target) {
                    toolboxActions.copyToLeft(
                      item.type as ExamComponentType,
                      target.type as ExamComponentType,
                      sourceKey,
                      getCardKey(target),
                    );
                  }
                }}
                onCopyRight={() => {
                  const sourceKey = getCardKey(item);
                  const target = findCompatibleTarget(item, "right");
                  if (target) {
                    toolboxActions.copyToRight(
                      item.type as ExamComponentType,
                      target.type as ExamComponentType,
                      sourceKey,
                      getCardKey(target),
                    );
                  }
                }}
                onCopyBelow={() => {
                  const sourceKey = getCardKey(item);
                  const target = findCompatibleTarget(item, "below");
                  if (target) {
                    toolboxActions.copyToBelow(
                      item.type as ExamComponentType,
                      target.type as ExamComponentType,
                      sourceKey,
                      getCardKey(target),
                    );
                  }
                }}
                onCopyToRightEye={() => {
                  toolboxActions.copyEyeRow(
                    item.type as ExamComponentType,
                    "L",
                    getCardKey(item),
                  );
                }}
                onCopyToLeftEye={() => {
                  toolboxActions.copyEyeRow(
                    item.type as ExamComponentType,
                    "R",
                    getCardKey(item),
                  );
                }}
              />
            </div>
          );
        }}
      />
    </div>
  );
}
