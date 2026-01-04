import React from "react";
import {
    ExamCardRenderer,
    CardItem,
    DetailProps,
    calculateCardWidth,
    hasNoteCard,
} from "@/components/exam/ExamCardRenderer";
import { ExamFieldMapper, ExamComponentType } from "@/lib/exam-field-mappings";
import { CardRow } from "@/pages/exam-detail/types";

interface ExamLayoutRendererProps {
    cardRows: CardRow[];
    customWidths: Record<string, Record<string, number>>;
    rowWidths: Record<string, number>;
    rowRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
    isEditing: boolean;
    detailProps: DetailProps;
    clipboardContentType: ExamComponentType | null;
    activeCoverTestTabs: Record<string, number>;
    computedCoverTestTabs: Record<string, string[]>;
    activeOldRefractionTabs: Record<string, number>;
    computedOldRefractionTabs: Record<string, string[]>;
    examFormData: Record<string, any>;
    setExamFormData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    toolboxActions: {
        clearData: (type: ExamComponentType, key?: string) => void;
        copyToLeft: (sourceType: ExamComponentType, targetType: ExamComponentType, sourceKey?: string, targetKey?: string) => void;
        copyToRight: (sourceType: ExamComponentType, targetType: ExamComponentType, sourceKey?: string, targetKey?: string) => void;
        copyToBelow: (sourceType: ExamComponentType, targetType: ExamComponentType, sourceKey?: string, targetKey?: string) => void;
    };
    onCopy: (card: CardItem) => void;
    onPaste: (card: CardItem) => void;
}

