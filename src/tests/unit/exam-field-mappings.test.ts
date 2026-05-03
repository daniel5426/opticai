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
});
