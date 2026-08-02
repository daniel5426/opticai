const LEGACY_NPC_KEY = "opc";
export const NPC_COMPONENT_TYPE = "npc";

export const normalizeNpcComponentType = (type: string) =>
  type === LEGACY_NPC_KEY ? NPC_COMPONENT_TYPE : type;

export const normalizeNpcExamDataKey = (key: string) =>
  key === LEGACY_NPC_KEY || key.startsWith(`${LEGACY_NPC_KEY}-`)
    ? `${NPC_COMPONENT_TYPE}${key.slice(LEGACY_NPC_KEY.length)}`
    : key;

/**
 * Converts persisted OPC keys to NPC at read time. Canonical NPC values win
 * when both forms exist, and the next save persists only the NPC form.
 */
export const normalizeNpcExamData = <T extends Record<string, unknown>>(
  data: T,
): T => {
  const normalized: Record<string, unknown> = {};

  Object.entries(data).forEach(([key, value]) => {
    if (normalizeNpcExamDataKey(key) === key) {
      normalized[key] = value;
    }
  });
  Object.entries(data).forEach(([key, value]) => {
    const normalizedKey = normalizeNpcExamDataKey(key);
    if (!(normalizedKey in normalized)) {
      normalized[normalizedKey] = value;
    }
  });

  return normalized as T;
};
