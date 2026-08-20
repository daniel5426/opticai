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
