import { describe, expect, test } from "vitest";
import { ExamCardFieldLayout } from "@/pages/exam-detail/extra-field-columns";
import {
  computeCardMinGridCols,
  packCardsIntoGridItems,
} from "@/pages/exam-detail/utils";

describe("ExamCardFieldLayout", () => {
  test("does not add extra columns for a default subjective card", () => {
    expect(
      ExamCardFieldLayout.countExtraColumns("subjective", {
        r_sph: 1,
        r_va: "6/6",
      }),
    ).toBe(0);
    expect(computeCardMinGridCols("subjective")).toBe(
      computeCardMinGridCols("subjective", 24, 1, 0),
    );
  });

  test("counts migrated subjective pinhole, J, and vertical prism columns", () => {
    expect(
      ExamCardFieldLayout.countExtraColumns("subjective", {
        r_ph: "6/99",
        l_j: "J4",
        r_pr_v: 1,
      }),
    ).toBe(4);
    expect(
      ExamCardFieldLayout.countExtraColumns("final-subjective", {
        r_pr_v: 1,
        r_j: "J5",
      }),
    ).toBe(2);
  });

  test("all-data packing widens only cards that have extra migrated columns", () => {
    const defaultWidth = computeCardMinGridCols("subjective");
    const wideWidth = computeCardMinGridCols("subjective", 24, 1, 4);
    const items = packCardsIntoGridItems([
      { id: "empty-sub", type: "subjective" },
      {
        id: "migrated-sub",
        type: "subjective",
        extraFieldColumns: 4,
      },
      { id: "notes-1", type: "notes" },
    ]);

    expect(wideWidth).toBeGreaterThan(defaultWidth);
    expect(items.find((item) => item.id === "empty-sub")?.w).toBe(defaultWidth);
    expect(items.find((item) => item.id === "migrated-sub")?.w).toBe(wideWidth);
    expect(items.find((item) => item.id === "migrated-sub")).not.toHaveProperty(
      "extraFieldColumns",
    );
  });

  test("upsert keeps the widest extra-column count for the same card", () => {
    const cards: Array<{
      id: string;
      type: "subjective";
      extraFieldColumns?: number;
    }> = [];
    const indexByKey = new Map<string, number>();
    ExamCardFieldLayout.upsert(
      cards,
      indexByKey,
      { id: "1", type: "subjective" },
      1,
    );
    ExamCardFieldLayout.upsert(
      cards,
      indexByKey,
      { id: "1", type: "subjective" },
      4,
    );
    expect(cards).toHaveLength(1);
    expect(cards[0].extraFieldColumns).toBe(4);
  });
});
