// Visual Acuity - Meter Method (שיטת מטר)
export const VA_METER_VALUES = [
  '6/190',
  '6/150',
  '6/120',
  '6/96',
  '6/75',
  '6/60',
  '6/48',
  '6/38',
  '6/30',
  '6/24',
  '6/18',
  '6/15',
  '6/12',
  '6/9',
  '6/7.5',
  '6/6',
  '6/4.5',
  '6/3'
] as const;

// Visual Acuity - Decimal Method (שיטת פיט)
export const VA_DECIMAL_VALUES = [
  '-0.3',
  '-0.2',
  '-0.1',
  '0.0',
  '0.1',
  '0.2',
  '0.3',
  '0.4',
  '0.5',
  '0.6',
  '0.7',
  '0.8',
  '0.9',
  '1.0',
  '1.1',
  '1.2',
  '1.3',
  '1.4',
  '1.5'
] as const;

// Near Vision - J Values (חדות ראיה לקרוב)
export const NV_J_VALUES = [
  'J10',
  'J9',
  'J8',
  'J7',
  'J6',
  'J5',
  'J4',
  'J3',
  'J2',
  'J1',
  'J1+'
] as const;

// Base Values (בסיס)
export const BASE_VALUES = [
  'IN',
  'OUT',
  'UP',
  'DOWN'
] as const;

export const BASE_VALUES_SIMPLE = [
  'IN',
  'OUT',
  'UP',
  'DOWN'
] as const;

// Field Configuration Types
export type FieldType = 'number' | 'select' | 'text';

// PD Rules
export const PD_EYE_MIN = 15;
export const PD_EYE_MAX = 45;
export const PD_COMB_MIN = 30;
export const PD_COMB_MAX = 90;

export interface FieldConfig {
  key: string;
  label: string;
  type?: FieldType;
  step?: string;
  min?: string | number;
  max?: string | number;
  options?: readonly string[];
  allowNegative?: boolean;
  allowPositive?: boolean;
  showPlus?: boolean; // Always show +/- sign
  suffix?: string; // e.g., "△" for prism
  format?: 'decimal' | 'integer'; // Force decimal format (x.xx)
}

// Validation and Formatting Utilities
export const ExamFieldUtils = {
  /**
   * Format a number to always show 2 decimal places (e.g., 1 -> 1.00)
   */
  formatDecimal: (value: string | number): string => {
    if (value === '' || value === null || value === undefined) return '';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '';
    return num.toFixed(2);
  },

  /**
   * Clamp a value between min and max
   */
  clampValue: (value: number, min?: number, max?: number): number => {
    let clamped = value;
    if (min !== undefined && clamped < min) clamped = min;
    if (max !== undefined && clamped > max) clamped = max;
    return clamped;
  },

  /**
   * Validate if a value is within range
   */
  isInRange: (value: string | number, min?: number, max?: number): boolean => {
    if (value === '' || value === null || value === undefined) return true;
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return false;
    if (min !== undefined && num < min) return false;
    if (max !== undefined && num > max) return false;
    return true;
  },

  /**
   * Add suffix to value (e.g., triangle symbol for prism)
   */
  addSuffix: (value: string, suffix?: string): string => {
    if (!suffix || !value) return value;
    return `${value}${suffix}`;
  }
};

export interface PDCalculationParams<T> {
  eye: "R" | "L" | "C";
  field: string;
  value: string;
  data: T;
  onChange: (field: keyof T, value: string) => void;
  getRValue: (data: T, field: string) => number;
  getLValue: (data: T, field: string) => number;
}

export const PDCalculationUtils = {
  handlePDChange: <T extends Record<string, any>>({
    eye,
    field,
    value,
    data,
    onChange,
    getRValue,
    getLValue
  }: PDCalculationParams<T>): void => {
    if (field !== "pd_far" && field !== "pd_close" && field !== "pd") {
      return;
    }

    const combField = `comb_${field}` as keyof T;
    const rField = `r_${field}` as keyof T;
    const lField = `l_${field}` as keyof T;

    if (eye === "C") {
      // Update combined field first
      onChange(combField, value);

      // Calculate half value for eyes
      const numValue = parseFloat(value);
      if (isNaN(numValue) || value === "" || numValue === 0) {
        // If combined is cleared, clear eyes too
        onChange(rField, "");
        onChange(lField, "");
      } else {
        const halfValue = (numValue / 2).toFixed(1);
        onChange(rField, halfValue);
        onChange(lField, halfValue);
      }
    } else {
      const eyeField = `${eye.toLowerCase()}_${field}` as keyof T;
      
      // Update the changed eye first
      onChange(eyeField, value);

      const numValue = parseFloat(value);
      const otherEyeVal = eye === "R" ? getLValue(data, field) : getRValue(data, field);

      if ((isNaN(numValue) || value === "") && (otherEyeVal === 0 || !otherEyeVal)) {
        // Both eyes empty -> clear combined
        onChange(combField, "");
      } else {
        // Calculate sum
        const val1 = isNaN(numValue) ? 0 : numValue;
        const val2 = otherEyeVal || 0;
        const sum = (val1 + val2).toFixed(1);
        onChange(combField, sum);
      }
    }
  }
};

export const SECalculationUtils = {
  handleSEChange: <T extends Record<string, any>>({
    eye,
    field,
    value,
    data,
    onChange,
    calculateSE
  }: {
    eye: "R" | "L";
    field: string;
    value: string;
    data: T;
    onChange: (field: keyof T, value: string) => void;
    calculateSE: (sph: any, cyl: any) => string;
  }): void => {
    if (field !== "sph" && field !== "cyl") return;

    const eyePrefix = eye.toLowerCase();
    const sph = field === "sph" ? value : data[`${eyePrefix}_sph`];
    const cyl = field === "cyl" ? value : data[`${eyePrefix}_cyl`];

    const se = calculateSE(sph, cyl);
    onChange(`${eyePrefix}_se` as keyof T, se);
  }
};
