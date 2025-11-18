import React from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { format, startOfWeek, endOfWeek } from "date-fns"
import { he } from "date-fns/locale"
import { CalendarView } from "./types"

interface CalendarHeaderProps {
  currentDate: Date
  view: CalendarView
  onNavigate: (direction: 'prev' | 'next') => void
  onToday: () => void
  onViewChange: (view: CalendarView) => void
}

export function CalendarHeader({ currentDate, view, onNavigate, onToday, onViewChange }: CalendarHeaderProps) {
  const getDisplayTitle = () => {
    if (view === 'day') {
      return format(currentDate, 'dd/MM/yyyy - EEEE', { locale: he })
    } else if (view === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 })
      return `${format(weekStart, 'dd/MM', { locale: he })} - ${format(weekEnd, 'dd/MM/yyyy', { locale: he })}`
    } else {
      return format(currentDate, 'MMMM yyyy', { locale: he })
    }
  }

  return (
    <div className="flex items-center justify-between p-4 lg:p-6 pb-0">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onToday} className="bg-card examcard dark:bg-card">
          היום
        </Button>
        <div className="flex items-center gap-2">
          <Button className="bg-card examcard border dark:bg-card" variant="outline" size="icon" onClick={() => onNavigate('prev')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button className="bg-card examcard border dark:bg-card" variant="outline" size="icon" onClick={() => onNavigate('next')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
        <h1 className="text-xl font-semibold">{getDisplayTitle()}</h1>
      </div>

      <div className="flex items-center gap-2 bg-card examcard rounded-md">
        <div className="flex rounded-md">
          <Button
            variant={view === 'day' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewChange('day')}
            className="rounded-l-none"
          >
            יום
          </Button>
          <Button
            variant={view === 'week' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewChange('week')}
            className="rounded-none"
          >
            שבוע
          </Button>
          <Button
            variant={view === 'month' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewChange('month')}
            className="rounded-r-none"
          >
            חודש
          </Button>
        </div>
      </div>
    </div>
  )
}

