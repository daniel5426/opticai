import { expect, test } from "vitest";
import { GLASSES_TYPES } from "@/components/exam/data/exam-constants";
import { ORDER_GLASSES_TYPES, ORDER_GLASSES_TYPE_LABELS, isAdditionAddType, normalizeOrderGlassesType } from "@/lib/addition-add-sources";

test("orders name glasses types like Old Refraction, with Far and My Slow", () => {
  expect(ORDER_GLASSES_TYPES.map((type) => ORDER_GLASSES_TYPE_LABELS[type])).toEqual(["רחוק", "קרוב", "ביניים", "מולטיפוקל", "ביפוקל", "My Slow"]);
  expect(GLASSES_TYPES).toContain("My Slow");
  expect(normalizeOrderGlassesType("READ")).toBe("read");
  expect(normalizeOrderGlassesType("my_slow")).toBe("my_slow");
  expect(normalizeOrderGlassesType("other")).toBeUndefined();
  // Only the addition types carry an ADD.
  expect(ORDER_GLASSES_TYPES.filter(isAdditionAddType)).toEqual(["read", "int", "mul", "bif"]);
});
