import { useMemo, useCallback, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { CardRow } from "@/pages/exam-detail/types";
import {
  ensureTabsMetadataForRows,
  getTabsForCard,
  getTabsMetadataSignature,
  getTabDataKey,
  setTabsForCard,
} from "@/lib/exam-ui-metadata";

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
  const cardRowsKey = useMemo(
    () =>
      JSON.stringify(
        cardRows.map((row) => ({
          id: row.id,
          cards: row.cards.map((card) => ({ id: card.id, type: card.type })),
        })),
      ),
    [cardRows],
  );
  const tabsSignature = getTabsMetadataSignature(
    examFormData,
    "old-refraction",
    cardRows,
  );

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
      const tabs = getTabsForCard(examFormData, "old-refraction", cardId);
      if (tabs.length > 0) {
        map[cardId] = tabs.map((tab) => tab.id);
      }
    });
    return map;
  }, [tabsSignature, cardRowsKey]);

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

    setExamFormData((prev) => {
      const normalized = ensureTabsMetadataForRows(prev, cardRows);
      let next = normalized.examData;
      let changed = normalized.changed;

      oldRefractionCardIds.forEach((cardId) => {
        const tabs = getTabsForCard(next, "old-refraction", cardId);
        if (tabs.length === 0) {
          const tabId = uuidv4();
          const key = getTabDataKey("old-refraction", cardId, tabId);
          next = {
            ...next,
            [key]: {
              card_instance_id: tabId,
              card_id: cardId,
              tab_index: 0,
              layout_instance_id: activeInstanceId,
              r_glasses_type: "רחוק",
              l_glasses_type: "רחוק",
            },
          };
          next = setTabsForCard(next, "old-refraction", cardId, [
            { id: tabId, index: 0, type: "רחוק" },
          ]);
          changed = true;
          setActiveOldRefractionTabs((current) => ({
            ...current,
            [cardId]: tabId,
          }));
        }
      });

      return changed ? next : prev;
    });
  }, [
    cardRowsKey,
    tabsSignature,
    activeInstanceId,
    loading,
    setExamFormData,
  ]);

  // Add a new tab to an old refraction card
  const addOldRefractionTab = useCallback(
    (cardId: string, type: string) => {
      const newTabId = uuidv4();
      setExamFormData((formData) => {
        const tabs = getTabsForCard(formData, "old-refraction", cardId);
        const tabIndex = tabs.length;
        const key = getTabDataKey("old-refraction", cardId, newTabId);
        return setTabsForCard(
          {
            ...formData,
            [key]: {
              card_instance_id: newTabId,
              card_id: cardId,
              tab_index: tabIndex,
              layout_instance_id: activeInstanceId,
              r_glasses_type: type,
              l_glasses_type: type,
            },
          },
          "old-refraction",
          cardId,
          [...tabs, { id: newTabId, index: tabIndex, type }],
        );
      });
      setActiveOldRefractionTabs((prev) => ({ ...prev, [cardId]: newTabId }));
    },
    [activeInstanceId, setExamFormData],
  );

  // Update a tab's type
  const updateOldRefractionTabType = useCallback(
    (cardId: string, tabIdx: number, newType: string) => {
      const tabs = computedOldRefractionTabs[cardId] || [];
      const tabId = tabs[tabIdx];
      if (!tabId) return;
      const key = getTabDataKey("old-refraction", cardId, tabId);
      setExamFormData((prev) => ({
        ...setTabsForCard(
          prev,
          "old-refraction",
          cardId,
          getTabsForCard(prev, "old-refraction", cardId).map((tab) =>
            tab.id === tabId ? { ...tab, type: newType } : tab,
          ),
        ),
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
      const key = getTabDataKey("old-refraction", cardId, toRemoveId);
      setExamFormData((prev) => {
        const updated = { ...prev };
        delete updated[key];
        const remaining = getTabsForCard(prev, "old-refraction", cardId).filter(
          (tab) => tab.id !== toRemoveId,
        );
        remaining.forEach((tab, idx) => {
          const k = getTabDataKey("old-refraction", cardId, tab.id);
          if (updated[k]) updated[k] = { ...updated[k], tab_index: idx };
        });
        return setTabsForCard(
          updated,
          "old-refraction",
          cardId,
          remaining.map((tab, index) => ({ ...tab, index })),
        );
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
      const sourceKey = getTabDataKey("old-refraction", cardId, toDuplicateId);
      const sourceData = examFormData[sourceKey];
      if (!sourceData) return;

      const newTabId = uuidv4();
      const tabIndex = tabs.length;

      setExamFormData((formData) => {
        const currentTabs = getTabsForCard(formData, "old-refraction", cardId);
        const newType =
          sourceData.r_glasses_type || sourceData.l_glasses_type || undefined;
        return setTabsForCard(
          {
            ...formData,
            [getTabDataKey("old-refraction", cardId, newTabId)]: {
              ...sourceData,
              card_instance_id: newTabId,
              tab_index: tabIndex,
            },
          },
          "old-refraction",
          cardId,
          [...currentTabs, { id: newTabId, index: tabIndex, type: newType }],
        );
      });
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
