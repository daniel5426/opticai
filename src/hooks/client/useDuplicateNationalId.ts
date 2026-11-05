import React from "react"
import { useQuery } from "@tanstack/react-query"
import { getPaginatedClients } from "@/lib/db/clients-db"
import type { Client } from "@/lib/db/schema-interface"

/** IDs are compared as digits without leading zeros, so "022153451" and "22153451" match. */
export const normalizeNationalId = (value?: string | null) => (value ?? "").replace(/\D/g, "").replace(/^0+/, "")

const MIN_DIGITS = 5
const DEBOUNCE_MS = 400

/**
 * Another client in the clinic with this national ID, checked while the ID is typed.
 * `excludeClientId` leaves out the client being edited.
 */
export function useDuplicateNationalId(
  nationalId: string | null | undefined,
  clinicId: number | undefined,
  { enabled = true, excludeClientId }: { enabled?: boolean; excludeClientId?: number } = {},
): Client | null {
  const normalized = normalizeNationalId(nationalId)
  const [debounced, setDebounced] = React.useState(normalized)
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(normalized), DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [normalized])

  const { data } = useQuery({
    queryKey: ["clients", "national-id", clinicId, debounced, excludeClientId],
    // Normalize and match on the server before pagination.
    queryFn: () =>
      getPaginatedClients(clinicId, {
        limit: 1,
        offset: 0,
        order: "id_desc",
        nationalIdExact: debounced,
        excludeClientId,
        includeTotal: false,
      }),
    enabled: enabled && Boolean(clinicId) && debounced.length >= MIN_DIGITS,
    staleTime: 30_000,
  })

  if (!enabled || normalized.length < MIN_DIGITS || normalized !== debounced) return null
  return data?.items.find((client) => client.id !== excludeClientId && normalizeNationalId(client.national_id) === normalized) ?? null
}
