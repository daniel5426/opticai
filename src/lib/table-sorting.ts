export type SortDirection = "asc" | "desc"

export type SortState = {
  key: string
  direction: SortDirection
}

export type SortValue = string | number | boolean | Date | null | undefined

export type SortColumn<T> = {
  getValue: (row: T) => SortValue
  type?: "text" | "number" | "date" | "boolean" | "rank"
  rank?: readonly string[] | Record<string, number>
}

export type SortColumns<T> = Record<string, SortColumn<T>>

export function toggleSort(current: SortState | undefined, key: string): SortState {
  if (!current || current.key !== key) {
    return { key, direction: "asc" }
  }

  return { key, direction: current.direction === "asc" ? "desc" : "asc" }
}

function isEmpty(value: SortValue) {
  return value === null || value === undefined || value === ""
}

function toTime(value: SortValue) {
  if (value instanceof Date) return value.getTime()
  if (typeof value === "number") return value
  if (typeof value !== "string") return Number.NaN
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : Number.NaN
}

function toNumber(value: SortValue) {
  if (typeof value === "number") return value
  if (typeof value === "boolean") return value ? 1 : 0
  if (typeof value !== "string") return Number.NaN
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function rankValue(value: SortValue, rank: SortColumn<unknown>["rank"]) {
  const key = String(value ?? "")
  if (Array.isArray(rank)) {
    const index = rank.indexOf(key)
    return index === -1 ? rank.length : index
  }
  return rank?.[key] ?? Number.MAX_SAFE_INTEGER
}

export function compareValues(
  left: SortValue,
  right: SortValue,
  column: Omit<SortColumn<unknown>, "getValue"> = {},
) {
  const leftEmpty = isEmpty(left)
  const rightEmpty = isEmpty(right)

  if (leftEmpty && rightEmpty) return 0
  if (leftEmpty) return 1
  if (rightEmpty) return -1

  if (column.type === "number") {
    const leftNumber = toNumber(left)
    const rightNumber = toNumber(right)
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      return leftNumber - rightNumber
    }
  }

  if (column.type === "date") {
    const leftTime = toTime(left)
    const rightTime = toTime(right)
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
      return leftTime - rightTime
    }
  }

  if (column.type === "boolean") {
    return Number(Boolean(left)) - Number(Boolean(right))
  }

  if (column.type === "rank") {
    return rankValue(left, column.rank) - rankValue(right, column.rank)
  }

  return String(left).localeCompare(String(right), "he", {
    numeric: true,
    sensitivity: "base",
  })
}

export function sortRows<T>(
  rows: readonly T[],
  sort: SortState | undefined,
  columns: SortColumns<T>,
) {
  if (!sort) return [...rows]

  const column = columns[sort.key]
  if (!column) return [...rows]

  return [...rows].sort((left, right) => {
    const leftValue = column.getValue(left)
    const rightValue = column.getValue(right)
    const leftEmpty = isEmpty(leftValue)
    const rightEmpty = isEmpty(rightValue)

    if (leftEmpty && rightEmpty) return 0
    if (leftEmpty) return 1
    if (rightEmpty) return -1

    const result = compareValues(leftValue, rightValue, column)
    return sort.direction === "asc" ? result : -result
  })
}

export function sortToOrder(sort: SortState | undefined, fallback: string) {
  return sort ? `${sort.key}_${sort.direction}` : fallback
}

export function sortToSearch(sort: SortState) {
  return `${sort.key}_${sort.direction}`
}

export function parseSortSearch(value: string | undefined, fallback: SortState): SortState {
  if (!value) return fallback
  const match = value.match(/^(.+)_(asc|desc)$/)
  if (!match) return fallback
  return { key: match[1], direction: match[2] as SortDirection }
}
