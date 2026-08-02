import React, { createRef } from "react"
import { render, screen, within } from "@testing-library/react"
import { describe, expect, test, vi } from "vitest"
import { WeekDayView } from "@/pages/HomePage/WeekDayView"
import { AppointmentBlock } from "@/pages/HomePage/types"
import { Client } from "@/lib/db/schema-interface"

const client = {
  id: 7,
  first_name: "דנה",
  last_name: "כהן",
} as Client

function renderCalendar(blockHeight: number) {
  const appointment = {
    id: 1,
    time: "10:30:00.000",
    client_id: 7,
    exam_name: "בדיקת ראייה",
    top: 0,
    height: blockHeight,
    left: 0,
    width: 100,
    zIndex: 1,
  } as AppointmentBlock

  render(
    <div dir="rtl">
      <WeekDayView
        visibleDates={[new Date(2026, 7, 2)]}
        timeSlots={[{ time: "10:30", startMinutes: 630, durationMinutes: 30 }]}
        totalWorkMinutes={30}
        currentUser={null}
        clients={[client]}
        getAppointmentBlocks={() => [appointment]}
        getUserColor={() => "#3b82f6"}
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
      />
    </div>
  )
}

describe("WeekDayView appointment cards", () => {
  test("uses separate time and client rows when the card has enough height", () => {
    renderCalendar(48)

    const card = screen.getByTitle("10:30 - 10:45 • דנה כהן")
    expect(within(card).getByText("10:30 - 10:45")).toBeInTheDocument()
    expect(within(card).getByText("דנה כהן")).toBeInTheDocument()
  })

  test("keeps the client name visible with only the start time in compact cards", () => {
    renderCalendar(24)

    const card = screen.getByTitle("10:30 - 10:45 • דנה כהן")
    expect(within(card).getByText("10:30")).toBeInTheDocument()
    expect(within(card).queryByText("10:30 - 10:45")).not.toBeInTheDocument()
    expect(within(card).getByText("דנה כהן")).toBeInTheDocument()
  })
})
