import type { AdditionExam } from "@/lib/db/schema-interface";

export const ADDITION_ADD_TYPES = ["read", "int", "bif", "mul"] as const;

export type AdditionAddType = (typeof ADDITION_ADD_TYPES)[number];

export type AdditionAddSource = {
  r_ad?: number;
  l_ad?: number;
};

export type AdditionAddSourceMap = Partial<Record<AdditionAddType, AdditionAddSource>>;

// The glasses each addition is for, in the names Old Refraction uses (INT has no Old Refraction type).
export const ADDITION_ADD_TYPE_LABELS: Record<AdditionAddType, string> = {
  read: "קרוב",
  int: "ביניים",
  bif: "ביפוקל",
  mul: "מולטיפוקל",
};

// An order's glasses type: the addition types, plus types that take no addition.
export const ORDER_GLASSES_TYPES = ["far", "read", "int", "mul", "bif", "my_slow"] as const;
export type OrderGlassesType = (typeof ORDER_GLASSES_TYPES)[number];
export const ORDER_GLASSES_TYPE_LABELS: Record<OrderGlassesType, string> = {
  far: "רחוק",
  ...ADDITION_ADD_TYPE_LABELS,
  my_slow: "My Slow",
};
export const isAdditionAddType = (type: string): type is AdditionAddType =>
  (ADDITION_ADD_TYPES as readonly string[]).includes(type);
export const normalizeOrderGlassesType = (value: unknown): OrderGlassesType | undefined => {
  if (typeof value !== "string") return undefined;
  const normalized = value.toLowerCase();
  return (ORDER_GLASSES_TYPES as readonly string[]).includes(normalized) ? (normalized as OrderGlassesType) : undefined;
};

const hasValue = (value: unknown) =>
  value !== undefined && value !== null && value !== "";

const toNumberValue = (value: unknown): number | undefined => {
  if (!hasValue(value)) return undefined;
  const parsed = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isNaN(parsed) ? undefined : parsed;
};

export const normalizeAdditionAddType = (
  value: unknown,
): AdditionAddType | undefined => {
  if (typeof value !== "string") return undefined;
  const normalized = value.toLowerCase();
  return ADDITION_ADD_TYPES.includes(normalized as AdditionAddType)
    ? (normalized as AdditionAddType)
    : undefined;
};

export const getAdditionAddTypeOptions = (
  sources: AdditionAddSourceMap,
): AdditionAddType[] =>
  ADDITION_ADD_TYPES.filter((type) => {
    const source = sources[type];
    return Boolean(source && (hasValue(source.r_ad) || hasValue(source.l_ad)));
  });

const collectFromAdditionData = (
  sources: AdditionAddSourceMap,
  additionData: Partial<AdditionExam>,
) => {
  ADDITION_ADD_TYPES.forEach((type) => {
    const rValue = toNumberValue(additionData[`r_${type}` as keyof AdditionExam]);
    const lValue = toNumberValue(additionData[`l_${type}` as keyof AdditionExam]);
    if (rValue === undefined && lValue === undefined) return;

    sources[type] = {
      ...(sources[type] || {}),
      ...(rValue !== undefined ? { r_ad: rValue } : {}),
      ...(lValue !== undefined ? { l_ad: lValue } : {}),
    };
  });
};

export const extractAdditionAddSourcesFromExamData = (
  examData: Record<string, unknown> | undefined | null,
): AdditionAddSourceMap => {
  const sources: AdditionAddSourceMap = {};
  if (!examData || typeof examData !== "object") return sources;

  Object.entries(examData).forEach(([key, value]) => {
    if (key !== "addition" && !key.startsWith("addition-")) return;
    if (!value || typeof value !== "object") return;
    collectFromAdditionData(sources, value as Partial<AdditionExam>);
  });

  return sources;
};

export const extractAdditionAddSourcesFromExamPageData = (
  pageData: any,
): AdditionAddSourceMap => {
  const sources: AdditionAddSourceMap = {};

  (pageData?.instances || []).forEach((instance: any) => {
    const instanceSources = extractAdditionAddSourcesFromExamData(instance?.exam_data);
    ADDITION_ADD_TYPES.forEach((type) => {
      if (instanceSources[type]) {
        sources[type] = {
          ...(sources[type] || {}),
          ...instanceSources[type],
        };
      }
    });
  });

  return sources;
};
