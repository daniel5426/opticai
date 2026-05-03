import { describe, expect, it } from "vitest"

import { DateSearchHelper } from "@/lib/date-search-helper"

describe("DateSearchHelper", () => {
  it("matches ISO dates", () => {
    expect(DateSearchHelper.matchesDate("2026-05-04", "2026-05-04")).toBe(true)
  })

  it("matches Israeli DD/MM/YYYY dates", () => {
    expect(DateSearchHelper.matchesDate("04/05/2026", "2026-05-04")).toBe(true)
    expect(DateSearchHelper.matchesDate("4.5.2026", "2026-05-04")).toBe(true)
  })

  it("matches English US MM/DD/YYYY dates", () => {
    expect(DateSearchHelper.matchesDate("05/04/2026", "2026-05-04")).toBe(true)
  })

  it("matches two-digit years", () => {
    expect(DateSearchHelper.matchesDate("04/05/26", "2026-05-04")).toBe(true)
  })

  it("does not treat the first day of a month as a whole-month search", () => {
    expect(DateSearchHelper.matchesDate("01/05/2026", "2026-05-12")).toBe(false)
  })
})
