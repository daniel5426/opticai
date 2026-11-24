import { describe, expect, test } from "vitest";
import { computeCardMinGridCols } from "@/pages/exam-detail/utils";
import { packSoftopticCards } from "@/lib/softoptic-exam-layout";

describe("SoftOptic tab layout", () => {
  test("keeps source order and uses catalog widths", () => {
    const items = packSoftopticCards([
      { id: "subjective", type: "subjective" },
      { id: "final-subjective", type: "final-subjective" },
      { id: "addition", type: "addition" },
      { id: "rg-balance", type: "rg-balance" },
      { id: "uncorrected-va", type: "uncorrected-va" },
    ] as any);
    expect(items.map(({ id, x, y }) => [id, y, x])).toEqual([
      ["subjective", 0, 0],
      ["final-subjective", 1, 0],
      ["addition", 1, items[1].w],
      ["rg-balance", 2, 0],
      ["uncorrected-va", 2, items[4].x],
    ]);
    expect(items.every(item => item.w === computeCardMinGridCols(item.type))).toBe(true);
    expect(items.every(item => item.x + item.w <= 24)).toBe(true);
  });
});
