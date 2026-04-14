export function buildTableSearch<T extends Record<string, unknown>>(
  values: T,
  defaults: Partial<T> = {},
): Partial<T> {
  return Object.fromEntries(
    Object.entries(values).filter(([key, value]) => {
      if (value === undefined || value === null) return false
      if (typeof value === "string" && value.length === 0) return false
      return defaults[key as keyof T] !== value
    }),
  ) as Partial<T>
}
