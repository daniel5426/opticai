import { beforeEach, expect, test, vi } from "vitest";
import { latestOldPrescription, oldRefractionFill } from "@/lib/old-refraction-source";

const { orders, exams, page } = vi.hoisted(() => ({ orders: vi.fn(), exams: vi.fn(), page: vi.fn() }));
vi.mock("@/lib/db/orders-db", () => ({ getOrdersByClientId: orders }));
vi.mock("@/lib/db/exams-db", () => ({ getExamsByClientId: exams, getExamPageData: page }));

const order = (date: string, prescription: Record<string, unknown>) => ({ id: 1, order_date: date, order_data: { "final-prescription": prescription } }) as any;
beforeEach(() => {
  orders.mockResolvedValue([]);
  exams.mockResolvedValue([]);
  page.mockResolvedValue({ instances: [{ exam_data: { "final-prescription": { r_sph: -3 } } }] });
});

test("takes a glasses prescription without VA, with its glasses type", () => {
  expect(oldRefractionFill(order("", { r_sph: -2, r_va: "6/6", r_ad: 1.5, add_type: "mul" }))).toMatchObject({ r_sph: "-2", l_sph: "", r_ad: "1.5", r_glasses_type: "מולטיפוקל" });
  expect(oldRefractionFill(order("", { r_va: "6/6" }))).toBeNull();
});

test("near glasses that carry ADD in SPH give the far SPH beside the ADD", () => {
  expect(oldRefractionFill(order("", { r_sph: 3, r_ad: 2, add_type: "read", sph_add_type: "read", r_sph_far: 1, r_sph_add: 2 }))).toMatchObject({ r_sph: "1", r_ad: "2" });
});

test("the latest prescription comes from the newer of the orders and exams", async () => {
  expect(await latestOldPrescription(1)).toBeNull();
  orders.mockResolvedValue([order("2026-01-01", { r_sph: -1 }), order("2026-05-01", {})]);
  expect((await latestOldPrescription(1))!.r_sph).toBe("-1");
  exams.mockResolvedValue([{ id: 5, exam_date: "2025-06-01" }]);
  expect((await latestOldPrescription(1))!.r_sph).toBe("-1");
  exams.mockResolvedValue([{ id: 5, exam_date: "2026-01-01" }]);
  expect((await latestOldPrescription(1))!.r_sph).toBe("-3");
});
