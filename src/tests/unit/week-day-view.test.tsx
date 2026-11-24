import React, { createRef } from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, test, vi } from "vitest"
import { WeekDayView } from "@/pages/HomePage/WeekDayView"
import { AppointmentBlock } from "@/pages/HomePage/types"
import { CalendarEvent, Client } from "@/lib/db/schema-interface"

const client = {
  id: 7,
  first_name: "דנה",
  last_name: "כהן",
  phone_mobile: "050-1234567",
} as Client

function renderCalendar(blockHeight: number, events: CalendarEvent[] = [], onEventClick = vi.fn(), note?: string) {
  const appointment = {
    id: 1,
    time: "10:30:00.000",
    client_id: 7,
    exam_name: "בדיקת ראייה",
    note,
    top: 0,
    height: blockHeight,
    left: 0,
    width: 100,
    zIndex: 1,
  } as AppointmentBlock

  render(
    <div dir="rtl">
      <WeekDayView
        hourHeight={95}
        onHourHeightChange={() => {}}
        visibleDates={[new Date(2026, 7, 2)]}
        timeSlots={[{ time: "10:30", startMinutes: 630, durationMinutes: 30 }]}
        totalWorkMinutes={30}
        currentUser={null}
        holidaysByDate={{}}
        clients={[client]}
        getAppointmentBlocks={() => [appointment]}
        getAppointmentColor={() => "#3b82f6"}
        getAppointmentDuration={() => 15}
        getDynamicTimeRange={() => "10:30 - 10:45"}
        handleTimeSlotClick={vi.fn()}
        handleMouseDown={vi.fn()}
        handleResizeStart={vi.fn()}
        openEditDialog={vi.fn()}
        onAppointmentContextMenu={vi.fn()}
        onAppointmentSelect={vi.fn()}
        isMoveMode={false}
        draggedBlockId={null}
        dragPosition={null}
        resizeData={null}
        draggedData={null}
        calendarRef={createRef()}
        suppressClickRef={{ current: false }}
        getEventsForDate={() => events}
        onEventClick={onEventClick}
      />
    </div>
  )
}

describe("WeekDayView appointment cards", () => {
  test("uses separate time and client rows when the card has enough height", () => {
    renderCalendar(48)

    const card = screen.getByTitle("10:30 - 10:45 • כהן דנה")
    expect(within(card).getByText("10:30 - 10:45")).toBeInTheDocument()
    expect(within(card).getByText("כהן דנה")).toBeInTheDocument()
    expect(within(card).getByText("050-1234567")).toBeInTheDocument()
    expect(within(card).queryByText("בדיקת ראייה")).not.toBeInTheDocument()
  })

  test("shows the exam name below the phone only on taller cards", () => {
    renderCalendar(72)

    const card = screen.getByTitle("10:30 - 10:45 • כהן דנה")
    expect(within(card).getByText("050-1234567")).toBeInTheDocument()
    expect(within(card).getByText("בדיקת ראייה")).toBeInTheDocument()
  })

  test("keeps the client name visible with only the start time in compact cards", () => {
    renderCalendar(24)

    const card = screen.getByTitle("10:30 - 10:45 • כהן דנה")
    expect(within(card).getByText("10:30")).toBeInTheDocument()
    expect(within(card).queryByText("10:30 - 10:45")).not.toBeInTheDocument()
    expect(within(card).getByText("כהן דנה")).toBeInTheDocument()
    expect(within(card).queryByText("050-1234567")).not.toBeInTheDocument()
  })
})

describe("WeekDayView appointment notes", () => {
  test("shows the note under the other lines when the card has room for it", () => {
    renderCalendar(96, [], vi.fn(), "להביא משקפיים ישנים")

    const card = screen.getByTitle("10:30 - 10:45 • כהן דנה")
    const note = within(card).getByText("להביא משקפיים ישנים")
    expect(within(card).getByText("בדיקת ראייה")).toBeInTheDocument()
    // 96px less the card's and the note box's padding: 7 lines of 12px, 4 taken by time, name, phone and exam name.
    expect(note.style.webkitLineClamp).toBe("3")
    expect(note.closest("[data-appointment-note]")).not.toBeNull()
  })

  test("leaves the note out when the card has no room left", () => {
    renderCalendar(48, [], vi.fn(), "להביא משקפיים ישנים")

    const card = screen.getByTitle("10:30 - 10:45 • כהן דנה")
    expect(within(card).queryByText("להביא משקפיים ישנים")).not.toBeInTheDocument()
  })
})

describe("WeekDayView general events", () => {
  test("shows an event's time and text at its time, and opens it on click", () => {
    const event = { id: 3, date: "2026-08-02", time: "10:30", duration: 30, text: "ישיבת צוות" }
    const onEventClick = vi.fn()
    renderCalendar(48, [event], onEventClick)

    const card = screen.getByTitle(/10:30 - 11:00 • ישיבת צוות$/)
    expect(within(card).getByText("10:30")).toBeInTheDocument()
    expect(within(card).getByText("ישיבת צוות")).toBeInTheDocument()
    expect(card.style.top).toBe("0px")
    fireEvent.click(card)
    expect(onEventClick).toHaveBeenCalledWith(event)
  })
})
