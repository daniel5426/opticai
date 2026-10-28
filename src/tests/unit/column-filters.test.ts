import { describe, expect, it } from "vitest"

import {
  describeColumnFilter,
  hasColumnFilters,
  matchesColumnFilters,
  normalizeColumnFiltersParam,
  parseColumnFilters,
  serializeColumnFilters,
  setColumnFilter,
  type ColumnFilterDefinition,
} from "@/lib/column-filters"

type Row = { name?: string | null; status: string; date?: string | null }

const definitions: ColumnFilterDefinition<Row>[] = [
  { key: "name", label: "Name", kind: "text", getValue: (row) => row.name },
  {
    key: "status",
    label: "Status",
    kind: "options",
    options: [{ value: "active", label: "פעיל" }, { value: "closed", label: "סגור" }],
    getValue: (row) => row.status,
  },
  { key: "date", label: "Date", kind: "date", getValue: (row) => row.date },
]

const rows: Row[] = [
  { name: "Dana Cohen", status: "active", date: "2026-01-01" },
  { name: "Avi Levi", status: "closed", date: "2026-01-15T10:00:00" },
  { name: null, status: "pending", date: null },
]

const match = (filters: Parameters<typeof matchesColumnFilters>[1]) =>
  rows.filter((row) => matchesColumnFilters(row, filters, definitions)).map((row) => row.name)

describe("column filters", () => {
  it("serializes to a canonical, order-independent string and drops empty values", () => {
    expect(serializeColumnFilters({})).toBe("")
    expect(serializeColumnFilters({ name: "  ", status: [], date: {} })).toBe("")
    expect(serializeColumnFilters({ status: ["a"], name: "x" })).toBe(serializeColumnFilters({ name: "x", status: ["a"] }))
  })

  it("parses strings or router-parsed objects and ignores malformed values", () => {
    expect(parseColumnFilters('{"name":"x"}')).toEqual({ name: "x" })
    expect(parseColumnFilters({ name: "x" })).toEqual({ name: "x" })
    expect(parseColumnFilters("not json")).toEqual({})
    expect(parseColumnFilters(["x"])).toEqual({})
    expect(parseColumnFilters({ date: { from: "01/01/2026" }, status: [1, "a", "a"] })).toEqual({ status: ["a"] })
    expect(normalizeColumnFiltersParam({ name: "x" })).toBe('{"name":"x"}')
  })

  it("sets and clears one column without touching the others", () => {
    const filters = setColumnFilter({ name: "x" }, "status", ["active"])
    expect(filters).toEqual({ name: "x", status: ["active"] })
    expect(setColumnFilter(filters, "name", undefined)).toEqual({ status: ["active"] })
    expect(setColumnFilter(filters, "status", [])).toEqual({ name: "x" })
    expect(hasColumnFilters({})).toBe(false)
    expect(hasColumnFilters(filters)).toBe(true)
  })

  it("filters rows in memory by text, options and inclusive date range", () => {
    expect(match({ name: "cohen" })).toEqual(["Dana Cohen"])
    expect(match({ status: ["active", "closed"] })).toEqual(["Dana Cohen", "Avi Levi"])
    expect(match({ date: { from: "2026-01-02", to: "2026-01-15" } })).toEqual(["Avi Levi"])
    expect(match({ date: { to: "2026-01-01" } })).toEqual(["Dana Cohen"])
    expect(match({ name: "a", status: ["closed"] })).toEqual(["Avi Levi"])
  })

  it("describes active filters with option labels and date ranges", () => {
    expect(describeColumnFilter(definitions[1], ["active", "closed"])).toBe("פעיל, סגור")
    expect(describeColumnFilter(definitions[2], { from: "2026-01-01", to: "2026-01-31" })).toBe("2026-01-01 – 2026-01-31")
    expect(describeColumnFilter(definitions[2], { from: "2026-01-01" })).toBe("≥ 2026-01-01")
  })
})
