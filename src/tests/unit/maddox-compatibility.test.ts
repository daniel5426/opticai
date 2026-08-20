import { describe, expect, test } from "vitest";
import {
  normalizeMaddoxDirection,
  normalizeMaddoxRodExam,
  normalizeMaddoxRodExamData,
} from "@/lib/maddox-compatibility";

describe("Maddox rod compatibility", () => {
  test("expands truncated SoftOptic directions", () => {
    expect(normalizeMaddoxDirection("X", "horizontal")).toBe("EXO");
    expect(normalizeMaddoxDirection("E", "horizontal")).toBe("ESO");
    expect(normalizeMaddoxDirection("R", "vertical")).toBe("R/L");
    expect(normalizeMaddoxDirection("L", "vertical")).toBe("L/R");
    expect(normalizeMaddoxDirection("EXO", "horizontal")).toBe("EXO");
    expect(normalizeMaddoxDirection("R/L", "vertical")).toBe("R/L");
  });

  test("upgrades legacy per-eye values into the v2 card", () => {
    expect(
      normalizeMaddoxRodExam({
        layout_instance_id: 4,
        c_r_h: 1,
        c_l_h: 1,
        wc_r_h: 2,
        c_r_v: 0.5,
      }),
    ).toEqual({
      layout_instance_id: 4,
      schema_version: 2,
      with_horizontal_prism: 1,
      with_horizontal_direction: undefined,
      with_vertical_prism: 0.5,
      with_vertical_direction: undefined,
      without_horizontal_prism: 2,
      without_horizontal_direction: undefined,
      without_vertical_prism: undefined,
      without_vertical_direction: undefined,
    });
  });

  test("normalizes maddox payloads inside exam json", () => {
    const next = normalizeMaddoxRodExamData({
      "maddox-rod-maddox-rod-1": {
        with_horizontal_direction: "X",
        with_vertical_direction: "R",
      },
      notes: { note: "keep" },
    });

    expect(next["maddox-rod-maddox-rod-1"]).toMatchObject({
      schema_version: 2,
      with_horizontal_direction: "EXO",
      with_vertical_direction: "R/L",
    });
    expect(next.notes).toEqual({ note: "keep" });
  });
});
