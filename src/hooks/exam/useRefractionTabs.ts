import { useCallback, useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { CardRow } from "@/pages/exam-detail/types";
import {
  ensureTabsMetadataForRows,
  getTabsForCard,
  getTabsMetadataSignature,
  getTabDataKey,
  setTabsForCard,
  TabMetadataComponentType,
} from "@/lib/exam-ui-metadata";

export type RefractionTabComponentType = Extract<
  TabMetadataComponentType,
  "old-refraction" | "old-refraction-extension"
>;

interface UseRefractionTabsParams {
  componentType: RefractionTabComponentType;
  cardRows: CardRow[];
  examFormData: Record<string, any>;
  setExamFormData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  activeInstanceId: number | null;
  loading: boolean;
}

export function useRefractionTabs({
  componentType,
  cardRows,
  examFormData,
  setExamFormData,
  activeInstanceId,
  loading,
}: UseRefractionTabsParams) {
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
    componentType,
    cardRows,
  );

  const computedTabs = useMemo(() => {
    const result: Record<string, string[]> = {};
    cardRows.forEach((row) =>
      row.cards.forEach((card) => {
        if (card.type !== componentType) return;
        const tabs = getTabsForCard(examFormData, componentType, card.id);
        if (tabs.length > 0) result[card.id] = tabs.map((tab) => tab.id);
      }),
    );
    return result;
  }, [cardRowsKey, componentType, examFormData, tabsSignature]);

  const [activeTabs, setActiveTabs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (loading) return;
    const cardIds = cardRows.flatMap((row) =>
      row.cards
        .filter((card) => card.type === componentType)
        .map((card) => card.id),
    );
    if (cardIds.length === 0) return;

    setExamFormData((previous) => {
      const normalized = ensureTabsMetadataForRows(previous, cardRows);
      let next = normalized.examData;
      let changed = normalized.changed;

      cardIds.forEach((cardId) => {
        const tabs = getTabsForCard(next, componentType, cardId);
        if (tabs.length > 0) return;
        const tabId = uuidv4();
        const key = getTabDataKey(componentType, cardId, tabId);
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
        next = setTabsForCard(next, componentType, cardId, [
          { id: tabId, index: 0, type: "רחוק" },
        ]);
        changed = true;
      });

      return changed ? next : previous;
    });
  }, [
    activeInstanceId,
    cardRows,
    cardRowsKey,
    componentType,
    loading,
    setExamFormData,
    tabsSignature,
  ]);

  useEffect(() => {
    setActiveTabs((current) => {
      let changed = false;
      const next = { ...current };
      Object.entries(computedTabs).forEach(([cardId, tabIds]) => {
        if (tabIds.length === 0) return;
        if (!next[cardId] || !tabIds.includes(next[cardId])) {
          next[cardId] = tabIds[0];
          changed = true;
        }
      });
      Object.keys(next).forEach((cardId) => {
        if (!computedTabs[cardId]) {
          delete next[cardId];
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [computedTabs]);

  const addTab = useCallback(
    (cardId: string, type: string) => {
      const tabId = uuidv4();
      setExamFormData((formData) => {
        const tabs = getTabsForCard(formData, componentType, cardId);
        if (tabs.length >= 5) return formData;
        const index = tabs.length;
        return setTabsForCard(
          {
            ...formData,
            [getTabDataKey(componentType, cardId, tabId)]: {
              card_instance_id: tabId,
              card_id: cardId,
              tab_index: index,
              layout_instance_id: activeInstanceId,
              r_glasses_type: type,
              l_glasses_type: type,
            },
          },
          componentType,
          cardId,
          [...tabs, { id: tabId, index, type }],
        );
      });
      setActiveTabs((current) => ({ ...current, [cardId]: tabId }));
    },
    [activeInstanceId, componentType, setExamFormData],
  );

  const updateTabType = useCallback(
    (cardId: string, tabIndex: number, newType: string) => {
      const tabId = computedTabs[cardId]?.[tabIndex];
      if (!tabId) return;
      const key = getTabDataKey(componentType, cardId, tabId);
      setExamFormData((previous) => ({
        ...setTabsForCard(
          previous,
          componentType,
          cardId,
          getTabsForCard(previous, componentType, cardId).map((tab) =>
            tab.id === tabId ? { ...tab, type: newType } : tab,
          ),
        ),
        [key]: {
          ...(previous[key] || {}),
          r_glasses_type: newType,
          l_glasses_type: newType,
        },
      }));
    },
    [componentType, computedTabs, setExamFormData],
  );

  const removeTab = useCallback(
    (cardId: string, tabIndex: number) => {
      const tabIds = computedTabs[cardId] || [];
      if (tabIds.length <= 1) return;
      const removedId = tabIds[tabIndex];
      if (!removedId) return;
      setExamFormData((previous) => {
        const next = { ...previous };
        delete next[getTabDataKey(componentType, cardId, removedId)];
        const remaining = getTabsForCard(previous, componentType, cardId)
          .filter((tab) => tab.id !== removedId)
          .map((tab, index) => ({ ...tab, index }));
        remaining.forEach((tab, index) => {
          const key = getTabDataKey(componentType, cardId, tab.id);
          if (next[key]) next[key] = { ...next[key], tab_index: index };
        });
        return setTabsForCard(next, componentType, cardId, remaining);
      });
      const remainingIds = tabIds.filter((_, index) => index !== tabIndex);
      setActiveTabs((current) => ({
        ...current,
        [cardId]: remainingIds[0] || "",
      }));
    },
    [componentType, computedTabs, setExamFormData],
  );

  const duplicateTab = useCallback(
    (cardId: string, tabIndex: number) => {
      const tabs = computedTabs[cardId] || [];
      if (tabs.length >= 5) return;
      const sourceId = tabs[tabIndex];
      const sourceData = examFormData[
        getTabDataKey(componentType, cardId, sourceId)
      ];
      if (!sourceData) return;
      const tabId = uuidv4();
      setExamFormData((formData) => {
        const currentTabs = getTabsForCard(formData, componentType, cardId);
        if (currentTabs.length >= 5) return formData;
        const index = currentTabs.length;
        const type =
          sourceData.r_glasses_type || sourceData.l_glasses_type || "רחוק";
        return setTabsForCard(
          {
            ...formData,
            [getTabDataKey(componentType, cardId, tabId)]: {
              ...sourceData,
              card_instance_id: tabId,
              card_id: cardId,
              tab_index: index,
            },
          },
          componentType,
          cardId,
          [...currentTabs, { id: tabId, index, type }],
        );
      });
      setActiveTabs((current) => ({ ...current, [cardId]: tabId }));
    },
    [componentType, computedTabs, examFormData, setExamFormData],
  );

  return {
    computedTabs,
    activeTabs,
    setActiveTabs,
    addTab,
    removeTab,
    duplicateTab,
    updateTabType,
  };
}
