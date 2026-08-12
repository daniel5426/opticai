import { addDays, differenceInCalendarDays, format, parseISO, subDays } from "date-fns";

export type AnalyticsPreset = "7d" | "30d" | "90d" | "365d" | "custom";
export type AnalyticsBucket = "day" | "week" | "month";
export type AnalyticsPolarity = "higher" | "lower" | "neutral";

export interface AnalyticsRange {
  preset: AnalyticsPreset;
  startDate: string;
  endDate: string;
  bucket: AnalyticsBucket;
}

export interface AnalyticsSeriesPoint {
  bucket: string;
  label: string;
  value: number;
  [key: string]: string | number;
}

export interface AnalyticsMetric {
  key: string;
  label: string;
  value: number;
  previous: number;
  change_percent: number | null;
  series: AnalyticsSeriesPoint[];
  context?: string;
  snapshot?: boolean;
}

export interface CompanyAnalyticsResponse {
  range: Record<string, string>;
  currency: "ILS" | "USD" | "EUR";
  metrics: AnalyticsMetric[];
  financial_series: Array<{
    bucket: string;
    label: string;
    sales: number;
    collected: number;
    appointments: number;
    new_clients: number;
    orders: number;
  }>;
  activity: {
    series: CompanyAnalyticsResponse["financial_series"];
    appointments: number;
    previous_appointments: number;
    new_clients: number;
    previous_new_clients: number;
  };
  clinic_ranking: Array<{
    clinic_id: number;
    clinic_name: string;
    sales: number;
    collected: number;
    outstanding: number;
    orders: number;
    share: number;
  }>;
  order_mix: Array<{ type: string; count: number }>;
  top_products: Array<{ name: string; sku?: string | null; quantity: number; sales: number }>;
}

export interface WorkforceAnalyticsResponse {
  range: Record<string, string>;
  metrics: AnalyticsMetric[];
  series: Array<{ bucket: string; label: string; minutes: number; shifts: number; active_days: number }>;
}

export interface InventoryInsightItem {
  variant: any;
  units_demanded: number;
  daily_velocity: number;
  days_cover: number | null;
  stockout_risk: "out_of_stock" | "high" | "medium" | "low";
  reorder_quantity: number;
  confidence: "high" | "medium" | "low";
}

export interface InventoryAnalyticsResponse {
  period_days: number;
  currency: "ILS" | "USD" | "EUR";
  range: Record<string, string>;
  metrics: AnalyticsMetric[];
  demand_series: Array<{ bucket: string; label: string; consumed: number; frame: number; contact_lens: number }>;
  fulfillment_mix: Array<{ source: string; quantity: number }>;
  top_consumed: InventoryInsightItem[];
  reorder_suggestions: InventoryInsightItem[];
  slow_moving: InventoryInsightItem[];
  data_quality: {
    confidence: "high" | "medium" | "low";
    first_observation: string | null;
    observations: number;
    movements: number;
    deduplicated: boolean;
  };
  seasonality_available: boolean;
  method: string;
}

export const ANALYTICS_PRESETS: Array<{ value: AnalyticsPreset; label: string; days?: number }> = [
  { value: "7d", label: "7 ימים", days: 7 },
  { value: "30d", label: "30 ימים", days: 30 },
  { value: "90d", label: "90 ימים", days: 90 },
  { value: "365d", label: "שנה", days: 365 },
  { value: "custom", label: "טווח מותאם" },
];

export const toIsoDate = (value: Date) => format(value, "yyyy-MM-dd");

export function analyticsBucketForRange(startDate: string, endDate: string): AnalyticsBucket {
  const days = differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1;
  if (days <= 45) return "day";
  if (days <= 180) return "week";
  return "month";
}

export function rangeForPreset(preset: Exclude<AnalyticsPreset, "custom">, end = new Date()): AnalyticsRange {
  const days = Number(preset.replace("d", ""));
  const endDate = toIsoDate(end);
  const startDate = toIsoDate(subDays(end, days - 1));
  return { preset, startDate, endDate, bucket: analyticsBucketForRange(startDate, endDate) };
}

export function normalizeAnalyticsRange(
  preset: AnalyticsPreset,
  startDate: string | null,
  endDate: string | null,
  fallback: Exclude<AnalyticsPreset, "custom">,
): AnalyticsRange {
  if (preset !== "custom") return rangeForPreset(preset);
  if (!startDate || !endDate) return rangeForPreset(fallback);
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return rangeForPreset(fallback);
  return { preset, startDate, endDate, bucket: analyticsBucketForRange(startDate, endDate) };
}

export function previousAnalyticsRange(range: AnalyticsRange) {
  const days = differenceInCalendarDays(parseISO(range.endDate), parseISO(range.startDate)) + 1;
  return {
    startDate: toIsoDate(subDays(parseISO(range.startDate), days)),
    endDate: toIsoDate(subDays(parseISO(range.startDate), 1)),
  };
}

export function analyticsChangeLabel(current: number, previous: number, percent: number | null) {
  if (previous === 0 && current > 0) return "חדש";
  if (percent === null || !Number.isFinite(percent)) return "—";
  const formatter = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 1, signDisplay: "exceptZero" });
  return `${formatter.format(percent)}%`;
}

export function analyticsTrendTone(current: number, previous: number, polarity: AnalyticsPolarity) {
  if (current === previous || polarity === "neutral") return "neutral" as const;
  const improved = polarity === "higher" ? current > previous : current < previous;
  return improved ? ("positive" as const) : ("negative" as const);
}

export function rangeContains(range: AnalyticsRange, value: string) {
  return value >= range.startDate && value <= range.endDate;
}

export function sevenDayWindow(center: Date) {
  return Array.from({ length: 7 }, (_, index) => addDays(center, index - 3));
}
