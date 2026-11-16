export type KeratometerUnit = "mm" | "D";

const KERATOMETER_CONVERSION_NUMERATOR = 337.5;
const KERATOMETER_UNIT_STEPS: Record<KeratometerUnit, number> = {
  mm: 0.01,
  D: 0.25,
};
const KERATOMETER_UNIT_RANGES: Record<KeratometerUnit, { min: string; max: string }> = {
  mm: { min: "5.00", max: "10.00" },
  D: { min: "33.75", max: "67.50" },
};

export function getKeratometerStep(unit: KeratometerUnit): string {
  return KERATOMETER_UNIT_STEPS[unit].toString();
}

export function getKeratometerRange(unit: KeratometerUnit): { min: string; max: string } {
  return KERATOMETER_UNIT_RANGES[unit];
}

export const KERATOMETER_MERIDIAN_RANGE = { min: "0", max: "180" } as const;

export function isKeratometerValueInRange(
  value: string | number | undefined | null,
  unit: KeratometerUnit | "meridian",
): boolean {
  if (value === undefined || value === null || value === "") {
    return true;
  }

  const numericValue =
    typeof value === "number" ? value : parseFloat(String(value).replace(",", "."));

  if (!Number.isFinite(numericValue)) {
    return true;
  }

  if (unit === "meridian") {
    return numericValue >= Number(KERATOMETER_MERIDIAN_RANGE.min)
      && numericValue <= Number(KERATOMETER_MERIDIAN_RANGE.max);
  }

  const range = getKeratometerRange(unit);
  return numericValue >= Number(range.min) && numericValue <= Number(range.max);
}

export function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function convertKeratometerValue(value: string | number, targetUnit: KeratometerUnit): string {
  const numericValue = typeof value === "number" ? value : parseFloat(value.replace(",", "."));

  if (!Number.isFinite(numericValue) || numericValue === 0) return "";

  const convertedValue = KERATOMETER_CONVERSION_NUMERATOR / numericValue;
  const roundedValue = roundToStep(convertedValue, KERATOMETER_UNIT_STEPS[targetUnit]);

  return roundedValue.toFixed(2);
}

function toKeratometerNumber(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null || value === "") return null;
  const numericValue = typeof value === "number" ? value : parseFloat(String(value).replace(",", "."));
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
}

/** AVG of the two readings, and the corneal cylinder: the power difference between them in diopters. */
export function deriveKeratometerAvgAndCyl(
  rh: string | number | undefined | null,
  rv: string | number | undefined | null,
  unit: KeratometerUnit,
): { avg: string; cyl: string } | null {
  const h = toKeratometerNumber(rh);
  const v = toKeratometerNumber(rv);
  if (h === null || v === null) return null;
  const toDiopters = (reading: number) => (unit === "mm" ? KERATOMETER_CONVERSION_NUMERATOR / reading : reading);
  return {
    avg: ((h + v) / 2).toFixed(2),
    cyl: Math.abs(toDiopters(h) - toDiopters(v)).toFixed(2),
  };
}
