import { useCallback, useEffect, useRef } from "react"

export const TABLE_SEARCH_DEBOUNCE_MS = 300

function normalizeTableSearch(value: string | undefined) {
  return (value || "").trim()
}

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

export function useLatestTableSearchRequest(searchInput: string) {
  const latestSearchRef = useRef(normalizeTableSearch(searchInput))
  const requestIdRef = useRef(0)

  const updateLatestSearch = useCallback((value: string | undefined) => {
    latestSearchRef.current = normalizeTableSearch(value)
  }, [])

  useEffect(() => {
    updateLatestSearch(searchInput)
  }, [searchInput, updateLatestSearch])

  const startSearchRequest = useCallback((requestSearch: string | undefined) => {
    const requestId = ++requestIdRef.current
    const requestQuery = normalizeTableSearch(requestSearch)

    return () =>
      requestId === requestIdRef.current &&
      latestSearchRef.current === requestQuery
  }, [])

  return { startSearchRequest, updateLatestSearch }
}
