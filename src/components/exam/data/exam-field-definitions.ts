import { PD_MIN } from "./exam-constants";

export interface FieldConfig {
  label: string;
  step: string;
  min?: number;
  max?: number;
  requireSign?: boolean;
  suffix?: string;
  unit?: string;
}

export const EXAM_FIELDS = {
  SPH: {
    label: "SPH",
    step: "0.25",
    min: -30,
    max: 30,
    requireSign: true,
  } as FieldConfig,
  CYL: {
    label: "CYL",
    step: "0.25",
    min: -30,
    max: 30,
    requireSign: true,
  } as FieldConfig,
  AXIS: {
    label: "AXIS",
    step: "1",
    min: 0,
    max: 180,
  } as FieldConfig,
  ADD: {
    label: "ADD",
    step: "0.25",
    min: 0,
    max: 5,
    requireSign: true,
  } as FieldConfig,
  PRISM: {
    label: "PRISM",
    step: "0.25",
    min: 0,
    max: 50,
  } as FieldConfig,
  PD_FAR: {
    label: "PD FAR",
    step: "0.5",
    min: 35,
    max: 85,
  } as FieldConfig,
  PD_NEAR: {
    label: "PD NEAR",
    step: "0.5",
    min: 35,
    max: 85,
  } as FieldConfig,
  PUPIL_DIAMETER: {
    label: "קוטר אישון",
    step: "0.1",
    min: 0,
    max: 12,
    unit: "mm",
  } as FieldConfig,
  CORNEAL_DIAMETER: {
    label: "קוטר קרנית",
    step: "0.1",
    min: 9,
    max: 18,
    unit: "mm",
  } as FieldConfig,
  EYELID_APERTURE: {
    label: "מפתח עפעף",
    step: "0.1",
    min: 0,
    max: 30,
    unit: "mm",
  } as FieldConfig,
  BUT: {
    label: "BUT",
    step: "0.1",
    min: 0,
    unit: "sec",
  } as FieldConfig,
};

export const formatValueWithSign = (value: string | number | undefined): string => {
  if (value === undefined || value === "" || value === null) return "";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return value.toString();
  if (num > 0) return `+${num.toFixed(2)}`;
  if (num === 0) return "0.00";
  return num.toFixed(2); // Negative already has -
};

export const cleanValueForSign = (value: string): string => {
  // Utility to strip + when parsing back to number if needed, 
  // though parseFloat handles it.
  return value.replace("+", "");
};
