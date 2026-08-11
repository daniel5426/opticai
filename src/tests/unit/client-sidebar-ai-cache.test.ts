import { describe, expect, test } from "vitest"
import { mergeAiPartCache } from "@/components/ClientSidebar"

describe("mergeAiPartCache", () => {
  test("preserves the current cache object when a response has no changes", () => {
    const previous = { exam: "summary", orders: null }

    expect(mergeAiPartCache(previous, { exam: "summary", orders: null })).toBe(previous)
  })

  test("returns a new cache only when a part has changed", () => {
    const previous = { exam: "old summary", orders: null }

    expect(mergeAiPartCache(previous, { exam: "new summary" })).toEqual({
      exam: "new summary",
      orders: null,
    })
  })
})
