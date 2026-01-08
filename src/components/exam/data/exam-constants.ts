// Visual Acuity - Meter Method (שיטת מטר)
export const VA_METER_VALUES = [
  '6/120',
  '6/60',
  '6/24',
  '6/18',
  '6/15',
  '6/12',
  '6/10',
  '6/9',
  '6/7.5',
  '6/6'
] as const;

// Visual Acuity - Decimal Method (שיטת פיט)
export const VA_DECIMAL_VALUES = [
  '1.0',
  '0.9',
  '0.8',
  '0.7',
  '0.6',
  '0.5',
  '0.4',
  '0.3',
  '0.2',
  '0.1'
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
  'B.IN',
  'B.OUT',
  'B.UP',
  'B.DOWN'
] as const;

// Field Configuration Types
export type FieldType = 'number' | 'select' | 'text';

// PD Rules
export const PD_MIN = "0";

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
  requireSign?: boolean; // Always show +/- sign
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
