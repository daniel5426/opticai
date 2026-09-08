import { GLASSES_TYPES } from "@/components/exam/data/exam-constants";

export const DEFAULT_OLD_REFRACTION_TYPE = "רחוק";

const OLD_REFRACTION_TYPE_ALIASES: Record<string, string> = {
  מרחק: "רחוק",
  רחוק: "רחוק",
  קרוב: "קרוב",
  קריאה: "קרוב",
  מחשב: "קרוב",
  למחשב: "קרוב",
  מולטיפוקל: "מולטיפוקל",
  ביפוקל: "ביפוקל",
};

const trimmedValue = (value: unknown): string | null => {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
};

export function isStandardGlassesType(
  type: string | undefined | null,
): boolean {
  return !!type && (GLASSES_TYPES as readonly string[]).includes(type);
}

export function formatGlassesTypeLabel(
  type: string | undefined | null,
  fallback: string,
): string {
  const trimmed = type != null ? String(type).trim() : "";
  if (!trimmed) return fallback;
  if (isStandardGlassesType(trimmed)) return trimmed;
  return `${trimmed} (I)`;
}

export function resolveOldRefractionGlassesType(
  data: Record<string, any> | null | undefined,
): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const stored = [data.r_glasses_type, data.l_glasses_type]
    .map((value) => trimmedValue(value))
    .find((value): value is string => !!value);
  const legacy = trimmedValue(data.legacy_glasses_type);
  if (legacy) {
    const aliased = OLD_REFRACTION_TYPE_ALIASES[legacy];
    if (!stored) return aliased || legacy;
    if (
      stored === DEFAULT_OLD_REFRACTION_TYPE &&
      aliased !== DEFAULT_OLD_REFRACTION_TYPE &&
      legacy !== DEFAULT_OLD_REFRACTION_TYPE
    ) {
      return aliased || legacy;
    }
  }
  return stored || undefined;
}

export function isUnsetDefaultGlassesType(
  data: Record<string, any> | null | undefined,
): boolean {
  if (!data || typeof data !== "object") return true;
  const resolved = resolveOldRefractionGlassesType(data);
  if (!resolved) return true;
  return (
    resolved === DEFAULT_OLD_REFRACTION_TYPE &&
    !trimmedValue(data.legacy_glasses_type)
  );
}

export function collectOldRefractionGlassesTypesByTabId(
  examData: Record<string, any> | null | undefined,
): Record<string, string> {
  const typesByTabId: Record<string, string> = {};
  if (!examData || typeof examData !== "object") return typesByTabId;

  Object.entries(examData).forEach(([key, value]) => {
    if (key === "__ui") return;
    if (!key.startsWith("old-refraction-")) return;
    if (!value || typeof value !== "object") return;
    const tabId = trimmedValue(value.card_instance_id);
    const resolved = resolveOldRefractionGlassesType(value);
    if (!tabId || !resolved) return;
    typesByTabId[tabId] = resolved;
  });

  const tabsByCard = examData.__ui?.tabsByCard;
  if (!tabsByCard || typeof tabsByCard !== "object") return typesByTabId;

  Object.entries(tabsByCard).forEach(([metaKey, tabs]) => {
    if (!metaKey.startsWith("old-refraction") || !Array.isArray(tabs)) return;
    tabs.forEach((tab) => {
      const tabId = trimmedValue(tab?.id);
      const tabType = trimmedValue(tab?.type);
      if (!tabId || !tabType || typesByTabId[tabId]) return;
      typesByTabId[tabId] = tabType;
    });
  });

  return typesByTabId;
}
