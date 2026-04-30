import type { AdditionExam } from "@/lib/db/schema-interface";

export const ADDITION_ADD_TYPES = ["read", "int", "bif", "mul"] as const;

export type AdditionAddType = (typeof ADDITION_ADD_TYPES)[number];

export type AdditionAddSource = {
  r_ad?: number;
  l_ad?: number;
};

export type AdditionAddSourceMap = Partial<Record<AdditionAddType, AdditionAddSource>>;

export const ADDITION_ADD_TYPE_LABELS: Record<AdditionAddType, string> = {
  read: "READ",
  int: "INT",
  bif: "BIF",
  mul: "MUL",
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
