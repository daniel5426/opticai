import { describe, expect, test } from "vitest";
import { getColumnCount } from "@/components/exam/ExamCardRenderer";
import { EXAM_FIELDS } from "@/components/exam/data/exam-field-definitions";
import { examComponentRegistry } from "@/lib/exam-component-registry";
import { ExamFieldMapper } from "@/lib/exam-field-mappings";

describe("exam card extension contract", () => {
  test("uses centralized NPC and Cover Test constraints", () => {
    expect(EXAM_FIELDS.NPC_DISTANCE).toMatchObject({
      min: 0,
      max: 99,
      step: "0.5",
      suffix: "cm",
    });
    expect(EXAM_FIELDS.COVER_TEST_PRISM).toMatchObject({
      min: 0,
      max: 99,
      step: "0.5",
      suffix: "Δ",
    });
    expect(EXAM_FIELDS.NPC_RESULT.options).toEqual([
      "OS Out",
      "OD Out",
      "OU Out",
      "None",
    ]);
  });

  test("offers only the replacement Cover Test in the layout editor", () => {
    const layoutTypes = examComponentRegistry.getLayoutEditorTypes();

    expect(layoutTypes).toContain("npc");
    expect(layoutTypes).toContain("cover-test-v2");
    expect(layoutTypes).not.toContain("cover-test");
  });

  test("clears all persisted replacement Cover Test fields", () => {
    expect(
      ExamFieldMapper.clearData(
        {
          cc_far_horizontal_prism: 8,
          cc_far_horizontal_deviation: "Esotropia",
          sc_near_vertical_prism: 2,
          sc_near_vertical_deviation: "Hyperphoria",
        },
        "cover-test-v2",
      ),
    ).toMatchObject({
      cc_far_horizontal_prism: "",
      cc_far_horizontal_deviation: "",
      sc_near_vertical_prism: "",
      sc_near_vertical_deviation: "",
    });
  });

  test("gives both cards stable layout widths", () => {
    expect(getColumnCount("npc", "detail")).toBe(7);
    expect(getColumnCount("cover-test-v2", "detail")).toBe(8);
  });
});
