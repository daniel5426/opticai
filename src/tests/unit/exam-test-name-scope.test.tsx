import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, test, vi } from "vitest"
import AllExamsPage from "@/pages/AllExamsPage"
import i18n from "@/localization/i18n"

const mocks = vi.hoisted(() => ({
  getExamTestNames: vi.fn(),
  getRecordClinics: vi.fn(),
  getPaginatedEnrichedExams: vi.fn(),
  navigate: vi.fn(),
  search: { page: 1, q: "", testName: "all", sort: "", filters: "" },
}))

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
  useSearch: () => mocks.search,
}))
vi.mock("@/contexts/UserContext", () => {
  const currentClinic = { id: 1, company_id: 1 }
  const currentUser = { id: 1, company_id: 1 }
  return { useUser: () => ({ currentClinic, currentUser }) }
})
vi.mock("@/components/site-header", () => ({ SiteHeader: () => null }))
vi.mock("@/components/ClientSelectModal", () => ({ ClientSelectModal: () => null }))
vi.mock("@/lib/api-client", () => ({ apiClient: mocks }))
vi.mock("@/lib/db/exam-layouts-db", () => ({
  getAllExamLayouts: async () => [{ id: 1, name: "First clinic's layout" }],
}))
vi.mock("@/lib/db/exams-db", () => ({ getPaginatedEnrichedExams: mocks.getPaginatedEnrichedExams }))

vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
Element.prototype.hasPointerCapture = () => false
Element.prototype.scrollIntoView = vi.fn()

afterEach(cleanup)

test("the exam type options clear when the selected clinic's request fails", async () => {
  await i18n.changeLanguage("en")
  mocks.getRecordClinics.mockResolvedValue({ data: [{ id: 2, name: "Second clinic" }] })
  mocks.getExamTestNames.mockImplementation(async (_type, clinicId) =>
    clinicId === 1 ? { data: ["First clinic's exam", "An exam off the first page"] } : { error: "Unavailable" },
  )
  mocks.getPaginatedEnrichedExams.mockImplementation(async (_type, clinicId) => {
    if (clinicId === 2) throw new Error("Unavailable")
    return { items: [{ id: 1, exam_date: "2026-11-11", test_name: "First clinic's exam" }], hasMore: false, total: 1 }
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><AllExamsPage /></QueryClientProvider>)

  const examFilter = i18n.t("columnFilters.filterColumn", { column: i18n.t("examList.kind") })
  const openExamFilter = async () => userEvent.click(await screen.findByRole("button", { name: examFilter }))
  await openExamFilter()
  expect(await screen.findByRole("checkbox", { name: "First clinic's exam" })).toBeInTheDocument()
  expect(screen.getByRole("checkbox", { name: "An exam off the first page" })).toBeInTheDocument()
  await userEvent.keyboard("{Escape}")

  const clinicFilter = i18n.t("columnFilters.filterColumn", { column: i18n.t("companyClients.clinic") })
  await userEvent.click(screen.getByRole("button", { name: clinicFilter }))
  await userEvent.click(screen.getByRole("combobox", { name: i18n.t("companyClients.clinicFilter") }))
  await userEvent.click(await screen.findByRole("option", { name: "Second clinic" }))
  await waitFor(() => expect(client.getQueryState(["exam-test-names", 1, 1, 2])?.status).toBe("error"))
  await userEvent.keyboard("{Escape}")
  await openExamFilter()
  expect(await screen.findByText(i18n.t("columnFilters.noOptions"))).toBeInTheDocument()
  expect(screen.queryByRole("checkbox", { name: "First clinic's exam" })).toBeNull()
  expect(screen.queryByRole("checkbox", { name: "First clinic's layout" })).toBeNull()
})
