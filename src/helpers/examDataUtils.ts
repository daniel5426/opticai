export const sortKeysDeep = (value: any): any => {
  if (Array.isArray(value)) {
    return value
      .map(sortKeysDeep)
      .filter((item) => item !== undefined)
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.keys(value)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .reduce((acc, key) => {
        const child = sortKeysDeep(value[key])
        if (child !== undefined) {
          acc[key] = child
        }
        return acc
      }, {} as Record<string, any>)
  }
  if (value === null) return null
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed === "" ? undefined : trimmed
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  return value
}

export const shallowEqual = (a: any, b: any) => {
  if (a === b) return true
  if (!a || !b) return false
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  for (const k of aKeys) {
    if (a[k] !== b[k]) return false
  }
  return true
}

export const normalizeFieldValue = (previous: any, rawValue: string) => {
  const trimmed = typeof rawValue === "string" ? rawValue.trim() : rawValue
  if (trimmed === "") {
    if (previous === null) return null
    return undefined
  }
  if (typeof previous === "number") {
    const normalizedNumber = Number(String(trimmed).replace(",", "."))
    return Number.isFinite(normalizedNumber) ? normalizedNumber : rawValue
  }
  if (typeof previous === "boolean") {
    if (trimmed === "true" || trimmed === "1") return true
    if (trimmed === "false" || trimmed === "0") return false
    return rawValue
  }
  return trimmed
}

