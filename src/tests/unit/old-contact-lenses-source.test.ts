import { beforeEach, expect, test, vi } from "vitest";

const db = vi.hoisted(() => ({ orders: [] as any[] }));
vi.mock("@/lib/db/orders-db", () => ({ getOrdersByClientId: async () => db.orders }));
import { contactOrderLenses, fillOldContactLenses, findLatestContactLensOrderLenses } from "@/lib/old-contact-lenses-source";

const contactOrder = (id: number, order_date: string, model: string) => ({
  id, order_date, __contact: true,
  order_data: {
    "contact-lens-details": { r_type: "רכות חודשיות", r_model: model, l_lens_type: "רכות חודשיות", l_model: model, r_supplier: null },
    "contact-lens-exam": { r_bc: 8.4, r_sph: -4, l_bc: 8.4, l_sph: -3.5, r_cyl: null, comb_va: "6/6" },
  },
});

beforeEach(() => {
  db.orders = [
    contactOrder(1, "2025-01-01", "Older"),
    { id: 2, order_date: "2026-06-01", order_data: { "final-prescription": { r_sph: -1 } } }, // glasses
    contactOrder(3, "2026-02-01", "DISPO AIR"),
    { id: 4, order_date: "2026-03-01", __contact: true, order_data: {} }, // no lenses
  ];
});

test("reads an order's lenses from its details and prescription", () => {
  expect(contactOrderLenses(db.orders[2])).toEqual({
    r_lens_type: "רכות חודשיות", r_model: "DISPO AIR", r_bc: 8.4, r_sph: -4,
    l_lens_type: "רכות חודשיות", l_model: "DISPO AIR", l_bc: 8.4, l_sph: -3.5, comb_va: "6/6",
  });
});

test("takes the latest contact lens order that has lenses", async () => {
  expect((await findLatestContactLensOrderLenses(7))?.r_model).toBe("DISPO AIR");
  db.orders = [db.orders[1]];
  expect(await findLatestContactLensOrderLenses(7)).toBeNull();
});

test("fills only the empty fields of every old lenses card", () => {
  const data = { "old-contact-lenses-x": { card_instance_id: "x", r_model: "Typed" }, "objective-y": { r_sph: 1 } };
  const next = fillOldContactLenses(data, { r_model: "Air", r_bc: 8.6 });
  expect(next["old-contact-lenses-x"]).toEqual({ card_instance_id: "x", r_model: "Typed", r_bc: 8.6 });
  expect(next["objective-y"]).toBe(data["objective-y"]);
  expect(fillOldContactLenses(next, { r_bc: 9 })).toBe(next);
});
