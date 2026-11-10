import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import i18n from "@/localization/i18n"
import { ClientsTable } from "@/components/clients-table"

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }))
beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

test("searches first name, last name, ID and phone in separate boxes", async () => {
  await i18n.changeLanguage("he")
  const onChange = vi.fn()
  render(<ClientsTable data={[]} serverFiltered fieldSearch columnFilters={{ gender: "f" } as any} onColumnFiltersChange={onChange} />)
  expect(screen.queryByPlaceholderText("חיפוש לקוחות…")).toBeNull()
  fireEvent.change(screen.getByLabelText("שם משפחה"), { target: { value: "טקץ" } })
  fireEvent.change(screen.getByLabelText("טלפון"), { target: { value: "0506" } })
  expect(onChange).not.toHaveBeenCalled()
  act(() => { vi.advanceTimersByTime(400) })
  expect(onChange).toHaveBeenCalledTimes(1)
  expect(onChange.mock.calls[0][0]).toMatchObject({ gender: "f", last_name: "טקץ", phone_mobile: "0506" })
  expect(screen.getByLabelText("שם פרטי")).toBeTruthy()
  expect(screen.getByLabelText("ת.ז.")).toBeTruthy()
})
