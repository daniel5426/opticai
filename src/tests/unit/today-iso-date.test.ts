import { describe, expect, it } from "vitest"
import { todayIsoDate } from "@/lib/iso-date"

describe("todayIsoDate", () => {
  it("uses the Israel date, even when UTC is still on the previous day", () => {
    expect(todayIsoDate(new Date("2026-11-15T23:30:00Z"))).toBe("2026-11-16")
    expect(todayIsoDate(new Date("2026-07-15T21:30:00Z"))).toBe("2026-07-16")
    expect(todayIsoDate(new Date("2026-11-16T12:00:00Z"))).toBe("2026-11-16")
  })
})
