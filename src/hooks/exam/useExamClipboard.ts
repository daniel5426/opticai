import { useState, useCallback } from "react";
import { toast } from "sonner";
import { CardItem } from "@/components/exam/ExamCardRenderer";
import { ExamComponentType } from "@/lib/exam-field-mappings";
import { copyToClipboard, pasteFromClipboard, getClipboardContentType } from "@/lib/exam-clipboard";
import { ExamFieldMapper } from "@/lib/exam-field-mappings";
import { inputSyncManager } from "@/components/exam/shared/OptimizedInputs";

interface UseExamClipboardParams {
  getExamFormData: () => Record<string, any>;
  fieldHandlers: Record<string, (field: string, value: string) => void>;
  activeCoverTestTabs: Record<string, number>;
  computedCoverTestTabs: Record<string, string[]>;
  activeOldRefractionTabs: Record<string, string>;
  computedOldRefractionTabs: Record<string, string[]>;
}

export function useExamClipboard({
  getExamFormData,
  fieldHandlers,
  activeCoverTestTabs,
  computedCoverTestTabs,
  activeOldRefractionTabs,
  computedOldRefractionTabs,
}: UseExamClipboardParams) {
  const [clipboardContentType, setClipboardContentType] =
    useState<ExamComponentType | null>(getClipboardContentType());

  const handleCopy = useCallback(
    (card: CardItem) => {
      // Flush any pending updates from optimized components before copying
      inputSyncManager.flush();
      
      const examFormData = getExamFormData();
      const cardType = card.type as ExamComponentType;
      const cardId = card.id;
      let cardData;

      if (cardType === "cover-test") {
        const activeTabIndex = activeCoverTestTabs[cardId] ?? 0;
        const activeTabId = computedCoverTestTabs[cardId]?.[activeTabIndex];
        const key = `cover-test-${cardId}-${activeTabId}`;
        cardData = examFormData[key];
      } else if (cardType === "old-refraction") {
        // activeOldRefractionTabs now stores tabId directly
        const activeTabId = activeOldRefractionTabs[cardId] || computedOldRefractionTabs[cardId]?.[0];
        const key = `old-refraction-${cardId}-${activeTabId}`;
        cardData = examFormData[key];
      } else {
        // Prefer instance-specific key, fallback to base type
        cardData = examFormData[`${cardType}-${cardId}`] || examFormData[cardType];
      }
      if (!cardData) {
        toast.error("אין נתונים להעתקה");
        return;
      }
      copyToClipboard(cardType, cardData);
      setClipboardContentType(cardType);
      toast.success("הבלוק הועתק", {
        description: `סוג: ${cardType}`,
        duration: 2000,
      });
    },
    [getExamFormData, activeCoverTestTabs, computedCoverTestTabs, activeOldRefractionTabs, computedOldRefractionTabs],
  );

  const handlePaste = useCallback(
    (targetCard: CardItem) => {
      // Flush any pending updates from optimized components before pasting
      inputSyncManager.flush();

      const examFormData = getExamFormData();
      const clipboardContent = pasteFromClipboard();
      if (!clipboardContent) {
        toast.error("אין מידע בלוח ההעתקה");
        return;
      }

      const { type: sourceType, data: sourceData } = clipboardContent;
      const targetType = targetCard.type as ExamComponentType;
      const targetCardId = targetCard.id;
      let targetData: any,
        targetChangeHandler: ((field: string, value: string) => void) | undefined;

      if (targetType === "cover-test") {
        const activeTabIndex = activeCoverTestTabs[targetCardId] ?? 0;
        const activeTabId = computedCoverTestTabs[targetCardId]?.[activeTabIndex];
        const key = `cover-test-${targetCardId}-${activeTabId}`;
        targetData = examFormData[key];
        targetChangeHandler = fieldHandlers[key];
      } else if (targetType === "old-refraction") {
        // activeOldRefractionTabs now stores tabId directly
        const activeTabId = activeOldRefractionTabs[targetCardId] || computedOldRefractionTabs[targetCardId]?.[0];
        const key = `old-refraction-${targetCardId}-${activeTabId}`;
        targetData = examFormData[key];
        targetChangeHandler = fieldHandlers[key];
      } else {
        const key = `${targetType}-${targetCardId}`;
        targetData = examFormData[key] || examFormData[targetType];
        targetChangeHandler = fieldHandlers[key] || fieldHandlers[targetType];
      }
      if (!targetData || !targetChangeHandler) {
        toast.error("לא ניתן להדביק לבלוק זה");
        return;
      }
      const isCompatible =
        sourceType === targetType ||
        ExamFieldMapper.getAvailableTargets(sourceType, [targetType]).includes(
          targetType,
         );
      if (!isCompatible) {
        toast.error("העתקה לא נתמכת", {
          description: `לא ניתן להעתיק מ'${sourceType}' ל'${targetType}'.`,
        });
        return;
      }
      const copiedData = ExamFieldMapper.copyData(
        sourceData as any,
        targetData as any,
        sourceType,
        targetType,
      );
      Object.entries(copiedData).forEach(([k, value]) => {
        if (
          k !== "id" &&
          k !== "layout_instance_id" &&
          value !== undefined &&
          targetChangeHandler
        ) {
          targetChangeHandler(k, String(value ?? ""));
        }
      });
      toast.success("הנתונים הודבקו בהצלחה", {
        description: `מ'${sourceType}' ל'${targetType}'.`,
        duration: 2000,
      });
    },
    [getExamFormData, fieldHandlers, activeCoverTestTabs, computedCoverTestTabs, activeOldRefractionTabs, computedOldRefractionTabs],
  );

  return {
    clipboardContentType,
    setClipboardContentType,
    handleCopy,
    handlePaste,
  };
}
