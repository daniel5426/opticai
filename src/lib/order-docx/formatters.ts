export function formatDate(value?: string | Date | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("he-IL");
}

export function formatCurrency(value?: number | string | null): string {
  if (value === undefined || value === null || value === "") return "";
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return "";
  return `${num.toLocaleString("he-IL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ש"ח`;
}

export function formatOpticalNumber(value?: number | string | null): string {
  if (value === undefined || value === null || value === "") return "";
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return String(value);
  if (num === 0) return "0.00";
  return `${num > 0 ? "+" : ""}${num.toFixed(2)}`;
}

export function formatPlainNumber(value?: number | string | null): string {
  if (value === undefined || value === null || value === "") return "";
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return String(value);
  if (Number.isInteger(num)) return String(num);
  return num.toLocaleString("he-IL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function formatAxis(value?: number | string | null): string {
  if (value === undefined || value === null || value === "") return "";
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return "";
  return String(Math.trunc(num)).padStart(3, "0");
}

export function formatPhone(value?: string | null): string {
  return value?.trim() || "";
}

export function joinLines(lines: Array<string | undefined | null>): string {
  return lines
    .map((line) => line?.trim() || "")
    .filter(Boolean)
    .join("\n");
}

export function formatAddress(parts: Array<string | undefined | null>): string {
  return parts
    .map((part) => part?.trim() || "")
    .filter(Boolean)
    .join(", ");
}

export function toDisplayString(value?: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "boolean") return value ? "כן" : "לא";
  return String(value);
}
