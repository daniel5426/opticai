import { describe, expect, test } from "vitest";
import {
  componentHasMiddleRow,
  getColumnCount,
} from "@/components/exam/ExamCardRenderer";
import { EXAM_FIELDS } from "@/components/exam/data/exam-field-definitions";
import { examComponentRegistry } from "@/lib/exam-component-registry";
import { ExamFieldMapper } from "@/lib/exam-field-mappings";
import { computeCardMinGridCols } from "@/pages/exam-detail/utils";

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
    expect(layoutTypes).toContain("maddox-rod");
    expect(layoutTypes).toContain("maddox-wing");
    expect(layoutTypes).toContain("rg-balance");
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

  test("clears all persisted Maddox v2 fields", () => {
    expect(
      ExamFieldMapper.clearData(
        {
          schema_version: 2,
          with_horizontal_prism: 2,
          with_horizontal_direction: "EXO",
          with_vertical_direction: "R/L",
        },
        "maddox-rod",
      ),
    ).toMatchObject({
      with_horizontal_prism: "",
      with_horizontal_direction: "",
      with_vertical_direction: "",
    });
  });

  test("gives both cards stable layout widths", () => {
    expect(getColumnCount("npc", "detail")).toBe(7);
    expect(getColumnCount("cover-test-v2", "detail")).toBe(8);
    expect(getColumnCount("keratometer", "detail")).toBe(4);
    expect(getColumnCount("keratometer-contact-lens", "detail")).toBe(7);
    expect(getColumnCount("contact-lens-exam", "detail")).toBe(11);
    expect(getColumnCount("maddox-rod", "detail")).toBe(7);
    expect(getColumnCount("maddox-wing", "detail")).toBe(4);
    expect(getColumnCount("rg-balance", "detail")).toBe(5);
    expect(getColumnCount("retinoscop", "detail")).toBe(7);
    expect(computeCardMinGridCols("keratometer")).toBe(8);
    expect(computeCardMinGridCols("keratometer-contact-lens")).toBe(11);
    expect(computeCardMinGridCols("contact-lens-exam")).toBe(17);
    expect(computeCardMinGridCols("maddox-rod")).toBe(11);
    expect(computeCardMinGridCols("maddox-wing")).toBe(6);
    expect(computeCardMinGridCols("rg-balance")).toBe(8);
    expect(computeCardMinGridCols("retinoscop")).toBe(11);
    expect(componentHasMiddleRow("retinoscop")).toBe(true);
    expect(componentHasMiddleRow("contact-lens-exam")).toBe(true);
    expect(componentHasMiddleRow("maddox-wing")).toBe(true);
    expect(componentHasMiddleRow("maddox-rod")).toBe(false);
    expect(componentHasMiddleRow("rg-balance")).toBe(false);
  });
});
