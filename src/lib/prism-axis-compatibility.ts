const PRISM_AXIS_COMPONENT_TYPES = ["subjective", "final-subjective"] as const;

const HORIZONTAL_ALIASES = [
  ["r_pris", "r_pr_h"],
  ["l_pris", "l_pr_h"],
  ["r_base", "r_base_h"],
  ["l_base", "l_base_h"],
] as const;

export const PRISM_AXIS_VERTICAL_FIELDS = [
  "r_pr_v",
  "l_pr_v",
  "r_base_v",
  "l_base_v",
] as const;

const EYE_HORIZONTAL_LINKS: Record<string, string> = {
  pris: "pr_h",
  pr_h: "pris",
  base: "base_h",
  base_h: "base",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isPresent = (value: unknown) =>
  value !== undefined && value !== null && String(value).trim() !== "";

const isFilled = (value: unknown) => {
  if (!isPresent(value)) return false;
  const trimmed = String(value).trim();
  return trimmed !== "0" && trimmed !== "0.0";
};

export class PrismAxisCompatibility {
  static isComponentKey(key: string) {
    return PRISM_AXIS_COMPONENT_TYPES.some(
      (type) => key === type || key.startsWith(`${type}-`),
    );
  }

  static hasVerticalPrism(data: Record<string, unknown> | null | undefined) {
    if (!data) return false;
    return PRISM_AXIS_VERTICAL_FIELDS.some((field) => isFilled(data[field]));
  }

  static normalizeBlock<T extends Record<string, unknown>>(data: T): T {
    const next: Record<string, unknown> = { ...data };
    HORIZONTAL_ALIASES.forEach(([legacy, split]) => {
      const legacyPresent = isPresent(next[legacy]);
      const splitPresent = isPresent(next[split]);
      if (legacyPresent) {
        next[split] = next[legacy];
      } else if (splitPresent) {
        next[legacy] = next[split];
      }
    });
    return next as T;
  }

  static normalizeExamData<T extends Record<string, unknown>>(data: T): T {
    const normalized: Record<string, unknown> = {};
    Object.entries(data).forEach(([key, value]) => {
      if (this.isComponentKey(key) && isRecord(value)) {
        normalized[key] = this.normalizeBlock(value);
        return;
      }
      normalized[key] = value;
    });
    return normalized as T;
  }

  static linkedHorizontalField(field: string) {
    return EYE_HORIZONTAL_LINKS[field];
  }
}
