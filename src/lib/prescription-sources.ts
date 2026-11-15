import { getExamPageData, getExamsByClientId } from "@/lib/db/exams-db";
import { getOrdersByClientId } from "@/lib/db/orders-db";
import type { OpticalExam, Order } from "@/lib/db/schema-interface";
import {
  extractAdditionAddSourcesFromExamPageData,
  isSphAddType,
  sphWithAddition,
  type AdditionAddSourceMap,
  type AdditionAddType,
} from "@/lib/addition-add-sources";

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
  /** The exam's Addition card, by the glasses each addition is for. */
  additions: AdditionAddSourceMap;
}

/** The client's recent exams that filled the prescription card of a kind, newest first. */
export async function loadExamPrescriptions(clientId: number, kind: PrescriptionKind): Promise<ExamPrescription[]> {
  const exams = (await getExamsByClientId(clientId)).filter((exam) => exam.id).slice(0, EXAMS_TO_READ);
  const pages = await Promise.all(exams.map((exam) => getExamPageData(exam.id!)));
  return exams.flatMap((exam, index) => {
    for (const row of pages[index]?.instances || []) {
      const prescription = examPrescription(row?.exam_data || {}, kind);
      if (prescription) return [{ exam, prescription, additions: extractAdditionAddSourcesFromExamPageData(pages[index]) }];
    }
    return [];
  });
}

/** An exam's prescription in an order's shape, so a card fills from it the way it fills from an order. */
export function prescriptionAsOrder(prescription: Record<string, any>, kind: PrescriptionKind): Order {
  return { order_data: { [EXAM_CARD[kind]]: prescription }, ...(kind === "contact" ? { __contact: true } : {}) } as unknown as Order;
}

/** A glasses prescription taking an exam addition: its ADD for both eyes, and the glasses type it is for. */
export function withAddition(source: Order, type: AdditionAddType, additions: AdditionAddSourceMap): Order {
  const addition = additions[type] || {};
  const prescription = orderPrescription(source, "glasses");
  return {
    ...source,
    order_data: {
      [EXAM_CARD.glasses]: {
        ...prescription,
        add_type: type,
        r_ad: addition.r_ad ?? prescription.r_ad,
        l_ad: addition.l_ad ?? prescription.l_ad,
        addition_add_sources: additions,
        __addition_from_exam: true,
      },
    },
  } as unknown as Order;
}

const eyes = (fields: string[]) => fields.flatMap((field) => [`r_${field}`, `l_${field}`]);
// The fields an order's prescription card holds, so a fill replaces the whole card.
const ORDER_CARD_FIELDS: Record<PrescriptionKind, string[]> = {
  glasses: [...eyes(["sph", "cyl", "ax", "pris", "base", "ad", "pd_far", "pd_close", "high"]), "comb_pd_far", "comb_pd_close", "comb_high"],
  contact: [...eyes(["bc", "oz", "diam", "sph", "cyl", "ax", "read_ad", "va", "j"]), "comb_va", "comb_j"],
};
// Older prescriptions kept the far PD under these names.
const LEGACY_FIELDS: Record<string, string> = { r_pd_far: "r_pd", l_pd_far: "l_pd", comb_pd_far: "comb_pd" };

/** The values an order's prescription card takes from a source: every card field, empty where the source has none; null when it has no prescription. */
export function orderCardFill(source: Order, kind: PrescriptionKind): Record<string, string> | null {
  const block = orderPrescription(source, kind);
  const values = Object.fromEntries(
    ORDER_CARD_FIELDS[kind].map((field) => {
      const value = block[field] ?? block[LEGACY_FIELDS[field]];
      return [field, filled(value) ? String(value) : ""];
    }),
  );
  if (!Object.values(values).some(Boolean)) return null;
  if (kind === "glasses" && filled(block.add_type)) values.add_type = String(block.add_type);
  // Near and intermediate glasses from an exam addition carry it in SPH, as an order opened from the exam does.
  if (kind === "glasses" && block.__addition_from_exam && isSphAddType(block.add_type)) {
    const add = (eye: "r" | "l") => (filled(block[`${eye}_ad`]) ? Number(block[`${eye}_ad`]) : undefined);
    Object.assign(values, sphWithAddition(values, block.add_type, { r_ad: add("r"), l_ad: add("l") }, true) || {});
  }
  return values;
}
