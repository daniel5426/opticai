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

test("an order's card takes every field from the source, clearing what it lacks", async () => {
  const { orderCardFill } = await import("@/lib/prescription-sources");
  const glasses = orderCardFill({ order_data: { "final-prescription": { r_sph: -2, l_cyl: -0.5, r_pd: 31, comb_pd: 62, add_type: "רב מוקדי" } } } as any, "glasses")!;
  expect(glasses).toMatchObject({ r_sph: "-2", l_cyl: "-0.5", r_pd_far: "31", comb_pd_far: "62", r_cyl: "", l_high: "", add_type: "רב מוקדי" });
  const contact = orderCardFill(prescriptionAsOrder({ r_bc: 8.6, l_read_ad: 1.5 }, "contact"), "contact")!;
  expect(contact).toMatchObject({ r_bc: "8.6", l_read_ad: "1.5", r_sph: "", comb_va: "" });
  expect(orderCardFill({ order_data: { "final-prescription": {} } } as any, "glasses")).toBeNull();
});

test("an exam's additions come with its prescription, and a chosen glasses type fills ADD and its SPH", async () => {
  const { orderCardFill, withAddition } = await import("@/lib/prescription-sources");
  db.pages[9].instances[0].exam_data["addition-x"] = { r_read: 1, l_read: 1.25, r_int: 0.75 };
  const [row] = await loadExamPrescriptions(5, "glasses");
  expect(row.additions).toEqual({ read: { r_ad: 1, l_ad: 1.25 }, int: { r_ad: 0.75 } });

  const near = withAddition(prescriptionAsOrder(row.prescription, "glasses"), "read", row.additions);
  expect(orderCardFill(near, "glasses")).toMatchObject({ add_type: "read", r_ad: "1", l_ad: "1.25", r_sph: "-1", l_sph: "1.25", sph_add_type: "read", sph_add_source: "exam" });
  // Bifocals keep the far SPH and only take the ADD.
  const bifocal = withAddition(prescriptionAsOrder({ r_sph: -2 }, "glasses"), "bif", { bif: { r_ad: 2 } });
  expect(orderCardFill(bifocal, "glasses")).toMatchObject({ add_type: "bif", r_ad: "2", r_sph: "-2" });
});
