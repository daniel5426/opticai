import { describe, expect, test } from "vitest";
import {
  MAX_HOUR_HEIGHT,
  MIN_HOUR_HEIGHT,
  hourHeightForDrag,
} from "@/pages/HomePage/calendar-zoom";

describe("calendar hour zoom", () => {
  test("the grabbed point follows the pointer", () => {
    // Grabbed 2 hours down at 95px/hour; dragging 95px down adds half an hour per hour.
    expect(hourHeightForDrag(95, 190, 95)).toBe(143);
    expect(hourHeightForDrag(95, 190, -95)).toBe(MIN_HOUR_HEIGHT);
  });

  test("grabbing near the top does not jump", () => {
    expect(hourHeightForDrag(95, 5, 10)).toBe(105);
  });

  test("stays within limits", () => {
    expect(hourHeightForDrag(95, 190, 5000)).toBe(MAX_HOUR_HEIGHT);
  });
});
