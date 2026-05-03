import { describe, expect, test } from "vitest";
import { ExamFieldMapper } from "@/lib/exam-field-mappings";

describe("ExamFieldMapper", () => {
  test("copies standardized PD fields into final prescription", () => {
    const copied = ExamFieldMapper.copyData(
      {
        r_pd_far: 31,
        l_pd_far: 30,
        comb_pd_far: 61,
        r_pd_close: 29,
        l_pd_close: 28,
        comb_pd_close: 57,
      },
      {},
      "subjective",
      "final-prescription",
    );

    expect(copied).toMatchObject({
      r_pd_far: 31,
      l_pd_far: 30,
      comb_pd_far: 61,
      r_pd_close: 29,
      l_pd_close: 28,
      comb_pd_close: 57,
    });
  });

  test("copies final prescription prism/base into final subjective", () => {
    const copied = ExamFieldMapper.copyData(
      {
        r_pris: 1.5,
        r_base: "UP",
        l_pris: 2,
        l_base: "OUT",
      },
      {
        r_pris: 9,
        r_base: "IN",
      },
      "final-prescription",
      "final-subjective",
    );

    expect(copied).toMatchObject({
      r_pris: 1.5,
      r_base: "UP",
      l_pris: 2,
      l_base: "OUT",
    });
  });

  test("clears final subjective combined J value", () => {
    expect(
      ExamFieldMapper.clearData({ comb_j: "J1" }, "final-subjective"),
    ).toMatchObject({
      comb_j: "",
    });
  });
});
