import { describe, expect, test } from "vitest";
import { hasOptionalEyeField } from "@/components/exam/shared/optionalExamColumns";

describe("hasOptionalEyeField", () => {
  test("is false when both eyes are empty", () => {
    expect(hasOptionalEyeField({ r_ph: "", l_ph: null }, "ph")).toBe(false);
    expect(hasOptionalEyeField({}, "j")).toBe(false);
  });

  test("is true when either eye has a value", () => {
    expect(hasOptionalEyeField({ r_ph: "6/99" }, "ph")).toBe(true);
    expect(hasOptionalEyeField({ l_j: "J4" }, "j")).toBe(true);
  });
});
