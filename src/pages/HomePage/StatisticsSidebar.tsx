import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, CalendarDayButton } from "@/components/ui/calendar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { CalendarDays, Clock } from "lucide-react"
import { format } from "date-fns"
import { he } from "date-fns/locale"
import { isJewishHoliday, getJewishHolidayName } from "@/lib/jewish-holidays"
import { User } from "@/lib/db/schema-interface"

interface StatisticsSidebarProps {
  currentDate: Date
  onDateSelect: (date: Date) => void
  todayAppointmentsCount: number
  todayFreeSlots: number
  totalSlots: number
  appointmentDuration: number
  currentUser: User | null
}

export function StatisticsSidebar({
  currentDate,
  onDateSelect,
  todayAppointmentsCount,
  todayFreeSlots,
  totalSlots,
  appointmentDuration,
  currentUser
}: StatisticsSidebarProps) {
  return (
    <div className="w-72 space-y-4">
      {/* Mini Calendar */}
      <Card className="bg-card shadow-md border-none p-2 justify-center">
        <CardContent className="p-0 justify-center">
          <Calendar
            mode="single"
            selected={currentDate}
            onSelect={(date) => date && onDateSelect(date)}
            className="w-full justify-center"
            locale={he}
            components={{
              DayButton: (props: any) => {
                const dateStr = format(props.day.date, 'yyyy-MM-dd')
                const isVacation = [
                  ...(currentUser?.system_vacation_dates || []),
                  ...(currentUser?.added_vacation_dates || [])
                ].includes(dateStr)
                const isHoliday = isJewishHoliday(dateStr)
                return (
                  <div className="relative">
                    <CalendarDayButton {...props} />
                    {isVacation && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500" />
                          </TooltipTrigger>
                          <TooltipContent side="top" align="end">
                            יום חופש
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {!isVacation && isHoliday && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-blue-500" />
                          </TooltipTrigger>
                          <TooltipContent side="top" align="end">
                            {getJewishHolidayName(dateStr) || 'חג'}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                )
              }
            }}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-2">
        <Card className="bg-card border-none shadow-md py-4">
          <CardHeader className="flex flex-row items-center mb-[-10px] justify-between space-y-0">
            <CardTitle className="text-sm font-medium">תורים היום</CardTitle>
            <CalendarDays className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{todayAppointmentsCount}</div>
            <p className="text-xs text-muted-foreground">
              מתוך {totalSlots} תורים אפשריים
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-none shadow-md">
          <CardHeader className="flex flex-row items-center mb-[-10px] justify-between space-y-0">
            <CardTitle className="text-sm font-medium">מקומות פנויים</CardTitle>
            <Clock className="h-4 w-4 text-secondary-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary-foreground">{todayFreeSlots}</div>
            <p className="text-xs text-muted-foreground">
              {todayFreeSlots * appointmentDuration} דקות פנויות
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

