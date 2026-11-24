import { expect, test } from "vitest";
import { examCardDropFit, type GridLayoutItem } from "@/pages/exam-detail/utils";

const card = (id: string, x: number, w: number, y = 0) => ({ id, type: "notes", x, y, w }) as GridLayoutItem;
const dragged = card("a", 0, 8, 1);

test("a card fits where it lands, also when it snaps beside a neighbor", () => {
  expect(examCardDropFit(dragged, 0, 10, 10, [dragged], 24)).toBe("fits");
  expect(examCardDropFit(dragged, 0, 10, 12, [dragged, card("b", 4, 8)], 24)).toBe("fits");
  // Held past the row's end, it lands against it.
  expect(examCardDropFit(dragged, 0, 40, 16, [dragged], 24)).toBe("fits");
});

test("over another card it is blocked while the row still has room elsewhere", () => {
  expect(examCardDropFit(dragged, 0, 2, null, [dragged, card("b", 0, 8)], 24)).toBe("blocked");
  // It would land far from where it is held.
  expect(examCardDropFit(card("a", 12, 8), 0, 0, 8, [card("a", 12, 8), card("b", 0, 8)], 24)).toBe("blocked");
});

test("a row with no wide enough gap is full", () => {
  expect(examCardDropFit(dragged, 0, 8, null, [dragged, card("b", 4, 8), card("c", 18, 4)], 24)).toBe("row-full");
});
