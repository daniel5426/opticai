import React from "react"
import { format, isToday } from "date-fns"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { getJewishHolidayName } from "@/lib/jewish-holidays"
import { Appointment, User } from "@/lib/db/schema-interface"
import { CalendarView } from "./types"

interface MonthViewProps {
  visibleDates: Date[]
  currentDate: Date
  getAppointmentsForDate: (date: Date) => Appointment[]
  currentUser: User | null
  onDateClick: (date: Date) => void
  onViewChange: (view: CalendarView) => void
}

export function MonthView({
  visibleDates,
  currentDate,
  getAppointmentsForDate,
  currentUser,
  onDateClick,
  onViewChange
}: MonthViewProps) {
  return (
    <div className="grid grid-cols-7 gap-0">
      {/* Day headers */}
      {['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map((day) => (
        <div key={day} className="p-2 text-center text-sm font-medium border-b">
          {day}
        </div>
      ))}

      {/* Month grid */}
      {visibleDates.map((date, index) => {
        const dayAppointments = getAppointmentsForDate(date)
        const isCurrentMonth = date.getMonth() === currentDate.getMonth()
        const isCurrentDay = isToday(date)

        return (
          <div
            key={index}
            className={`min-h-[120px] p-1 border-b border-r relative ${!isCurrentMonth ? 'bg-muted/30 text-muted-foreground' : ''
              } ${isCurrentDay ? 'bg-primary/5' : ''} hover:bg-muted/50 cursor-pointer`}
            onClick={() => {
              onDateClick(date)
              onViewChange('day')
            }}
          >
            <div className="relative">
              <div className={`text-sm ${isCurrentDay ? 'font-bold text-primary' : ''}`}>
                {format(date, 'd')}
              </div>
              {(() => {
                const dateStr = format(date, 'yyyy-MM-dd')
                const vac = [
                  ...(currentUser?.system_vacation_dates || []),
                  ...(currentUser?.added_vacation_dates || [])
                ].includes(dateStr)
                if (vac) {
                  return (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="absolute top-0 left-0 w-2 h-2 rounded-full bg-red-500" />
                        </TooltipTrigger>
                        <TooltipContent side="top" align="start">יום חופש</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )
                }
                const name = getJewishHolidayName(dateStr)
                if (name) {
                  return (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="absolute top-0 left-0 w-2 h-2 rounded-full bg-blue-500" />
                        </TooltipTrigger>
                        <TooltipContent side="top" align="start">{name}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )
                }
                return null
              })()}
            </div>
            <div className="mt-1 space-y-1">
              {dayAppointments.slice(0, 3).map((appointment) => (
                <div
                  key={appointment.id}
                  className="text-xs p-1 bg-primary/20 text-primary rounded truncate"
                  title={`${appointment.time} - ${appointment.exam_name}`}
                >
                  {appointment.time} {appointment.exam_name}
                </div>
              ))}
              {dayAppointments.length > 3 && (
                <div className="text-xs text-muted-foreground">
                  +{dayAppointments.length - 3} נוספים
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

