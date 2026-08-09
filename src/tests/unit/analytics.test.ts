import { describe, expect, it } from "vitest";

import {
  analyticsBucketForRange,
  analyticsChangeLabel,
  analyticsTrendTone,
  normalizeAnalyticsRange,
  previousAnalyticsRange,
} from "@/lib/analytics";

describe("analytics ranges", () => {
  it("uses inclusive adaptive buckets", () => {
    expect(analyticsBucketForRange("2026-07-01", "2026-08-14")).toBe("day");
    expect(analyticsBucketForRange("2026-03-01", "2026-08-27")).toBe("week");
    expect(analyticsBucketForRange("2025-08-01", "2026-08-01")).toBe("month");
  });

  it("calculates an immediately preceding equal-length period", () => {
    expect(
      previousAnalyticsRange({
        preset: "custom",
        startDate: "2026-08-01",
        endDate: "2026-08-07",
        bucket: "day",
      }),
    ).toEqual({ startDate: "2026-07-25", endDate: "2026-07-31" });
  });

  it("rejects invalid custom ranges", () => {
    expect(normalizeAnalyticsRange("custom", "2026-08-10", "2026-08-01", "30d").preset).toBe("30d");
  });
});

describe("analytics comparisons", () => {
  it("labels a non-zero value after zero as new", () => {
    expect(analyticsChangeLabel(5, 0, null)).toBe("חדש");
  });

  it("honors lower-is-better polarity", () => {
    expect(analyticsTrendTone(4, 8, "lower")).toBe("positive");
    expect(analyticsTrendTone(10, 8, "lower")).toBe("negative");
  });
});
