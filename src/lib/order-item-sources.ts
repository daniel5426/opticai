import type { Order } from "@/lib/db/schema-interface";

/** An order card that can be filled from the same card of an earlier order. */
export type OrderItemKind = "frame" | "lenses" | "contact-details";

const filled = (value: unknown) => value !== undefined && value !== null && String(value).trim() !== "";
const text = (value: unknown) => (filled(value) ? String(value).trim() : "");

const orderData = (order: Order): Record<string, any> => {
  const data: unknown = order.order_data;
  if (typeof data !== "string") return (data as Record<string, any>) || {};
  try {
    return JSON.parse(data) || {};
  } catch {
    return {};
  }
};

/** A glasses order's lenses and frame: its first lens/frame tab, or the older top-level blocks. */
function lensFrame(order: Order): { lens: Record<string, any>; frame: Record<string, any> } {
  const data = orderData(order);
  const tab = Array.isArray(data.lens_frame_tabs) ? data.lens_frame_tabs[0] : undefined;
  return { lens: tab?.lens || data.lens || {}, frame: tab?.frame || data.frame || {} };
}

// The fields each card is filled with; a fill replaces them all, empty where the source has none.
export const FRAME_FIELDS = ["manufacturer", "model", "supplier", "color", "width", "bridge", "height", "length"] as const;
const FRAME_MEASUREMENTS = new Set(["width", "bridge", "height", "length"]);
const LENS_KEYS = ["supplier", "material", "model", "coating", "color", "diameter"] as const;
// Older orders kept one value for both lenses under these names.
const LENS_SHARED_KEYS = new Set(["supplier", "material", "coating", "color"]);
const CONTACT_KEYS = ["type", "model", "supplier", "material", "color", "dx"] as const;

function frameFill(order: Order): Record<string, string> {
  const { frame } = lensFrame(order);
  return Object.fromEntries(
    FRAME_FIELDS.map((field) => {
      const value = text(frame[field]);
      // Imports wrote 0 for a measurement they did not have.
      return [field, FRAME_MEASUREMENTS.has(field) && Number(value) === 0 ? "" : value];
    }),
  );
}

function lensFill(order: Order): Record<string, string> {
  const { lens } = lensFrame(order);
  const values: Record<string, string> = {};
  for (const side of ["right", "left"]) {
    for (const key of LENS_KEYS) {
      values[`${side}_${key}`] = text(lens[`${side}_${key}`]) || (LENS_SHARED_KEYS.has(key) ? text(lens[key]) : "");
    }
  }
  return values;
}

function contactFill(order: Order): Record<string, string> {
  const details = orderData(order)["contact-lens-details"] || {};
  const values: Record<string, string> = {};
  for (const eye of ["r", "l"]) {
    for (const key of CONTACT_KEYS) {
      values[`${eye}_${key}`] = text(details[`${eye}_${key}`]) || (key === "type" ? text(details[`${eye}_lens_type`]) : "");
    }
  }
  return values;
}

/** The values a card takes from an earlier order: every card field, empty where the order has none; null when it has nothing for the card. */
export function orderItemFill(order: Order, kind: OrderItemKind): Record<string, string> | null {
  const values = kind === "frame" ? frameFill(order) : kind === "lenses" ? lensFill(order) : contactFill(order);
  return Object.values(values).some(Boolean) ? values : null;
}

const join = (parts: unknown[], separator = " · ") => parts.map(text).filter(Boolean).join(separator);

/** One line per eye, or a single line when both eyes match. */
function perEye(values: Record<string, string>, prefixes: [string, string], keys: readonly string[]): string[] {
  const [right, left] = prefixes.map((prefix) => join(keys.map((key) => values[`${prefix}_${key}`])));
  if (right === left) return right ? [right] : [];
  return [right && `R: ${right}`, left && `L: ${left}`].filter(Boolean);
}

/** What an order's card holds, at a glance: a line or two, or none when it holds nothing. */
export function orderItemSummary(values: Record<string, string> | null, kind: OrderItemKind): string[] {
  if (!values) return [];
  if (kind === "frame") {
    const size = join([values.width, values.bridge, values.length], "-");
    return [join([values.manufacturer, values.model, values.color]), join([size, values.supplier])].filter(Boolean);
  }
  if (kind === "lenses") return perEye(values, ["right", "left"], ["model", "material", "coating", "color", "supplier"]);
  return perEye(values, ["r", "l"], ["type", "model", "material", "color", "supplier"]);
}
