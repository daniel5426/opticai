import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import i18n from "@/localization/i18n"
import { ClientsTable } from "@/components/clients-table"

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }))
beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

test.each([
  ["he", "rtl", "חיפוש לקוחות…", "שם פרטי", "שם משפחה", "ת.ז.", "טלפון"],
  ["en", "ltr", "Search clients…", "First name", "Last name", "ID", "Phone"],
  ["fr", "ltr", "Rechercher des clients…", "Prénom", "Nom", "N° d’identité", "Téléphone"],
])("keeps the existing search visible alongside the separate filters in %s", async (locale, direction, search, first, last, id, phone) => {
  await i18n.changeLanguage(locale)
  const onChange = vi.fn()
  render(<ClientsTable data={[]} serverFiltered fieldSearch searchQuery="שם מלא" columnFilters={{ gender: "f" } as any} onColumnFiltersChange={onChange} />)
  expect(screen.getByPlaceholderText(search)).toHaveValue("שם מלא")
  expect(screen.getByPlaceholderText(search)).toHaveAttribute("dir", direction)
  fireEvent.change(screen.getByLabelText(last), { target: { value: "טקץ" } })
  fireEvent.change(screen.getByLabelText(phone), { target: { value: "0506" } })
  expect(onChange).not.toHaveBeenCalled()
  act(() => { vi.advanceTimersByTime(400) })
  expect(onChange).toHaveBeenCalledTimes(1)
  expect(onChange.mock.calls[0][0]).toMatchObject({ gender: "f", last_name: "טקץ", phone_mobile: "0506" })
  expect(screen.getByLabelText(first)).toBeTruthy()
  expect(screen.getByLabelText(id)).toHaveAttribute("dir", "ltr")
})
