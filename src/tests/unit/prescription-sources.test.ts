import { beforeEach, expect, test, vi } from "vitest";

const db = vi.hoisted(() => ({ orders: [] as any[], exams: [] as any[], pages: {} as Record<number, any> }));
vi.mock("@/lib/db/orders-db", () => ({ getOrdersByClientId: async () => db.orders }));
vi.mock("@/lib/db/exams-db", () => ({ getExamsByClientId: async () => db.exams, getExamPageData: async (id: number) => db.pages[id] }));
import { examPrescription, loadExamPrescriptions, loadOrders, prescriptionAsOrder, prescriptionSummary } from "@/lib/prescription-sources";

beforeEach(() => {
  db.orders = [
    { id: 1, order_date: "2025-01-01" },
    { id: 2, order_date: "2026-01-01", __contact: true },
    { id: 3, order_date: "2026-03-01" },
  ];
  db.exams = [{ id: 10, exam_date: "2026-05-01" }, { id: 9, exam_date: "2026-04-01" }];
  db.pages = {
    10: { instances: [{ exam_data: { "final-prescription-a": { layout_instance_id: 1 }, "objective-b": { r_sph: 1 } } }] },
    9: { instances: [{ exam_data: { "final-prescription-c": { r_sph: -2, r_cyl: -0.5, r_ax: 90, l_sph: 0 } } }] },
  };
});

test("orders of the card's kind, newest first", async () => {
  expect((await loadOrders(5, "glasses")).map((order) => order.id)).toEqual([3, 1]);
  expect((await loadOrders(5, "contact")).map((order) => order.id)).toEqual([2]);
});

test("exams that filled the prescription card of the kind", async () => {
  const rows = await loadExamPrescriptions(5, "glasses");
  expect(rows.map((row) => row.exam.id)).toEqual([9]);
  expect(await loadExamPrescriptions(5, "contact")).toEqual([]);
  expect(examPrescription({ "contact-lens-exam-x": { r_bc: 8.6 } }, "contact")).toEqual({ r_bc: 8.6 });
});

test("a prescription at a glance, and in an order's shape", () => {
  expect(prescriptionSummary({ r_sph: -2, r_cyl: -0.5, r_ax: 90, l_sph: 0 })).toBe("R −2.00 −0.50×90 · L 0.00");
  expect(prescriptionAsOrder({ r_bc: 8.6 }, "contact")).toEqual({ order_data: { "contact-lens-exam": { r_bc: 8.6 } }, __contact: true });
  expect(prescriptionAsOrder({ r_sph: 1 }, "glasses")).toEqual({ order_data: { "final-prescription": { r_sph: 1 } } });
});
