import { CardRow } from "@/pages/exam-detail/types";

export const EXAM_DATA_UI_KEY = "__ui";

export type TabMetadataComponentType = "cover-test" | "old-refraction";

export interface ExamCardTabMetadata {
  id: string;
  index: number;
  type?: string;
}

export interface ExamDataUiMetadata {
  tabsByCard?: Record<string, ExamCardTabMetadata[]>;
}

export type ExamDataWithUiMetadata = Record<string, any> & {
  [EXAM_DATA_UI_KEY]?: ExamDataUiMetadata;
};

const TAB_DEFAULTS_BY_TYPE: Record<
  TabMetadataComponentType,
  Record<string, unknown>
> = {
  "cover-test": {
    deviation_type: null,
    deviation_direction: null,
    fv_1: null,
    fv_2: null,
    nv_1: null,
    nv_2: null,
  },
  "old-refraction": {
    r_glasses_type: "רחוק",
    l_glasses_type: "רחוק",
  },
};

const DEFAULT_OLD_REFRACTION_TYPE = "רחוק";

export const getTabsByCardKey = (
  type: TabMetadataComponentType,
  cardId: string,
) => `${type}:${cardId}`;

export const getTabDataKey = (
  type: TabMetadataComponentType,
  cardId: string,
  tabId: string,
) => `${type}-${cardId}-${tabId}`;

export const getExamDataUi = (
  examData: Record<string, any> | null | undefined,
): ExamDataUiMetadata => {
  const ui = (examData as ExamDataWithUiMetadata | null | undefined)?.[
    EXAM_DATA_UI_KEY
  ];
  return ui && typeof ui === "object" ? ui : {};
};

export const sortTabMetadata = (tabs: ExamCardTabMetadata[]) =>
  [...tabs].sort((a, b) => {
    const indexDiff = (Number(a.index) || 0) - (Number(b.index) || 0);
    if (indexDiff !== 0) return indexDiff;
    return String(a.id).localeCompare(String(b.id));
  });

const getOldRefractionTabType = (
  data: Record<string, any> | null | undefined,
) => {
  const rightType = data?.r_glasses_type;
  const leftType = data?.l_glasses_type;
  const type =
    rightType != null && String(rightType).trim() !== "" ? rightType : leftType;
  return type != null && String(type).trim() !== ""
    ? String(type)
    : DEFAULT_OLD_REFRACTION_TYPE;
};

const normalizeTabMetadataDefaults = (
  examData: Record<string, any>,
  type: TabMetadataComponentType,
  cardId: string,
  tabs: ExamCardTabMetadata[],
) => {
  if (type !== "old-refraction") return tabs;

  return tabs.map((tab) => {
    const tabData = examData[getTabDataKey(type, cardId, tab.id)];
    return {
      ...tab,
      type: tab.type || getOldRefractionTabType(tabData),
    };
  });
};

const backfillOldRefractionTabDataDefaults = (
  examData: Record<string, any>,
  cardId: string,
  tabs: ExamCardTabMetadata[],
) => {
  let next = examData;
  let changed = false;

  tabs.forEach((tab) => {
    const key = getTabDataKey("old-refraction", cardId, tab.id);
    const tabData = next[key];
    if (!tabData || typeof tabData !== "object") return;

    const tabType = tab.type || getOldRefractionTabType(tabData);
    const hasRightType =
      tabData.r_glasses_type != null &&
      String(tabData.r_glasses_type).trim() !== "";
    const hasLeftType =
      tabData.l_glasses_type != null &&
      String(tabData.l_glasses_type).trim() !== "";

    if (hasRightType && hasLeftType) return;

    if (!changed) {
      next = { ...next };
      changed = true;
    }

    next[key] = {
      ...tabData,
      ...(!hasRightType ? { r_glasses_type: tabType } : {}),
      ...(!hasLeftType ? { l_glasses_type: tabType } : {}),
    };
  });

  return { examData: next, changed };
};

export const getMetadataTabsForCard = (
  examData: Record<string, any>,
  type: TabMetadataComponentType,
  cardId: string,
): ExamCardTabMetadata[] | null => {
  const tabs =
    getExamDataUi(examData).tabsByCard?.[getTabsByCardKey(type, cardId)];
  if (!Array.isArray(tabs)) return null;
  return sortTabMetadata(
    tabs
      .filter((tab) => tab && typeof tab.id === "string" && tab.id !== "")
      .map((tab, index) => ({
        id: tab.id,
        index: Number.isFinite(Number(tab.index)) ? Number(tab.index) : index,
        ...(tab.type ? { type: tab.type } : {}),
      })),
  );
};

export const deriveLegacyTabsForCard = (
  examData: Record<string, any>,
  type: TabMetadataComponentType,
  cardId: string,
): ExamCardTabMetadata[] => {
  const prefix = `${type}-${cardId}-`;
  return Object.keys(examData || {})
    .filter((key) => key.startsWith(prefix))
    .map((key) => {
      const data = examData[key] || {};
      const id = key.slice(prefix.length);
      return {
        id,
        index: Number(data.tab_index ?? 0) || 0,
        ...(type === "old-refraction"
          ? { type: getOldRefractionTabType(data) }
          : {}),
      };
    })
    .filter((tab) => tab.id !== "")
    .sort((a, b) => {
      const indexDiff = a.index - b.index;
      if (indexDiff !== 0) return indexDiff;
      return a.id.localeCompare(b.id);
    });
};

export const getTabsForCard = (
  examData: Record<string, any>,
  type: TabMetadataComponentType,
  cardId: string,
) =>
  getMetadataTabsForCard(examData, type, cardId) ??
  deriveLegacyTabsForCard(examData, type, cardId);

