import { describe, expect, it } from "vitest"

import { compareValues, sortRows, toggleSort } from "@/lib/table-sorting"

describe("table sorting", () => {
  it("toggles one active column between asc and desc", () => {
    expect(toggleSort(undefined, "name")).toEqual({ key: "name", direction: "asc" })
    expect(toggleSort({ key: "name", direction: "asc" }, "name")).toEqual({ key: "name", direction: "desc" })
    expect(toggleSort({ key: "name", direction: "desc" }, "id")).toEqual({ key: "id", direction: "asc" })
  })

  it("sorts Hebrew/text values with numeric awareness", () => {
    const rows = [{ name: "בדיקה 10" }, { name: "בדיקה 2" }, { name: "אברהם" }]

    expect(sortRows(rows, { key: "name", direction: "asc" }, {
      name: { getValue: (row) => row.name },
    }).map((row) => row.name)).toEqual(["אברהם", "בדיקה 2", "בדיקה 10"])
  })

  it("sorts numbers and dates", () => {
    expect(compareValues(2, 10, { type: "number" })).toBeLessThan(0)
    expect(compareValues("2025-01-01", "2024-01-01", { type: "date" })).toBeGreaterThan(0)
  })

  it("keeps empty values last in ascending comparisons", () => {
    expect(compareValues("", "abc")).toBeGreaterThan(0)
    expect(compareValues(undefined, "2025-01-01", { type: "date" })).toBeGreaterThan(0)
  })

  it("keeps empty values last when sorting descending", () => {
    const rows = [{ value: "" }, { value: "b" }, { value: "a" }]

    expect(sortRows(rows, { key: "value", direction: "desc" }, {
      value: { getValue: (row) => row.value },
    }).map((row) => row.value)).toEqual(["b", "a", ""])
  })

  it("sorts booleans and custom enum ranks", () => {
    expect(compareValues(false, true, { type: "boolean" })).toBeLessThan(0)
    expect(compareValues("urgent", "routine", { type: "rank", rank: ["routine", "urgent"] })).toBeGreaterThan(0)
  })
})
