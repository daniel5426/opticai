import React from "react"
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import i18n from "@/localization/i18n"
import { ClientsTable } from "@/components/clients-table"

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }))
beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

test.each([
  ["he", "rtl"],
  ["en", "ltr"],
  ["fr", "ltr"],
])("keeps one search box and filters clients through column headers in %s", async (locale, direction) => {
  await i18n.changeLanguage(locale)
  const onChange = vi.fn()
  const { container } = render(<ClientsTable data={[]} serverFiltered searchQuery="שם מלא" columnFilters={{ gender: ["נקבה"] }} onColumnFiltersChange={onChange} />)
  const toolbar = within(container.querySelector("[data-canvas-toolbar]")!)
  const search = toolbar.getByRole("textbox", { name: i18n.t("companyClients.search.general") })
  expect(search).toHaveValue("שם מלא")
  expect(search).toHaveAttribute("dir", direction)
  expect(toolbar.getAllByRole("textbox")).toHaveLength(1)
  expect(toolbar.queryByRole("combobox")).not.toBeInTheDocument()
  const summary = toolbar.getByRole("group", { name: i18n.t("columnFilters.activeFilters") })
  expect(summary).toHaveAttribute("dir", direction)

  fireEvent.click(screen.getByRole("button", { name: i18n.t("columnFilters.filterColumn", { column: i18n.t("tableExport.column.last_name") }) }))
  fireEvent.change(screen.getByPlaceholderText(i18n.t("columnFilters.containsPlaceholder")), { target: { value: "טקץ" } })
  expect(onChange).not.toHaveBeenCalled()
  act(() => { vi.advanceTimersByTime(400) })
  expect(onChange).toHaveBeenCalledWith({ gender: ["נקבה"], last_name: "טקץ" })
})
