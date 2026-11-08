import { describe, expect, test } from "vitest";
import { examContentZoom } from "@/hooks/exam/useExamContentZoom";

describe("exam content zoom", () => {
  test("keeps laptop widths as they are and scales wider screens up to a limit", () => {
    expect(examContentZoom(1100)).toBe(1);
    expect(examContentZoom(1400)).toBe(1);
    expect(examContentZoom(1640)).toBe(1.17);
    expect(examContentZoom(4000)).toBe(1.6);
  });
});
