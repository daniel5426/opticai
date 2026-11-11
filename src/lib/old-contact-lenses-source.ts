import { getOrdersByClientId } from "@/lib/db/orders-db";
import type { Order } from "@/lib/db/schema-interface";

const filled = (value: unknown) => value !== undefined && value !== null && String(value).trim() !== "";

const DETAIL_FIELDS = ["lens_type", "model", "supplier"] as const;
const PRESCRIPTION_FIELDS = ["bc", "diam", "sph", "cyl", "ax", "va", "j"] as const;

/** A contact lens order's lenses as Old Contact Lenses fields: the lens from its details, the powers from its prescription. */
export function contactOrderLenses(order: Order): Record<string, unknown> {
  let data: any = order.order_data || {};
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      data = {};
    }
  }
  const details = data["contact-lens-details"] || {};
  const prescription = data["contact-lens-exam"] || {};
  const lenses: Record<string, unknown> = {};
  for (const eye of ["r", "l"]) {
    for (const field of DETAIL_FIELDS) {
      const value = details[`${eye}_${field}`] ?? (field === "lens_type" ? details[`${eye}_type`] : undefined);
      if (filled(value)) lenses[`${eye}_${field}`] = value;
    }
    for (const field of PRESCRIPTION_FIELDS) {
      if (filled(prescription[`${eye}_${field}`])) lenses[`${eye}_${field}`] = prescription[`${eye}_${field}`];
    }
  }
  if (filled(prescription.comb_va)) lenses.comb_va = prescription.comb_va;
  return lenses;
}

export const isContactLensOrder = (order: Order) => Boolean((order as any).__contact);

/** The lenses of the client's latest contact lens order that has any. */
export async function findLatestContactLensOrderLenses(clientId: number): Promise<Record<string, unknown> | null> {
  const orders = (await getOrdersByClientId(clientId))
    .filter(isContactLensOrder)
    .sort((a, b) => String(b.order_date || "").localeCompare(String(a.order_date || "")) || (b.id || 0) - (a.id || 0));
  for (const order of orders) {
    const lenses = contactOrderLenses(order);
    if (Object.keys(lenses).length) return lenses;
  }
  return null;
}

/** Fills the empty fields of every Old Contact Lenses card in the exam data from those lenses. */
export function fillOldContactLenses(examData: Record<string, any>, lenses: Record<string, unknown>) {
  let changed = false;
  const next = { ...examData };
  for (const [key, block] of Object.entries(examData)) {
    if (!key.startsWith("old-contact-lenses") || !block || typeof block !== "object") continue;
    const additions = Object.fromEntries(Object.entries(lenses).filter(([field]) => !filled(block[field])));
    if (Object.keys(additions).length) {
      next[key] = { ...block, ...additions };
      changed = true;
    }
  }
  return changed ? next : examData;
}
