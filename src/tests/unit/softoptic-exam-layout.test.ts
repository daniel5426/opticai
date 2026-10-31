import { describe, expect, test } from "vitest";
import { packSoftopticCards } from "@/lib/softoptic-exam-layout";

describe("SoftOptic tab layout", () => {
  test("keeps OpticSoft's order, gives refraction blocks a full row and fills the rest", () => {
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
      ["addition", 2, 0],
      ["rg-balance", 2, items[3].x],
      ["uncorrected-va", 2, items[4].x],
    ]);
    // Every row spans the full 24-column grid.
    for (const y of [0, 1, 2]) {
      expect(items.filter((item) => item.y === y).reduce((sum, item) => sum + item.w, 0)).toBe(24);
    }
  });
});
