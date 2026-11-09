import { describe, expect, test } from "vitest";
import { sameDayContactLensOrders, softopticContactLensExam } from "@/lib/softoptic-contact-lens";
import { buildSoftopticTabs, withContactLensTab } from "@/lib/softoptic-exam-tabs";

describe("OpticSoft contact lens screen on the exam", () => {
  test("a same-day contact order keeps existing eye exam cards accessible", () => {
    const card = { id: "final", type: "final-subjective" };
    const tabs = withContactLensTab(buildSoftopticTabs([card], () => []), true);
    expect(tabs.find((tab) => tab.key === "subjective")?.cards).toContain(card);
    expect(tabs.at(-1)?.key).toBe("contactLens");
  });

  test("does not convert decimal visual acuity to a meter denominator", () => {
    expect(softopticContactLensExam({ r_va: "0.5", l_va: "1.0+2", comb_va: "0.8" }))
      .toMatchObject({ r_va: "0.5", l_va: "1.0+2", comb_va: "0.8" });
  });
  test("takes the contact lens orders of the exam's day", () => {
    const orders = [
      { id: 1, order_date: "2026-08-25", order_data: { "keratometer-contact-lens": { r_rh: 7.53 } } },
      { id: 2, order_date: "2026-08-25", order_data: {} },
      { id: 3, order_date: "2026-07-30", order_data: { "contact-lens-exam": { r_sph: -4 } } },
    ];
    expect(sameDayContactLensOrders(orders, "2026-08-25").map((order) => order.id)).toEqual([1]);
    expect(sameDayContactLensOrders(orders, null)).toEqual([]);
  });

  test("shows older imports' values as OpticSoft does", () => {
    expect(
      softopticContactLensExam({ r_bc: 84, l_bc: 8.6, r_bc_2: "Flt", r_va: "6-", l_va: "6/9", r_j: "1+", comb_va: "6-2" }),
    ).toMatchObject({ r_bc: 8.4, l_bc: 8.6, r_bc_2: "Flt", r_va: "6/6-", l_va: "6/9", r_j: "J1+", comb_va: "6/6-2" });
  });
});
