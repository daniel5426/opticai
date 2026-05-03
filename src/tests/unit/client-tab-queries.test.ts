import { QueryClient } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  clientQueryKeys,
  removeQueryItemById,
  replaceQueryItemById,
  restoreQueryData,
  upsertQueryItemById,
} from "@/hooks/client/useClientTabQueries"
import {
  syncSavedClientExam,
  syncSavedClientOrder,
} from "@/hooks/client/clientTabCache"
import { getClientOrdersContext } from "@/lib/db/orders-db"
import { apiClient } from "@/lib/api-client"

describe("client tab query keys", () => {
  it("uses stable client tab query keys", () => {
    expect(clientQueryKeys.client(12)).toEqual(["client", 12])
    expect(clientQueryKeys.exams(12, "exam")).toEqual(["client", 12, "exams", "exam"])
    expect(clientQueryKeys.orders(12)).toEqual(["client", 12, "orders"])
    expect(clientQueryKeys.ordersContext(12)).toEqual(["client", 12, "orders-context"])
    expect(clientQueryKeys.medicalLogs(12)).toEqual(["client", 12, "medical-logs"])
    expect(clientQueryKeys.referrals(12)).toEqual(["client", 12, "referrals"])
    expect(clientQueryKeys.appointments(12)).toEqual(["client", 12, "appointments"])
    expect(clientQueryKeys.files(12)).toEqual(["client", 12, "files"])
    expect(clientQueryKeys.users()).toEqual(["users", "all"])
    expect(clientQueryKeys.users(4)).toEqual(["users", 4])
  })
})

describe("orders context API", () => {
  beforeEach(() => {
    Object.assign(apiClient, { getClientOrdersContext: vi.fn() })
  })

  it("returns the backend orders context payload", async () => {
    const payload = {
      latest_exam_id: 1,
      latest_regular_order_id: 2,
      latest_contact_order_id: 3,
      latest_exam_add_sources: { read: { r_ad: 1.25 } },
    }
    const getClientOrdersContextMock = apiClient.getClientOrdersContext as any
    getClientOrdersContextMock.mockResolvedValue({ data: payload })

    await expect(getClientOrdersContext(9)).resolves.toEqual(payload)
    expect(apiClient.getClientOrdersContext).toHaveBeenCalledWith(9)
  })

  it("falls back to an empty orders context on API error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const getClientOrdersContextMock = apiClient.getClientOrdersContext as any
    getClientOrdersContextMock.mockResolvedValue({ error: "nope" })

    await expect(getClientOrdersContext(9)).resolves.toEqual({
      latest_exam_id: null,
      latest_regular_order_id: null,
      latest_contact_order_id: null,
      latest_exam_add_sources: {},
    })
    consoleError.mockRestore()
  })
})

describe("client tab optimistic cache helpers", () => {
  it("removes and restores deleted rows", () => {
    const queryClient = new QueryClient()
    const queryKey = clientQueryKeys.orders(8)
    const previous = [{ id: 1, client_id: 8 }, { id: 2, client_id: 8 }]
    queryClient.setQueryData(queryKey, previous)

    queryClient.setQueryData(queryKey, (current) => removeQueryItemById(current as typeof previous, 1))
    expect(queryClient.getQueryData(queryKey)).toEqual([{ id: 2, client_id: 8 }])

    restoreQueryData(queryClient, queryKey, previous)
    expect(queryClient.getQueryData(queryKey)).toEqual(previous)
  })

  it("replaces and restores status updates", () => {
    const queryClient = new QueryClient()
    const queryKey = clientQueryKeys.orders(8)
    const previous = [{ id: 1, client_id: 8, order_status: "open" }]
    queryClient.setQueryData(queryKey, previous)

    queryClient.setQueryData(queryKey, (current) =>
      replaceQueryItemById(current as typeof previous, { ...previous[0], order_status: "closed" }),
    )
    expect(queryClient.getQueryData(queryKey)).toEqual([{ id: 1, client_id: 8, order_status: "closed" }])

    restoreQueryData(queryClient, queryKey, previous)
    expect(queryClient.getQueryData(queryKey)).toEqual(previous)
  })

  it("upserts new rows at the top and replaces existing rows", () => {
    expect(upsertQueryItemById([{ id: 1, name: "old" }], { id: 2, name: "new" })).toEqual([
      { id: 2, name: "new" },
      { id: 1, name: "old" },
    ])
    expect(upsertQueryItemById([{ id: 1, name: "old" }], { id: 1, name: "new" })).toEqual([
      { id: 1, name: "new" },
    ])
  })

  it("updates an existing orders cache and invalidates dependent order queries", async () => {
    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")
    const queryKey = clientQueryKeys.orders(8)
    queryClient.setQueryData(queryKey, [
      { id: 1, client_id: 8, order_date: "2026-01-01", type: "old" },
      { id: 2, client_id: 8, order_date: "2026-01-03", type: "latest" },
    ])

    syncSavedClientOrder(queryClient, {
      id: 1,
      client_id: 8,
      order_date: "2026-01-04",
      type: "updated",
    } as any)

    expect(queryClient.getQueryData(queryKey)).toEqual([
      { id: 1, client_id: 8, order_date: "2026-01-04", type: "updated" },
      { id: 2, client_id: 8, order_date: "2026-01-03", type: "latest" },
    ])
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: clientQueryKeys.ordersContext(8),
    })
  })

  it("does not create a partial orders cache when the list was never loaded", () => {
    const queryClient = new QueryClient()
    const queryKey = clientQueryKeys.orders(8)

    syncSavedClientOrder(queryClient, {
      id: 1,
      client_id: 8,
      order_date: "2026-01-04",
      type: "new",
    } as any)

    expect(queryClient.getQueryData(queryKey)).toBeUndefined()
  })

  it("invalidates exam list and orders context after saved exams", () => {
    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")
    const queryKey = clientQueryKeys.exams(8, "exam")
    queryClient.setQueryData(queryKey, [
      { id: 1, client_id: 8, exam_date: "2026-01-01", test_name: "old" },
    ])

    syncSavedClientExam(queryClient, {
      id: 2,
      client_id: 8,
      exam_date: "2026-01-03",
      test_name: "new",
    } as any, "exam")

    expect(queryClient.getQueryData(queryKey)).toEqual([
      { id: 2, client_id: 8, exam_date: "2026-01-03", test_name: "new" },
      { id: 1, client_id: 8, exam_date: "2026-01-01", test_name: "old" },
    ])
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: clientQueryKeys.ordersContext(8),
    })
  })
})
