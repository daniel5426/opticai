import React from "react"
import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ClientHistoryClinicContext, useCompanyClinicFilter } from "@/hooks/client/useCompanyClinicFilter"
import { clientQueryKeys, useClientExamsQuery } from "@/hooks/client/useClientTabQueries"

const mocks = vi.hoisted(() => ({
  user: { company_id: 9, id: 1 }, clinic: { id: 2, company_id: 9 },
  exams: vi.fn(), clinics: vi.fn(), legacyClinics: vi.fn(), session: vi.fn(),
}))
vi.mock("@/contexts/UserContext", () => ({ useUser: () => ({ currentClinic: mocks.clinic, currentUser: mocks.user }) }))
vi.mock("@/lib/api-client", () => ({ apiClient: { getRecordClinics: mocks.clinics, getClinicsByCompany: mocks.legacyClinics } }))
vi.mock("@/lib/auth/AuthService", () => ({ authService: { getSession: mocks.session } }))
vi.mock("@/lib/db/exams-db", () => ({ getExamsByClientId: mocks.exams }))

beforeEach(() => {
  mocks.user.company_id=9; mocks.clinic.id=2; mocks.clinic.company_id=9
  mocks.session.mockReturnValue({ user: mocks.user })
  mocks.clinics.mockResolvedValue({ data: [{ id: 1, name: "A" }, { id: 2, name: "B" }] })
  mocks.exams.mockResolvedValue([{ id: 10, client_id: 1, clinic_id: 1 }, { id: 11, client_id: 1, clinic_id: 2 }])
  vi.clearAllMocks()
})
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>

describe("company clients", () => {
  it("defaults directory to current clinic and allows all or a specific clinic without switching app context", async () => {
    const { result } = renderHook(() => useCompanyClinicFilter(), { wrapper })
    expect(result.current.clinicId).toBe(2)
    await waitFor(() => expect(result.current.clinics).toHaveLength(2))
    act(() => result.current.setValue("all"))
    expect(result.current.clinicId).toBeUndefined()
    act(() => result.current.setValue("1"))
    expect(result.current.clinicId).toBe(1)
    expect(mocks.clinic.id).toBe(2)
  })

  it("defaults profile history to all clinics and resets selections after company changes", () => {
    const { result, rerender } = renderHook(() => useCompanyClinicFilter(true), { wrapper })
    expect(result.current.value).toBe("all")
    act(() => result.current.setValue("1"))
    expect(result.current.clinicId).toBe(1)
    mocks.user.company_id=12;mocks.clinic.company_id=12
    rerender()
    expect(result.current.value).toBe("all")
  })

  it("filters company history while caching the complete history and separating company keys", async () => {
    const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const scopedWrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={cache}><ClientHistoryClinicContext.Provider value={2}>{children}</ClientHistoryClinicContext.Provider></QueryClientProvider>
    const { result } = renderHook(() => useClientExamsQuery(1, "exam"), { wrapper: scopedWrapper })
    await waitFor(() => expect(result.current.data).toHaveLength(1))
    expect(result.current.data?.[0].id).toBe(11)
    expect(cache.getQueryData(clientQueryKeys.exams(1, "exam"))).toHaveLength(2)
    const firstKey=clientQueryKeys.exams(1,"exam")
    mocks.user.company_id=12
    expect(clientQueryKeys.exams(1,"exam")).not.toEqual(firstKey)
  })
})


it("loads clinic names from the existing company endpoint on older APIs", async () => {
  mocks.clinics.mockResolvedValue({ error: "Not found", status: 404 })
  mocks.legacyClinics.mockResolvedValue({ data: [{ id: 1, name: "Clinic A" }] })
  const { result } = renderHook(() => useCompanyClinicFilter(), { wrapper })
  await waitFor(() => expect(result.current.clinics).toEqual([{ id: 1, name: "Clinic A" }]))
  expect(mocks.legacyClinics).toHaveBeenCalledWith(9)
})