export const setTabsForCard = (
  examData: Record<string, any>,
  type: TabMetadataComponentType,
  cardId: string,
  tabs: ExamCardTabMetadata[],
) => {
  const key = getTabsByCardKey(type, cardId);
  const currentUi = getExamDataUi(examData);
  const nextTabsByCard = { ...(currentUi.tabsByCard || {}) };
  const normalizedTabs = sortTabMetadata(tabs).map((tab, index) => ({
    id: tab.id,
    index,
    ...(tab.type ? { type: tab.type } : {}),
  }));

  if (normalizedTabs.length > 0) {
    nextTabsByCard[key] = normalizedTabs;
  } else {
    delete nextTabsByCard[key];
  }

  return {
    ...examData,
    [EXAM_DATA_UI_KEY]: {
      ...currentUi,
      tabsByCard: nextTabsByCard,
    },
  };
};

const collectCardIdsByType = (
  cardRows: CardRow[],
  type: TabMetadataComponentType,
) => {
  const ids: string[] = [];
  cardRows.forEach((row) => {
    row.cards.forEach((card) => {
      if (card.type === type) ids.push(card.id);
    });
  });
  return ids;
};

export const ensureTabsMetadataForRows = (
  examData: Record<string, any>,
  cardRows: CardRow[],
) => {
  let next = examData;
  let changed = false;

  (["cover-test", "old-refraction"] as const).forEach((type) => {
    collectCardIdsByType(cardRows, type).forEach((cardId) => {
      const metadataTabs = getMetadataTabsForCard(next, type, cardId);
      const rawTabs =
        metadataTabs ?? deriveLegacyTabsForCard(next, type, cardId);
      if (rawTabs.length === 0) return;

      const tabs = normalizeTabMetadataDefaults(next, type, cardId, rawTabs);
      const missingMetadata = !metadataTabs;
      const missingOldRefractionTypes =
        type === "old-refraction" &&
        rawTabs.some((tab, index) => tab.type !== tabs[index].type);

      if (missingMetadata || missingOldRefractionTypes) {
        next = setTabsForCard(next, type, cardId, tabs);
        changed = true;
      }

      if (type === "old-refraction") {
        const backfilled = backfillOldRefractionTabDataDefaults(
          next,
          cardId,
          tabs,
        );
        next = backfilled.examData;
        changed = changed || backfilled.changed;
      }
    });
  });

  return { examData: next, changed };
};

export const ensureLayoutDataForRows = (
  examData: Record<string, any>,
  cardRows: CardRow[],
  layoutInstanceId: number,
) => {
  const normalizedTabs = ensureTabsMetadataForRows(examData, cardRows);
  let next = normalizedTabs.examData;
  let changed = normalizedTabs.changed;
  const firstCardKeyByType: Record<string, string> = {};

  const ensureMutable = () => {
    if (!changed) {
      next = { ...next };
      changed = true;
    }
  };

  cardRows.forEach((row) => {
    row.cards.forEach((card) => {
      if (!card?.type || !card.id) return;

      const type = card.type;
      const key = `${type}-${card.id}`;
      let cardData = next[key];

      if (cardData) {
        if (!firstCardKeyByType[type]) {
          firstCardKeyByType[type] = key;
        }
      } else {
        ensureMutable();

        const baseData = next[type];
        if (
          !firstCardKeyByType[type] &&
          baseData &&
          typeof baseData === "object"
        ) {
          cardData = {
            ...baseData,
            layout_instance_id: baseData.layout_instance_id ?? layoutInstanceId,
            card_instance_id: card.id,
          };
        } else {
          cardData = {
            layout_instance_id: layoutInstanceId,
            card_instance_id: card.id,
          };
        }

        next[key] = cardData;

        if (!firstCardKeyByType[type]) {
          firstCardKeyByType[type] = key;
        }
      }

      if (type === "cover-test" || type === "old-refraction") {
        const tabs = getTabsForCard(next, type, card.id);
        if (tabs.length === 0) {
          ensureMutable();
          const tabId = `${card.id}-default`;
          const tabKey = getTabDataKey(type, card.id, tabId);
          next[tabKey] = {
            ...TAB_DEFAULTS_BY_TYPE[type],
            ...(cardData && typeof cardData === "object" ? cardData : {}),
            card_instance_id: tabId,
            card_id: card.id,
            tab_index: 0,
            layout_instance_id:
              cardData?.layout_instance_id ?? layoutInstanceId,
          };
          next = setTabsForCard(next, type, card.id, [
            {
              id: tabId,
              index: 0,
              ...(type === "old-refraction" ? { type: "רחוק" } : {}),
            },
          ]);
        }
      }
    });
  });

  Object.entries(firstCardKeyByType).forEach(([type, key]) => {
    if (next[type]) return;
    ensureMutable();
    next[type] = next[key];
  });

  return { examData: next, changed };
};

export const getTabsMetadataSignature = (
  examData: Record<string, any>,
  type: TabMetadataComponentType,
  cardRows: CardRow[],
) => {
  const cardIds = collectCardIdsByType(cardRows, type);
  const ui = getExamDataUi(examData);
  const metaParts = cardIds.map((cardId) => {
    const key = getTabsByCardKey(type, cardId);
    const tabs = ui.tabsByCard?.[key];
    if (Array.isArray(tabs)) {
      return `${key}:${tabs
        .map((tab) => `${tab.id}:${tab.index}:${tab.type || ""}`)
        .join(",")}`;
    }

    const legacyTabs = deriveLegacyTabsForCard(examData, type, cardId);
    return `${key}:legacy:${legacyTabs
      .map((tab) => `${tab.id}:${tab.index}:${tab.type || ""}`)
      .join(",")}`;
  });
  return metaParts.join("|");
};
