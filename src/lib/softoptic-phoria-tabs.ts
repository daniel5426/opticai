import {
  collectOldRefractionGlassesTypesByTabId,
  isUnsetDefaultGlassesType,
  resolveOldRefractionGlassesType,
} from "@/lib/exam-glasses-type";

const SOFTOPTIC_PHORIA_TYPES = [
  "softoptic-cover-test",
  "softoptic-maddox-grid",
] as const;

const SLOT_INDEXES = ["1", "2", "3"] as const;

const glassesTypeFromSlot = (
  index: string,
  fallback: Record<string, any> | undefined,
  typesByTabId: Record<string, string>,
): string | undefined => {
  const fromOldRefraction = typesByTabId[index];
  if (fromOldRefraction && isUnsetDefaultGlassesType(fallback)) {
    return fromOldRefraction;
  }
  return resolveOldRefractionGlassesType(fallback) || fromOldRefraction;
};

const mergeTabsByCard = (
  examData: Record<string, any>,
  type: string,
  cardId: string,
  tabs: Array<{ id: string; index: number; type?: string }>,
) => {
  const ui =
    examData.__ui && typeof examData.__ui === "object" ? examData.__ui : {};
  const tabsByCard = { ...(ui.tabsByCard || {}) };
  tabsByCard[`${type}:${cardId}`] = tabs;
  return {
    ...examData,
    __ui: {
      ...ui,
      tabsByCard,
    },
  };
};

const reshapeSoftopticPhoriaType = (
  examData: Record<string, any>,
  type: (typeof SOFTOPTIC_PHORIA_TYPES)[number],
) => {
  const cardId = `${type}-1`;
  const tabs: Array<{ id: string; index: number; type?: string }> = [];
  const typesByTabId = collectOldRefractionGlassesTypesByTabId(examData);
  let next = examData;
  let changed = false;

  SLOT_INDEXES.forEach((index) => {
    const legacyKey = `${type}-${type}-${index}`;
    const tabKey = `${type}-${cardId}-${index}`;
    const existing = next[tabKey];
    const legacy = next[legacyKey];
    const source =
      existing && typeof existing === "object"
        ? existing
        : legacy && typeof legacy === "object"
          ? legacy
          : null;
    if (!source) return;

    const glassesType = glassesTypeFromSlot(index, source, typesByTabId);
    const alreadyTabbed =
      existing &&
      typeof existing === "object" &&
      String(existing.card_instance_id) === index;
    const hasLegacy = Boolean(legacy && legacyKey !== tabKey);
    const glassesMatch =
      !glassesType || resolveOldRefractionGlassesType(source) === glassesType;

    if (!alreadyTabbed || hasLegacy || !glassesMatch) {
      if (!changed) {
        next = { ...next };
        changed = true;
      }
      next[tabKey] = {
        ...source,
        card_id: cardId,
        card_instance_id: index,
        tab_index:
          Number.isFinite(Number(source.tab_index)) && source.tab_index != null
            ? Number(source.tab_index)
            : Number(index) - 1,
        ...(glassesType
          ? {
              r_glasses_type: glassesType,
              l_glasses_type: glassesType,
              legacy_glasses_type: source.legacy_glasses_type || glassesType,
            }
          : {}),
      };
      if (hasLegacy) {
        delete next[legacyKey];
      }
    }

    tabs.push({
      id: index,
      index: tabs.length,
      ...(glassesType ? { type: glassesType } : {}),
    });
  });

  if (tabs.length === 0) return { examData: next, changed };

  const currentTabs = next.__ui?.tabsByCard?.[`${type}:${cardId}`];
  const needsMetadata =
    !Array.isArray(currentTabs) ||
    currentTabs.length !== tabs.length ||
    tabs.some(
      (tab, index) =>
        currentTabs[index]?.id !== tab.id ||
        currentTabs[index]?.type !== tab.type,
    );
  if (needsMetadata) {
    next = mergeTabsByCard(next, type, cardId, tabs);
    changed = true;
  }

  return { examData: next, changed };
};

export const reshapeSoftopticPhoriaGridExamData = (
  examData: Record<string, any>,
) => {
  let next = examData;
  let changed = false;
  SOFTOPTIC_PHORIA_TYPES.forEach((type) => {
    const result = reshapeSoftopticPhoriaType(next, type);
    next = result.examData;
    changed = changed || result.changed;
  });
  return { examData: next, changed };
};
