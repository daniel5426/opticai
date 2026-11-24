import { describe, expect, test } from "vitest";
import { softopticContactLensExam } from "@/lib/softoptic-contact-lens";

describe("OpticSoft contact lens screen on the exam", () => {
  test("does not convert decimal visual acuity to a meter denominator", () => {
    expect(softopticContactLensExam({ r_va: "0.5", l_va: "1.0+2", comb_va: "0.8" }))
      .toMatchObject({ r_va: "0.5", l_va: "1.0+2", comb_va: "0.8" });
  });
  test("shows older imports' values as OpticSoft does", () => {
    expect(
      softopticContactLensExam({ r_bc: 84, l_bc: 8.6, r_bc_2: "Flt", r_va: "6-", l_va: "6/9", r_j: "1+", comb_va: "6-2" }),
    ).toMatchObject({ r_bc: 8.4, l_bc: 8.6, r_bc_2: "Flt", r_va: "6/6-", l_va: "6/9", r_j: "J1+", comb_va: "6/6-2" });
  });
});
