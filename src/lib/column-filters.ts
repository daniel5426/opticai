export type ColumnFilterKind = "text" | "options" | "date"

export interface ColumnFilterOption {
  value: string
  label: string
}

export interface DateRangeFilter {
  from?: string
  to?: string
}

export type ColumnFilterValue = string | string[] | DateRangeFilter
export type ColumnFilters = Record<string, ColumnFilterValue>

export interface ColumnFilterDefinition<Row = unknown> {
  key: string
  label: string
  kind: ColumnFilterKind
  options?: readonly ColumnFilterOption[]
  /** Reads the row value for client-side filtering (tables that hold every row in memory). */
  getValue?: (row: Row) => unknown
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function isActiveColumnFilter(value: ColumnFilterValue | undefined): boolean {
  if (value === undefined) return false
  if (typeof value === "string") return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return Boolean(value.from || value.to)
}

function cleanValue(value: unknown): ColumnFilterValue | undefined {
  if (typeof value === "string") return value.trim() ? value : undefined
  if (Array.isArray(value)) {
    const options = value.filter((item): item is string => typeof item === "string" && item.length > 0)
    return options.length ? Array.from(new Set(options)) : undefined
  }
  if (value && typeof value === "object") {
    const { from, to } = value as Record<string, unknown>
    const range: DateRangeFilter = {}
    if (typeof from === "string" && ISO_DATE.test(from)) range.from = from
    if (typeof to === "string" && ISO_DATE.test(to)) range.to = to
    return range.from || range.to ? range : undefined
  }
  return undefined
}

export function cleanColumnFilters(filters: Record<string, unknown>): ColumnFilters {
  const cleaned: ColumnFilters = {}
  for (const key of Object.keys(filters).sort()) {
    const value = cleanValue(filters[key])
    if (value !== undefined) cleaned[key] = value
  }
  return cleaned
}

export function hasColumnFilters(filters: ColumnFilters): boolean {
  return Object.values(filters).some(isActiveColumnFilter)
}

/** Canonical form for URLs and API params: "" when nothing is filtered. */
export function serializeColumnFilters(filters: ColumnFilters): string {
  const cleaned = cleanColumnFilters(filters)
  return Object.keys(cleaned).length ? JSON.stringify(cleaned) : ""
}

/** Accepts the raw URL value, which the router may hand over as a string or an already-parsed object. */
export function parseColumnFilters(raw: unknown): ColumnFilters {
  let value = raw
  if (typeof raw === "string") {
    if (!raw) return {}
    try {
      value = JSON.parse(raw)
    } catch {
      return {}
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return cleanColumnFilters(value as Record<string, unknown>)
}

export function normalizeColumnFiltersParam(raw: unknown): string {
  return serializeColumnFilters(parseColumnFilters(raw))
}

export function setColumnFilter(filters: ColumnFilters, key: string, value: ColumnFilterValue | undefined): ColumnFilters {
  const next: Record<string, unknown> = { ...filters }
  if (value === undefined) delete next[key]
  else next[key] = value
  return cleanColumnFilters(next)
}

function toIsoDate(value: unknown): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10)
  if (typeof value !== "string" || value.length < 10) return null
  const day = value.slice(0, 10)
  return ISO_DATE.test(day) ? day : null
}

export function matchesColumnFilters<Row>(
  row: Row,
  filters: ColumnFilters,
  definitions: readonly ColumnFilterDefinition<Row>[],
): boolean {
  for (const definition of definitions) {
    const filter = filters[definition.key]
    if (!isActiveColumnFilter(filter) || !definition.getValue) continue
    const value = definition.getValue(row)

    if (definition.kind === "text" && typeof filter === "string") {
      if (!String(value ?? "").toLowerCase().includes(filter.trim().toLowerCase())) return false
    } else if (definition.kind === "options" && Array.isArray(filter)) {
      if (!filter.includes(String(value ?? ""))) return false
    } else if (definition.kind === "date" && filter && typeof filter === "object" && !Array.isArray(filter)) {
      const day = toIsoDate(value)
      if (!day) return false
      const [from, to] = filter.from && filter.to && filter.from > filter.to ? [filter.to, filter.from] : [filter.from, filter.to]
      if (from && day < from) return false
      if (to && day > to) return false
    }
  }
  return true
}

/** Human-readable summary of one active filter, for chips and accessible labels. */
export function describeColumnFilter(
  definition: Pick<ColumnFilterDefinition, "kind" | "options">,
  value: ColumnFilterValue,
  formatDate: (isoDate: string) => string = (isoDate) => isoDate,
): string {
  if (typeof value === "string") return value.trim()
  if (Array.isArray(value)) {
    return value.map((item) => definition.options?.find((option) => option.value === item)?.label ?? item).join(", ")
  }
  const from = value.from ? formatDate(value.from) : ""
  const to = value.to ? formatDate(value.to) : ""
  if (from && to) return from === to ? from : `${from} – ${to}`
  return from ? `≥ ${from}` : `≤ ${to}`
}
