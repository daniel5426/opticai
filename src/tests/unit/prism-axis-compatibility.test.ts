import { describe, expect, test } from "vitest";
import { PrismAxisCompatibility } from "@/lib/prism-axis-compatibility";
import { ensureLayoutDataForRows } from "@/lib/exam-ui-metadata";
import { CardRow } from "@/pages/exam-detail/types";
import { buildPrismAxisColumns } from "@/components/exam/shared/prismAxisColumns";
import { EXAM_FIELDS } from "@/components/exam/data/exam-field-definitions";

describe("PrismAxisCompatibility", () => {
  test("dual-writes horizontal aliases from legacy pris/base", () => {
    const normalized = PrismAxisCompatibility.normalizeBlock({
      r_pris: 2,
      r_base: "IN",
      l_sph: -1,
    });

    expect(normalized.r_pr_h).toBe(2);
    expect(normalized.r_base_h).toBe("IN");
    expect(normalized.r_pris).toBe(2);
    expect(normalized.r_base).toBe("IN");
  });

  test("fills legacy pris/base from split-only keys", () => {
    const normalized = PrismAxisCompatibility.normalizeBlock({
      r_pr_h: 1.5,
      r_base_h: "OUT",
    });

    expect(normalized.r_pris).toBe(1.5);
    expect(normalized.r_base).toBe("OUT");
  });

  test("prefers legacy pris when an old client leaves a stale split alias", () => {
    const normalized = PrismAxisCompatibility.normalizeBlock({
      r_pris: 4,
      r_pr_h: 2,
    });

    expect(normalized.r_pris).toBe(4);
    expect(normalized.r_pr_h).toBe(4);
  });

  test("normalizes instance-keyed subjective blocks", () => {
    const normalized = PrismAxisCompatibility.normalizeExamData({
      "subjective-card-1": { r_pris: 3, r_base: "UP" },
      notes: { text: "keep" },
    });

    expect(normalized["subjective-card-1"]).toEqual({
      r_pris: 3,
      r_base: "UP",
      r_pr_h: 3,
      r_base_h: "UP",
    });
    expect(normalized.notes).toEqual({ text: "keep" });
  });

  test("treats zero vertical prism as empty", () => {
    expect(
      PrismAxisCompatibility.hasVerticalPrism({ r_pr_v: 0, r_base_v: "UP" }),
    ).toBe(true);
    expect(PrismAxisCompatibility.hasVerticalPrism({ r_pr_v: 0 })).toBe(false);
    expect(PrismAxisCompatibility.hasVerticalPrism({ r_pr_v: 1 })).toBe(true);
  });
});

describe("subjective prism layout migration", () => {
  test("upgrades stored subjective JSON when opening an existing exam", () => {
    const layoutRows: CardRow[] = [
      {
        id: "row-1",
        cards: [{ id: "subjective-1", type: "subjective" }],
      },
    ];
    const normalized = ensureLayoutDataForRows(
      {
        "subjective-subjective-1": {
          layout_instance_id: 42,
          card_instance_id: "subjective-1",
          r_pris: 2,
          r_base: "IN",
        },
      },
      layoutRows,
      42,
    );

    expect(normalized.changed).toBe(true);
    expect(normalized.examData["subjective-subjective-1"].r_pr_h).toBe(2);
    expect(normalized.examData["subjective-subjective-1"].r_base_h).toBe("IN");
    expect(normalized.examData["subjective-subjective-1"].r_pris).toBe(2);
  });
});

describe("prism axis columns", () => {
  test("stays compact until vertical is shown", () => {
    const compact = buildPrismAxisColumns({
      showVertical: false,
      showAddVertical: true,
      compactBase: { key: "base", ...EXAM_FIELDS.BASE, type: "select", options: ["IN"] },
      expandedLabels: {
        prismHorizontal: "PR.H",
        baseHorizontal: "BASE.H",
        prismVertical: "PR.V",
        baseVertical: "BASE.V",
      },
      addVerticalLabel: "Add vertical prism",
      onAddVertical: () => undefined,
    });
    const expanded = buildPrismAxisColumns({
      showVertical: true,
      showAddVertical: true,
      compactBase: { key: "base", ...EXAM_FIELDS.BASE, type: "select", options: ["IN"] },
      expandedLabels: {
        prismHorizontal: "PR.H",
        baseHorizontal: "BASE.H",
        prismVertical: "PR.V",
        baseVertical: "BASE.V",
      },
      addVerticalLabel: "Add vertical prism",
      onAddVertical: () => undefined,
    });

    expect(compact.map((column) => column.key)).toEqual(["pris", "base"]);
    expect(expanded.map((column) => column.key)).toEqual([
      "pris",
      "base",
      "pr_v",
      "base_v",
    ]);
  });

  test("shows minus on expanded horizontal header when vertical is still empty", () => {
    const expanded = buildPrismAxisColumns({
      showVertical: true,
      showAddVertical: true,
      compactBase: { key: "base", ...EXAM_FIELDS.BASE, type: "select", options: ["IN"] },
      expandedLabels: {
        prismHorizontal: "PR.H",
        baseHorizontal: "BASE.H",
        prismVertical: "PR.V",
        baseVertical: "BASE.V",
      },
      addVerticalLabel: "Add vertical prism",
      onAddVertical: () => undefined,
      showRemoveVertical: true,
      removeVerticalLabel: "Remove vertical prism",
      onRemoveVertical: () => undefined,
    });

    expect(expanded[0].headerAccessory).toBeTruthy();
  });
});
