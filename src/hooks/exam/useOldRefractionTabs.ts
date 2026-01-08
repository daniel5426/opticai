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
    
    // Efficiently gather card IDs
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
    // We only want to recompute if the keys or indices change.
    // However, examFormData changes on every edit.
    // Ideally we should use a custom comparison or ref, but for now let's keep it simple
    // and rely on the fact that if this returns a new object, we need to make sure downstream
    // consumers (like createFieldHandlers) are memoized correctly or handle it.
    // IMPROVEMENT: We can use JSON.stringify on the relevant subset of data, but that's expensive.
    // Better: Trust that the memoization in ExamDetailPage will handle the handlers.
    // But wait, if this returns a new object, the memo in ExamDetailPage will re-run.
    // So we MUST stabilize this output.
  }, [
    // We need a stable representation of the tabs structure.
    // Construct a string key: cardId:tabId:index|...
    Object.keys(examFormData)
        .filter(k => k.startsWith('old-refraction-'))
        .sort()
        .map(k => `${k}:${(examFormData[k] as any)?.tab_index}`)
        .join('|'),
    JSON.stringify(cardRows)
  ]);

  // Track active tabId for each old refraction card (storing UUID directly, not index)
  const [activeOldRefractionTabs, setActiveOldRefractionTabs] = useState<
    Record<string, string>
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
        setActiveOldRefractionTabs((prev) => ({ ...prev, [cardId]: tabId }));
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
      setActiveOldRefractionTabs((prev) => ({ ...prev, [cardId]: newTabId }));
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
      // After deletion, set active to the first remaining tab
      const remaining = tabs.filter((_, i) => i !== tabIdx);
      setActiveOldRefractionTabs((prev) => ({
        ...prev,
        [cardId]: remaining[0] || "",
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
      setActiveOldRefractionTabs((prev) => ({ ...prev, [cardId]: newTabId }));
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
