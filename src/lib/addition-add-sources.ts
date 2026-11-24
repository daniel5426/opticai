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
export const ORDER_GLASSES_TYPES = ["far", "read", "int", "mul", "bif", "office", "my_slow"] as const;
export type OrderGlassesType = (typeof ORDER_GLASSES_TYPES)[number];
export const ORDER_GLASSES_TYPE_LABELS: Record<OrderGlassesType, string> = {
  far: "רחוק",
  ...ADDITION_ADD_TYPE_LABELS,
  office: "משרדיות",
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

/** A prescription's own ADD, as an addition source. */
export const prescriptionAddSource = (prescription: Record<string, unknown>): AdditionAddSource => ({
  r_ad: toNumberValue(prescription.r_ad),
  l_ad: toNumberValue(prescription.l_ad),
});

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

// Near and intermediate glasses carry their addition inside SPH.
export const SPH_ADD_TYPES = ["read", "int"] as const;
export type SphAddType = (typeof SPH_ADD_TYPES)[number];
export const isSphAddType = (type: unknown): type is SphAddType =>
  (SPH_ADD_TYPES as readonly unknown[]).includes(type);

const EYES = ["r", "l"] as const;
type Eye = (typeof EYES)[number];
const round = (value: number) => Math.round(value * 100) / 100;
// An empty SPH is plano; a text SPH (e.g. PRO) cannot take an addition.
const sphNumber = (value: unknown): number | undefined => (hasValue(value) ? toNumberValue(value) : 0);

/** The fields that record SPH taking an addition, all cleared. */
export const CLEARED_SPH_ADD = { sph_add_type: "", sph_add_source: "", r_sph_far: "", l_sph_far: "", r_sph_add: "", l_sph_add: "" };

/**
 * An order's SPH for near or intermediate glasses: each eye's far SPH plus its addition,
 * with the record the order keeps of the calculation. Null when no eye has an addition.
 */
export function sphWithAddition(
  prescription: Record<string, unknown>,
  type: SphAddType,
  source: AdditionAddSource | undefined,
  /** The addition came from an exam's Addition card, not from the order's own ADD. */
  fromExam = false,
): Record<string, string> | null {
  const patch: Record<string, string> = { ...CLEARED_SPH_ADD };
  let applied = false;
  EYES.forEach((eye) => {
    const far = sphNumber(prescription[`${eye}_sph`]);
    const add = source?.[`${eye}_ad`];
    if (far === undefined || add === undefined) return;
    patch[`${eye}_sph`] = String(round(far + add));
    patch[`${eye}_sph_far`] = String(far);
    patch[`${eye}_sph_add`] = String(add);
    applied = true;
  });
  if (!applied) return null;
  patch.sph_add_type = type;
  if (fromExam) patch.sph_add_source = "exam";
  return patch;
}

export interface SphAdditionView {
  type: SphAddType;
  far: number;
  add: number;
  fromExam: boolean;
}

/** How an eye's SPH took an addition, while SPH still equals far + addition (a hand edit drops it). */
export function sphAdditionFor(prescription: Record<string, unknown>, eye: "R" | "L"): SphAdditionView | null {
  const side = eye.toLowerCase() as Eye;
  const type = prescription.sph_add_type;
  const far = toNumberValue(prescription[`${side}_sph_far`]);
  const add = toNumberValue(prescription[`${side}_sph_add`]);
  const sph = sphNumber(prescription[`${side}_sph`]);
  if (!isSphAddType(type) || far === undefined || add === undefined || sph === undefined) return null;
  return Math.abs(round(far + add) - sph) < 0.001 ? { type, far, add, fromExam: prescription.sph_add_source === "exam" } : null;
}

/** The far SPH back in place of an SPH that took an addition, for glasses that do not take one. */
export function sphWithoutAddition(prescription: Record<string, unknown>): Record<string, string> | null {
  const patch: Record<string, string> = { ...CLEARED_SPH_ADD };
  let restored = false;
  EYES.forEach((eye) => {
    const view = sphAdditionFor(prescription, eye === "r" ? "R" : "L");
    if (!view) return;
    patch[`${eye}_sph`] = String(view.far);
    restored = true;
  });
  return restored || prescription.sph_add_type ? patch : null;
}
