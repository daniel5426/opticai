import { getExamPageData, getExamsByClientId } from "@/lib/db/exams-db";
import { getOrdersByClientId } from "@/lib/db/orders-db";
import type { OpticalExam, Order } from "@/lib/db/schema-interface";

export type PrescriptionKind = "glasses" | "contact";

// An exam's prescription card: the final prescription for glasses, the contact lens prescription for contact lenses.
const EXAM_CARD: Record<PrescriptionKind, string> = { glasses: "final-prescription", contact: "contact-lens-exam" };
// The newest exams are read for their prescription; older ones are not listed.
const EXAMS_TO_READ = 12;

const filled = (value: unknown) => value !== undefined && value !== null && String(value).trim() !== "";

const parse = (value: unknown): Record<string, any> => {
  if (typeof value !== "string") return (value as Record<string, any>) || {};
  try {
    return JSON.parse(value) || {};
  } catch {
    return {};
  }
};

const hasPowers = (block: Record<string, any>) => ["r_sph", "l_sph", "r_cyl", "l_cyl", "r_bc", "l_bc"].some((field) => filled(block[field]));

export const isContactOrder = (order: Order) => Boolean((order as any).__contact);

/** The prescription an order carries, for its kind. */
export function orderPrescription(order: Order, kind: PrescriptionKind): Record<string, any> {
  return parse(order.order_data)[EXAM_CARD[kind]] || {};
}

/** The filled prescription card of an exam's data, if it has one. */
export function examPrescription(examData: Record<string, any>, kind: PrescriptionKind): Record<string, any> | null {
  for (const [key, block] of Object.entries(examData || {})) {
    if (key.startsWith(EXAM_CARD[kind]) && block && typeof block === "object" && hasPowers(block)) return block;
  }
  return null;
}

const power = (value: unknown) => {
  const number = Number(value);
  if (!filled(value) || Number.isNaN(number)) return filled(value) ? String(value) : "";
  return `${number > 0 ? "+" : number < 0 ? "−" : ""}${Math.abs(number).toFixed(2)}`;
};

/** "R −2.00 −0.50×90 · L −1.75": a prescription at a glance. */
export function prescriptionSummary(block: Record<string, any>): string {
  const eye = (side: "r" | "l") => {
    const sph = power(block[`${side}_sph`]);
    const cyl = power(block[`${side}_cyl`]);
    const axis = filled(block[`${side}_ax`]) && cyl ? `×${block[`${side}_ax`]}` : "";
    const text = [sph, cyl && `${cyl}${axis}`].filter(Boolean).join(" ");
    return text ? `${side.toUpperCase()} ${text}` : "";
  };
  return [eye("r"), eye("l")].filter(Boolean).join(" · ");
}

/** The client's orders of a kind, newest first. */
export async function loadOrders(clientId: number, kind: PrescriptionKind): Promise<Order[]> {
  return (await getOrdersByClientId(clientId))
    .filter((order) => isContactOrder(order) === (kind === "contact"))
    .sort((a, b) => String(b.order_date || "").localeCompare(String(a.order_date || "")) || (b.id || 0) - (a.id || 0));
}

export interface ExamPrescription {
  exam: OpticalExam;
  prescription: Record<string, any>;
}

/** The client's recent exams that filled the prescription card of a kind, newest first. */
export async function loadExamPrescriptions(clientId: number, kind: PrescriptionKind): Promise<ExamPrescription[]> {
  const exams = (await getExamsByClientId(clientId)).filter((exam) => exam.id).slice(0, EXAMS_TO_READ);
  const pages = await Promise.all(exams.map((exam) => getExamPageData(exam.id!)));
  return exams.flatMap((exam, index) => {
    for (const row of pages[index]?.instances || []) {
      const prescription = examPrescription(row?.exam_data || {}, kind);
      if (prescription) return [{ exam, prescription }];
    }
    return [];
  });
}

/** An exam's prescription in an order's shape, so a card fills from it the way it fills from an order. */
export function prescriptionAsOrder(prescription: Record<string, any>, kind: PrescriptionKind): Order {
  return { order_data: { [EXAM_CARD[kind]]: prescription }, ...(kind === "contact" ? { __contact: true } : {}) } as unknown as Order;
}