export function ExamLayoutRenderer({
    cardRows,
    customWidths,
    rowWidths,
    rowRefs,
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
    return (
        <div
            className="no-scrollbar space-y-4"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
            {cardRows.map((row, rowIndex) => {
                const pxPerCol = rowWidths[row.id] || 1380;
                const cardWidths = calculateCardWidth(
                    row.cards,
                    row.id,
                    customWidths,
                    pxPerCol,
                    "detail",
                );
                return (
                    <div key={row.id} className="w-full">
                        <div
                            className="flex flex-1 gap-4"
                            dir="ltr"
                            ref={(el) => {
                                rowRefs.current[row.id] = el;
                            }}
                        >
                            {row.cards.map((item, cardIndex) => (
                                <div
                                    key={item.id}
                                    style={{
                                        width: `${cardWidths[item.id]}%`,
                                        minWidth: row.cards.length > 1 ? "200px" : "auto",
                                        transition: "width 0.2s ease-out",
                                    }}
                                >
                                    <ExamCardRenderer
                                        item={item}
                                        rowCards={row.cards}
                                        isEditing={isEditing}
                                        mode="detail"
                                        detailProps={detailProps}
                                        hideEyeLabels={cardIndex > 0}
                                        matchHeight={
                                            hasNoteCard(row.cards) && row.cards.length > 1
                                        }
                                        currentRowIndex={rowIndex}
                                        currentCardIndex={cardIndex}
                                        clipboardSourceType={clipboardContentType}
                                        onCopy={() => onCopy(item)}
                                        onPaste={() => onPaste(item)}
                                        onClearData={() => {
                                            if (item.type === "cover-test") {
                                                const cardId = item.id;
                                                const activeTabIndex = activeCoverTestTabs[cardId];
                                                const activeTabId =
                                                    computedCoverTestTabs[cardId]?.[activeTabIndex];
                                                if (activeTabId) {
                                                    const key = `cover-test-${cardId}-${activeTabId}`;
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
                                                    toolboxActions.clearData(
                                                        item.type as ExamComponentType,
                                                        key,
                                                    );
                                                }
                                            } else if (item.type === "old-refraction") {
                                                const cardId = item.id;
                                                const activeTabIndex = activeOldRefractionTabs[cardId];
                                                const activeTabId =
                                                    computedOldRefractionTabs[cardId]?.[activeTabIndex];
                                                if (activeTabId) {
                                                    const key = `old-refraction-${cardId}-${activeTabId}`;
                                                    toolboxActions.clearData(
                                                        item.type as ExamComponentType,
                                                        key,
                                                    );
                                                }
                                            } else {
                                                toolboxActions.clearData(item.type as ExamComponentType);
                                            }
                                        }}
                                        onCopyLeft={() => {
                                            const cardsToTheLeft = row.cards
                                                .slice(0, cardIndex)
                                                .reverse();
                                            for (const card of cardsToTheLeft) {
                                                if (card.type !== "notes") {
                                                    const type = card.type as ExamComponentType;
                                                    const available =
                                                        ExamFieldMapper.getAvailableTargets(
                                                            item.type as ExamComponentType,
                                                            [type],
                                                        );
                                                    if (available.length > 0) {
                                                        let sourceKey, targetKey;
                                                        if (item.type === "cover-test") {
                                                            const cardId = item.id;
                                                            const activeTabIndex = activeCoverTestTabs[cardId];
                                                            const activeTabId =
                                                                computedCoverTestTabs[cardId]?.[activeTabIndex];
                                                            sourceKey = `cover-test-${cardId}-${activeTabId}`;
                                                        } else if (item.type === "old-refraction") {
                                                            const cardId = item.id;
                                                            const activeTabIndex = activeOldRefractionTabs[cardId];
                                                            const activeTabId =
                                                                computedOldRefractionTabs[cardId]?.[activeTabIndex];
                                                            sourceKey = `old-refraction-${cardId}-${activeTabId}`;
                                                        }
                                                        if (card.type === "cover-test") {
                                                            const cardId = card.id;
                                                            const activeTabIndex = activeCoverTestTabs[cardId];
                                                            const activeTabId =
                                                                computedCoverTestTabs[cardId]?.[activeTabIndex];
                                                            targetKey = `cover-test-${cardId}-${activeTabId}`;
                                                        } else if (card.type === "old-refraction") {
                                                            const cardId = card.id;
                                                            const activeTabIndex = activeOldRefractionTabs[cardId];
                                                            const activeTabId =
                                                                computedOldRefractionTabs[cardId]?.[activeTabIndex];
                                                            targetKey = `old-refraction-${cardId}-${activeTabId}`;
                                                        }
                                                        toolboxActions.copyToLeft(
                                                            item.type as ExamComponentType,
                                                            type,
                                                            sourceKey,
                                                            targetKey,
                                                        );
                                                        return;
                                                    }
                                                }
                                            }
                                        }}
                                        onCopyRight={() => {
                                            const cardsToTheRight = row.cards.slice(cardIndex + 1);
                                            for (const card of cardsToTheRight) {
                                                if (card.type !== "notes") {
                                                    const type = card.type as ExamComponentType;
                                                    const available =
                                                        ExamFieldMapper.getAvailableTargets(
                                                            item.type as ExamComponentType,
                                                            [type],
                                                        );
                                                    if (available.length > 0) {
                                                        let sourceKey, targetKey;
                                                        if (item.type === "cover-test") {
                                                            const cardId = item.id;
                                                            const activeTabIndex = activeCoverTestTabs[cardId];
                                                            const activeTabId =
                                                                computedCoverTestTabs[cardId]?.[activeTabIndex];
                                                            sourceKey = `cover-test-${cardId}-${activeTabId}`;
                                                        } else if (item.type === "old-refraction") {
                                                            const cardId = item.id;
                                                            const activeTabIndex = activeOldRefractionTabs[cardId];
                                                            const activeTabId =
                                                                computedOldRefractionTabs[cardId]?.[activeTabIndex];
                                                            sourceKey = `old-refraction-${cardId}-${activeTabId}`;
                                                        }
                                                        if (card.type === "cover-test") {
                                                            const cardId = card.id;
                                                            const activeTabIndex = activeCoverTestTabs[cardId];
                                                            const activeTabId =
                                                                computedCoverTestTabs[cardId]?.[activeTabIndex];
                                                            targetKey = `cover-test-${cardId}-${activeTabId}`;
                                                        } else if (card.type === "old-refraction") {
                                                            const cardId = card.id;
                                                            const activeTabIndex = activeOldRefractionTabs[cardId];
                                                            const activeTabId =
                                                                computedOldRefractionTabs[cardId]?.[activeTabIndex];
                                                            targetKey = `old-refraction-${cardId}-${activeTabId}`;
                                                        }
                                                        toolboxActions.copyToRight(
                                                            item.type as ExamComponentType,
                                                            type,
                                                            sourceKey,
                                                            targetKey,
                                                        );
                                                        return;
                                                    }
                                                }
                                            }
                                        }}
                                        onCopyBelow={() => {
                                            if (rowIndex >= cardRows.length - 1) return;
                                            const belowRow = cardRows[rowIndex + 1].cards;
                                            for (const card of belowRow) {
                                                if (card.type !== "notes") {
                                                    const type = card.type as ExamComponentType;
                                                    const available =
                                                        ExamFieldMapper.getAvailableTargets(
                                                            item.type as ExamComponentType,
                                                            [type],
                                                        );
                                                    if (available.length > 0) {
                                                        let sourceKey, targetKey;
                                                        if (item.type === "cover-test") {
                                                            const cardId = item.id;
                                                            const activeTabIndex = activeCoverTestTabs[cardId];
                                                            const activeTabId =
                                                                computedCoverTestTabs[cardId]?.[activeTabIndex];
                                                            sourceKey = `cover-test-${cardId}-${activeTabId}`;
                                                        } else if (item.type === "old-refraction") {
                                                            const cardId = item.id;
                                                            const activeTabIndex = activeOldRefractionTabs[cardId];
                                                            const activeTabId =
                                                                computedOldRefractionTabs[cardId]?.[activeTabIndex];
                                                            sourceKey = `old-refraction-${cardId}-${activeTabId}`;
                                                        }
                                                        if (card.type === "cover-test") {
                                                            const cardId = card.id;
                                                            const activeTabIndex = activeCoverTestTabs[cardId];
                                                            const activeTabId =
                                                                computedCoverTestTabs[cardId]?.[activeTabIndex];
                                                            targetKey = `cover-test-${cardId}-${activeTabId}`;
                                                        } else if (card.type === "old-refraction") {
                                                            const cardId = card.id;
                                                            const activeTabIndex = activeOldRefractionTabs[cardId];
                                                            const activeTabId =
                                                                computedOldRefractionTabs[cardId]?.[activeTabIndex];
                                                            targetKey = `old-refraction-${cardId}-${activeTabId}`;
                                                        }
                                                        toolboxActions.copyToBelow(
                                                            item.type as ExamComponentType,
                                                            type,
                                                            sourceKey,
                                                            targetKey,
                                                        );
                                                        return;
                                                    }
                                                }
                                            }
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
