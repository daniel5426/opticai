import React from "react"
import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { StatisticsSidebar } from "@/pages/HomePage/StatisticsSidebar"

vi.mock("recharts", () => ({ ResponsiveContainer: () => null, LineChart: () => null, Line: () => null }))

const props = { onDateSelect: vi.fn(), appointments: [], workStart: "08:00", workEnd: "18:00", currentUser: null, holidaysByDate: {} }
const shownMonth = () => screen.getByRole("grid").getAttribute("aria-label")

describe("StatisticsSidebar calendar", () => {
  it("returns to the main calendar's date when it is set again, even to the same day", () => {
    const today = new Date(2026, 10, 16)
    const { rerender } = render(<StatisticsSidebar {...props} currentDate={today} />)
    const november = shownMonth()
    fireEvent.click(screen.getByRole("button", { name: /next month/i }))
    fireEvent.click(screen.getByRole("button", { name: /next month/i }))
    expect(shownMonth()).not.toBe(november)

    // A re-render with the same date keeps the month the user browsed to.
    rerender(<StatisticsSidebar {...props} currentDate={today} />)
    expect(shownMonth()).not.toBe(november)

    // "Today" sets a new Date for the same day.
    rerender(<StatisticsSidebar {...props} currentDate={new Date(2026, 10, 16)} />)
    expect(shownMonth()).toBe(november)
  })
})
