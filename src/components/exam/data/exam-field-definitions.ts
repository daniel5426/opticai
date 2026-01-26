import { PD_EYE_MIN, PD_EYE_MAX, PD_COMB_MIN, PD_COMB_MAX } from "./exam-constants";

export interface FieldConfig {
  label: string;
  step?: string;
  type?: string;
  min?: number;
  max?: number;
  showPlus?: boolean;
  suffix?: string;
  unit?: string;
  center?: boolean;
  lookupType?: string;
  options?: string[];
}

export const EXAM_FIELDS = {
  SPH: {
    label: "SPH",
    step: "0.25",
    type: "number",
    min: -30,
    max: 30,
    showPlus: true,
  } as FieldConfig,
  CYL: {
    label: "CYL",
    step: "0.25",
    type: "number",
    min: -30,
    max: 30,
    showPlus: true,
  } as FieldConfig,
  AXIS: {
    label: "AXIS",
    step: "1",
    type: "number",
    min: 0,
    max: 180,
    showPlus: false,
  } as FieldConfig,
  ADD: {
    label: "ADD",
    step: "0.25",
    type: "number",
    min: 0,
    max: 5,
    showPlus: true,
  } as FieldConfig,
  PRISM: {
    label: "PRISM",
    step: "0.25",
    type: "number",
    min: 0,
    max: 50,
    showPlus: false,
  } as FieldConfig,
  PD_FAR: {
    label: "PD FAR",
    step: "0.5",
    type: "number",
    min: PD_EYE_MIN,
    max: 45,
    showPlus: false,
    suffix: "mm",
  } as FieldConfig,
  PD_NEAR: {
    label: "PD NEAR",
    step: "0.5",
    type: "number",
    min: PD_EYE_MIN,
    max: 45,
    showPlus: false,
    suffix: "mm",
  } as FieldConfig,
  PD_COMB: {
    label: "PD",
    step: "0.5",
    type: "number",
    min: PD_COMB_MIN,
    max: 80,
    showPlus: false,
    suffix: "mm",
  } as FieldConfig,
  PUPIL_DIAMETER: {
    label: "קוטר אישון",
    step: "0.1",
    type: "number",
    min: 0,
    max: 12,
    unit: "mm",
  } as FieldConfig,
  CORNEAL_DIAMETER: {
    label: "קוטר קרנית",
    step: "0.1",
    type: "number",
    min: 9,
    max: 18,
    unit: "mm",
  } as FieldConfig,
  EYELID_APERTURE: {
    label: "מפתח עפעף",
    step: "0.1",
    type: "number",
    min: 0,
    max: 30,
    unit: "mm",
  } as FieldConfig,
  BUT: {
    label: "BUT",
    step: "0.1",
    type: "number",
    min: 0,
    unit: "sec",
  } as FieldConfig,
  FCC: {
    label: "FCC",
    step: "0.25",
    type: "number",
    min: -7,
    max: 5,
    showPlus: false,
  } as FieldConfig,
  BASE: {
    label: "BASE",
    step: "0.1",
    type: "number",
    showPlus: false,
    center: true,
  } as FieldConfig,
  BC: {
    label: "BC",
    step: "0.01",
    type: "number",
    min: 0,
    max: 12,
    showPlus: false,
  } as FieldConfig,
  OZ: {
    label: "OZ",
    step: "0.1",
    type: "number",
    min: 0,
    max: 12,
    showPlus: false,
  } as FieldConfig,
  DIAM: {
    label: "DIAM",
    step: "0.1",
    type: "number",
    min: 0,
    max: 20,
    suffix: "mm",
    showPlus: false,
  } as FieldConfig,
  READ: {
    label: "READ",
    step: "0.25",
    type: "number",
    min: 0,
    max: 5,
    showPlus: true,
  } as FieldConfig,
  INT: {
    label: "INT",
    step: "0.25",
    type: "number",
    min: 0,
    max: 5,
    showPlus: true,
  } as FieldConfig,
  BIF: {
    label: "BIF",
    step: "0.25",
    type: "number",
    min: 0,
    max: 5,
    showPlus: true,
  } as FieldConfig,
  MUL: {
    label: "MUL",
    step: "0.25",
    type: "number",
    min: 0,
    max: 5,
    showPlus: true,
  } as FieldConfig,
  IOP: {
    label: "IOP",
    step: "0.1",
    type: "number",
    min: 0,
    max: 60,
    showPlus: false,
  } as FieldConfig,
  SE: {
    label: "SE",
    step: "0.25",
    type: "number",
    showPlus: true,
  } as FieldConfig,
  VA: {
    label: "VA",
    step: "0.1",
    type: "number",
    showPlus: false,
  } as FieldConfig,
  J: {
    label: "J",
    step: "1",
    type: "number",
    showPlus: false,
    center: true,
  } as FieldConfig,
  HIGH: {
    label: "HIGH",
    step: "0.5",
    type: "number",
    showPlus: false,
  } as FieldConfig,
  MM: {
    label: "MM",
    min: 0,
    step: "0.1",
    type: "number",
    showPlus: false,
  } as FieldConfig,
  READ_AD: {
    label: "ADD",
    step: "0.25",
    type: "number",
    min: 0,
    max: 5,
    showPlus: true,
  } as FieldConfig,
  CONTACT_LENS_TYPE: {
    label: "סוג",
    type: "text",
    lookupType: "contactLensType",
  } as FieldConfig,
  CONTACT_LENS_MODEL: {
    label: "דגם",
    type: "text",
    lookupType: "contactLensModel",
  } as FieldConfig,
  CONTACT_LENS_SUPPLIER: {
    label: "ספק",
    type: "text",
    lookupType: "supplier",
  } as FieldConfig,
  CONTACT_LENS_MATERIAL: {
    label: "חומר",
    type: "text",
    lookupType: "contactEyeMaterial",
  } as FieldConfig,
  CONTACT_LENS_COLOR: {
    label: "צבע",
    type: "text",
    lookupType: "color",
  } as FieldConfig,
  CONTACT_LENS_QUANTITY: {
    label: "כמות",
    type: "number",
    step: "1",
    min: 0,
  } as FieldConfig,
  CONTACT_LENS_ORDER_QUANTITY: {
    label: "להזמין",
    type: "number",
    step: "1",
    min: 0,
  } as FieldConfig,
  CONTACT_LENS_DX: {
    label: "DX",
    type: "number",
    step: "1",
    min: 83,
    max: 180,
    showPlus: false,
  } as FieldConfig,
  FL_TIME: {
    label: "Fl. Time",
    type: "number",
    step: "1",
    min: 0,
    max: 30,
    suffix: 'sec',
  } as FieldConfig,
  BIO_M: {
    label: "Bio. M.",
    type: "select",
    options: [
      "Grade 0 (Clear)",
      "Grade 1 (Trace)",
      "Grade 2 (Mild)",
      "Grade 3 (Moderate)",
      "Grade 4 (Severe)",
      "Staining",
      "Neovascularization",
      "GPC / Papillae",
      "Edema",
      "Infiltrates",
    ],
  } as FieldConfig,
  STEREO_FLY: {
    label: "Fly",
    type: "select",
    options: ["pass", "fail"],
  } as FieldConfig,
  STEREO_CIRCLE: {
    label: "Circle",
    type: "number",
    min: 0,
    max: 10,
    step: "1",
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
