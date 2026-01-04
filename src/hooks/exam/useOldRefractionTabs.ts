import { useMemo, useCallback, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { CardRow } from "@/pages/exam-detail/types";

interface UseOldRefractionTabsParams {
  cardRows: CardRow[];
  examFormData: Record<string, any>;
  setExamFormData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  activeInstanceId: number | null;
  loading: boolean;
}

export function useOldRefractionTabs({
  cardRows,
  examFormData,
  setExamFormData,
  activeInstanceId,
  loading,
}: UseOldRefractionTabsParams) {
  // Compute old refraction tabs from form data
  const computedOldRefractionTabs = useMemo(() => {
    const map: Record<string, string[]> = {};
    const oldRefractionCardIds: string[] = [];
    cardRows.forEach((row) => {
      row.cards.forEach((card) => {
        if (card.type === "old-refraction") oldRefractionCardIds.push(card.id);
      });
    });
    oldRefractionCardIds.forEach((cardId) => {
      const keys = Object.keys(examFormData).filter((k) =>
        k.startsWith(`old-refraction-${cardId}-`),
      );
      if (keys.length === 0) return;
      const pairs = keys.map((k) => ({
        tabId: k.replace(`old-refraction-${cardId}-`, ""),
        idx: Number((examFormData[k]?.tab_index ?? 0) as any) || 0,
      }));
      pairs.sort((a, b) => a.idx - b.idx);
      map[cardId] = pairs.map((p) => p.tabId);
    });
    return map;
  }, [examFormData, JSON.stringify(cardRows)]);

  // Track active tab index for each old refraction card
  const [activeOldRefractionTabs, setActiveOldRefractionTabs] = useState<
    Record<string, number>
  >({});

  // Initialize first tab for old-refraction cards if none exist
  useEffect(() => {
    if (loading) return;
    const oldRefractionCardIds: string[] = [];
    cardRows.forEach((row) =>
      row.cards.forEach((card) => {
        if (card.type === "old-refraction") oldRefractionCardIds.push(card.id);
      }),
    );
    if (oldRefractionCardIds.length === 0) return;

    let changed = false;
    const updates: Record<string, any> = {};
    oldRefractionCardIds.forEach((cardId) => {
      const keys = Object.keys(examFormData).filter((k) =>
        k.startsWith(`old-refraction-${cardId}-`),
      );
      if (keys.length === 0) {
        const tabId = uuidv4();
        const key = `old-refraction-${cardId}-${tabId}`;
        updates[key] = {
          card_instance_id: tabId,
          card_id: cardId,
          tab_index: 0,
          layout_instance_id: activeInstanceId,
          r_glasses_type: "רחוק",
          l_glasses_type: "רחוק",
        };
        changed = true;
        setActiveOldRefractionTabs((prev) => ({ ...prev, [cardId]: 0 }));
      }
    });
    if (changed) setExamFormData((prev) => ({ ...prev, ...updates }));
  }, [JSON.stringify(cardRows), activeInstanceId, loading, examFormData, setExamFormData]);

  // Add a new tab to an old refraction card
  const addOldRefractionTab = useCallback(
    (cardId: string, type: string) => {
      const newTabId = uuidv4();
      const keyPrefix = `old-refraction-${cardId}-`;
      const currentTabs = Object.keys(examFormData).filter((k) =>
        k.startsWith(keyPrefix),
      );
      const tabIndex = currentTabs.length;
      setExamFormData((formData) => ({
        ...formData,
        [`${keyPrefix}${newTabId}`]: {
          card_instance_id: newTabId,
          card_id: cardId,
          tab_index: tabIndex,
          layout_instance_id: activeInstanceId,
          r_glasses_type: type,
          l_glasses_type: type,
        },
      }));
      setActiveOldRefractionTabs((prev) => ({ ...prev, [cardId]: tabIndex }));
    },
    [examFormData, activeInstanceId, setExamFormData],
  );

  // Update a tab's type
  const updateOldRefractionTabType = useCallback(
    (cardId: string, tabIdx: number, newType: string) => {
      const tabs = computedOldRefractionTabs[cardId] || [];
      const tabId = tabs[tabIdx];
      if (!tabId) return;
      const key = `old-refraction-${cardId}-${tabId}`;
      setExamFormData((prev) => ({
        ...prev,
        [key]: {
          ...(prev[key] || {}),
          r_glasses_type: newType,
          l_glasses_type: newType,
        },
      }));
    },
    [computedOldRefractionTabs, setExamFormData],
  );

  // Remove a tab from an old refraction card
  const removeOldRefractionTab = useCallback(
    (cardId: string, tabIdx: number) => {
      const tabs = computedOldRefractionTabs[cardId] || [];
      if (tabs.length <= 1) return;
      const toRemoveId = tabs[tabIdx];
      const key = `old-refraction-${cardId}-${toRemoveId}`;
      setExamFormData((prev) => {
        const updated = { ...prev };
        delete updated[key];
        // Recompute indices
        const remaining = (computedOldRefractionTabs[cardId] || []).filter(
          (_, i) => i !== tabIdx,
        );
        remaining.forEach((tabId, idx) => {
          const k = `old-refraction-${cardId}-${tabId}`;
          if (updated[k]) updated[k] = { ...updated[k], tab_index: idx };
        });
        return updated;
      });
      setActiveOldRefractionTabs((prev) => ({
        ...prev,
        [cardId]: Math.max(0, Math.min(prev[cardId] || 0, tabs.length - 2)),
      }));
    },
    [computedOldRefractionTabs, setExamFormData],
  );

  // Duplicate a tab
  const duplicateOldRefractionTab = useCallback(
    (cardId: string, tabIdx: number) => {
      const tabs = computedOldRefractionTabs[cardId] || [];
      const toDuplicateId = tabs[tabIdx];
      const sourceKey = `old-refraction-${cardId}-${toDuplicateId}`;
      const sourceData = examFormData[sourceKey];
      if (!sourceData) return;

      const newTabId = uuidv4();
      const keyPrefix = `old-refraction-${cardId}-`;
      const tabIndex = tabs.length;

      setExamFormData((formData) => ({
        ...formData,
        [`${keyPrefix}${newTabId}`]: {
          ...sourceData,
          card_instance_id: newTabId,
          tab_index: tabIndex,
        },
      }));
      setActiveOldRefractionTabs((prev) => ({ ...prev, [cardId]: tabIndex }));
    },
    [computedOldRefractionTabs, examFormData, setExamFormData],
  );

  return {
    computedOldRefractionTabs,
    activeOldRefractionTabs,
    setActiveOldRefractionTabs,
    addOldRefractionTab,
    updateOldRefractionTabType,
    removeOldRefractionTab,
    duplicateOldRefractionTab,
  };
}
