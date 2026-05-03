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

interface UseCoverTestTabsParams {
  cardRows: CardRow[];
  examFormData: Record<string, any>;
  setExamFormData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  activeInstanceId: number | null;
  loading: boolean;
}

export function useCoverTestTabs({
  cardRows,
  examFormData,
  setExamFormData,
  activeInstanceId,
  loading,
}: UseCoverTestTabsParams) {
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
    "cover-test",
    cardRows,
  );

  // Compute cover test tabs from form data
  const computedCoverTestTabs = useMemo(() => {
    const map: Record<string, string[]> = {};
    const coverCardIds: string[] = [];
    cardRows.forEach((row) => {
      row.cards.forEach((card) => {
        if (card.type === "cover-test") coverCardIds.push(card.id);
      });
    });
    coverCardIds.forEach((cardId) => {
      const tabs = getTabsForCard(examFormData, "cover-test", cardId);
      if (tabs.length > 0) {
        map[cardId] = tabs.map((tab) => tab.id);
      }
    });
    return map;
  }, [tabsSignature, cardRowsKey]);

  // Track active tab index for each cover test card
  const [activeCoverTestTabs, setActiveCoverTestTabs] = useState<
    Record<string, number>
  >({});

  // Initialize first tab for cover-test cards if none exist
  useEffect(() => {
    if (loading) return;
    const coverCardIds: string[] = [];
    cardRows.forEach((row) =>
      row.cards.forEach((card) => {
        if (card.type === "cover-test") coverCardIds.push(card.id);
      }),
    );
    if (coverCardIds.length === 0) return;

    setExamFormData((prev) => {
      const normalized = ensureTabsMetadataForRows(prev, cardRows);
      let next = normalized.examData;
      let changed = normalized.changed;

      coverCardIds.forEach((cardId) => {
        const tabs = getTabsForCard(next, "cover-test", cardId);
        if (tabs.length === 0) {
          const tabId = uuidv4();
          const key = getTabDataKey("cover-test", cardId, tabId);
          next = {
            ...next,
            [key]: {
              card_instance_id: tabId,
              card_id: cardId,
              tab_index: 0,
              layout_instance_id: activeInstanceId,
              deviation_type: null,
              deviation_direction: null,
              fv_1: null,
              fv_2: null,
              nv_1: null,
              nv_2: null,
            },
          };
          next = setTabsForCard(next, "cover-test", cardId, [
            { id: tabId, index: 0 },
          ]);
          changed = true;
          setActiveCoverTestTabs((current) => ({ ...current, [cardId]: 0 }));
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

  // Add a new tab to a cover test card
  const addCoverTestTab = useCallback(
    (cardId: string) => {
      const newTabId = uuidv4();
      setExamFormData((formData) => {
        const tabs = getTabsForCard(formData, "cover-test", cardId);
        const tabIndex = tabs.length;
        const key = getTabDataKey("cover-test", cardId, newTabId);
        setActiveCoverTestTabs((current) => ({
          ...current,
          [cardId]: tabIndex,
        }));
        return setTabsForCard(
          {
            ...formData,
            [key]: {
          card_instance_id: newTabId,
          card_id: cardId,
          tab_index: tabIndex,
          layout_instance_id: activeInstanceId,
          deviation_type: null,
          deviation_direction: null,
          fv_1: null,
          fv_2: null,
          nv_1: null,
          nv_2: null,
            },
          },
          "cover-test",
          cardId,
          [...tabs, { id: newTabId, index: tabIndex }],
        );
      });
    },
    [activeInstanceId, setExamFormData],
  );

  // Remove a tab from a cover test card
  const removeCoverTestTab = useCallback(
    (cardId: string, tabIdx: number) => {
      const tabs = computedCoverTestTabs[cardId] || [];
      if (tabs.length <= 1) return;
      const toRemoveId = tabs[tabIdx];
      const key = getTabDataKey("cover-test", cardId, toRemoveId);
      setExamFormData((prev) => {
        const updated = { ...prev };
        delete updated[key];
        const remaining = getTabsForCard(prev, "cover-test", cardId).filter(
          (tab) => tab.id !== toRemoveId,
        );
        remaining.forEach((tabId, idx) => {
          const k = getTabDataKey("cover-test", cardId, tabId.id);
          if (updated[k]) updated[k] = { ...updated[k], tab_index: idx };
        });
        return setTabsForCard(
          updated,
          "cover-test",
          cardId,
          remaining.map((tab, index) => ({ ...tab, index })),
        );
      });
      setActiveCoverTestTabs((prev) => ({
        ...prev,
        [cardId]: Math.max(0, Math.min(prev[cardId] || 0, tabs.length - 2)),
      }));
    },
    [computedCoverTestTabs, setExamFormData],
  );

  return {
    computedCoverTestTabs,
    activeCoverTestTabs,
    setActiveCoverTestTabs,
    addCoverTestTab,
    removeCoverTestTab,
  };
}
