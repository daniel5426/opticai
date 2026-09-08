export const TABBED_FULL_DATA_TYPES = [
  {
    type: "old-refraction-extension",
    prefix: "old-refraction-extension-",
  },
  {
    type: "old-refraction",
    prefix: "old-refraction-",
  },
  {
    type: "softoptic-cover-test",
    prefix: "softoptic-cover-test-",
  },
  {
    type: "softoptic-maddox-grid",
    prefix: "softoptic-maddox-grid-",
  },
  {
    type: "cover-test",
    prefix: "cover-test-",
  },
] as const;

export type TabbedFullDataType =
  (typeof TABBED_FULL_DATA_TYPES)[number]["type"];

export function matchTabbedFullDataType(
  key: string,
): (typeof TABBED_FULL_DATA_TYPES)[number] | null {
  if (key.startsWith("cover-test-v2")) return null;
  for (const entry of TABBED_FULL_DATA_TYPES) {
    if (key === entry.type || key.startsWith(entry.prefix)) return entry;
  }
  return null;
}

export function resolveTabbedExamCardId(
  type: string,
  key: string,
  value: Record<string, unknown> | null | undefined,
): string {
  if (value?.card_id != null && String(value.card_id) !== "") {
    return String(value.card_id);
  }
  if (key === type) return String(value?.card_instance_id || type);
  const suffix = key.slice(type.length + 1);
  const tabId = value?.card_instance_id;
  if (tabId != null && String(tabId) !== "" && suffix.endsWith(`-${tabId}`)) {
    return suffix.slice(0, -String(tabId).length - 1) || suffix;
  }
  return suffix;
}
