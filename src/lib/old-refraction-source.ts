import type { OldRefractionExam, Order } from "@/lib/db/schema-interface";
import { normalizeOrderGlassesType, ORDER_GLASSES_TYPE_LABELS, sphWithoutAddition } from "@/lib/addition-add-sources";
import { loadExamPrescriptions, loadOrders, orderPrescription, prescriptionAsOrder, prescriptionSummary } from "@/lib/prescription-sources";

export type OldPrescription = Partial<OldRefractionExam>;

// A glasses prescription shows no VA or J, so a fill leaves them as they are.
const FIELDS = ["sph", "cyl", "ax", "pris", "base", "ad"].flatMap((field) => [`r_${field}`, `l_${field}`]);

/** A glasses prescription as Old Refraction fields, empty where it has none; null when it has no prescription. */
export function oldRefractionFill(source: Order): OldPrescription | null {
  const block = orderPrescription(source, "glasses");
  // Near and intermediate glasses may carry ADD inside SPH; beside an ADD, SPH is the far one.
  const prescription: Record<string, unknown> = { ...block, ...(sphWithoutAddition(block) || {}) };
  const values = Object.fromEntries(
    FIELDS.map((field) => [field, prescription[field] === undefined || prescription[field] === null ? "" : String(prescription[field])]),
  );
  if (!Object.values(values).some(Boolean)) return null;
  const type = normalizeOrderGlassesType(block.add_type);
  const label = type ? ORDER_GLASSES_TYPE_LABELS[type] : "";
  return { ...values, r_glasses_type: label, l_glasses_type: label } as OldPrescription;
}

/** The client's latest glasses prescription, from an order or an exam; an exam wins the same day. */
export async function latestOldPrescription(clientId: number): Promise<OldPrescription | null> {
  const [orders, exams] = await Promise.all([loadOrders(clientId, "glasses"), loadExamPrescriptions(clientId, "glasses")]);
  const order = orders.find((candidate) => prescriptionSummary(orderPrescription(candidate, "glasses")));
  const exam = [...exams].sort((a, b) => String(b.exam.exam_date || "").localeCompare(String(a.exam.exam_date || "")))[0];
  if (exam && (!order || String(exam.exam.exam_date || "") >= String(order.order_date || ""))) {
    return oldRefractionFill(prescriptionAsOrder(exam.prescription, "glasses"));
  }
  return order ? oldRefractionFill(order) : null;
}
