import * as React from "react";
import { addDays, format } from "date-fns";
import { he } from "date-fns/locale";
import { Line, LineChart, ResponsiveContainer } from "recharts";

import { Card, CardContent } from "@/components/ui/card";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Appointment, User } from "@/lib/db/schema-interface";
import type { CalendarHoliday } from "@/lib/clinic-holidays";

interface StatisticsSidebarProps {
  currentDate: Date;
  onDateSelect: (date: Date) => void;
  appointments: Appointment[];
  workStart: string;
  workEnd: string;
  breakStart?: string;
  breakEnd?: string;
  currentUser: User | null;
  holidaysByDate: Record<string, CalendarHoliday>;
}

const toMinutes = (value?: string) => {
  if (!value) return 0;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

function getDayCapacity({
  day,
  appointments,
  currentUser,
  workStart,
  workEnd,
  breakStart,
  breakEnd,
  holidaysByDate,
}: Omit<StatisticsSidebarProps, "currentDate" | "onDateSelect"> & { day: Date }) {
  const dateKey = format(day, "yyyy-MM-dd");
  const vacationDates = [...(currentUser?.system_vacation_dates || []), ...(currentUser?.added_vacation_dates || [])];
  const unavailable = vacationDates.includes(dateKey) || Boolean(holidaysByDate[dateKey]);
  const start = toMinutes(workStart);
  const end = toMinutes(workEnd);
  const pauseStart = breakStart ? toMinutes(breakStart) : -1;
  const pauseEnd = breakEnd ? toMinutes(breakEnd) : -1;
  const workingMinutes = new Set<number>();
  if (!unavailable) {
    for (let minute = start; minute < end; minute += 1) {
      if (pauseStart >= 0 && minute >= pauseStart && minute < pauseEnd) continue;
      workingMinutes.add(minute);
    }
  }
  const personalAppointments = appointments.filter(
    (appointment) => appointment.user_id === currentUser?.id && appointment.date === dateKey,
  );
  const occupied = new Set<number>();
  let scheduledMinutes = 0;
  for (const appointment of personalAppointments) {
    const appointmentStart = toMinutes(appointment.time);
    const duration = Math.max(0, Number(appointment.duration || 0));
    scheduledMinutes += duration;
    for (let minute = appointmentStart; minute < appointmentStart + duration; minute += 1) {
      if (workingMinutes.has(minute)) occupied.add(minute);
    }
  }
  const capacity = workingMinutes.size;
  const booked = occupied.size;
  const free = Math.max(0, capacity - booked);
  return {
    unavailable,
    appointments: personalAppointments.length,
    scheduledMinutes,
    free,
    utilization: capacity ? Math.min(100, Math.round((booked / capacity) * 100)) : 0,
  };
}

export function StatisticsSidebar(props: StatisticsSidebarProps) {
  const {
    currentDate,
    onDateSelect,
    appointments,
    workStart,
    workEnd,
    breakStart,
    breakEnd,
    currentUser,
    holidaysByDate,
  } = props;
  const capacityInput = React.useMemo(
    () => ({ appointments, workStart, workEnd, breakStart, breakEnd, currentUser, holidaysByDate }),
    [appointments, workStart, workEnd, breakStart, breakEnd, currentUser, holidaysByDate],
  );
  const selected = React.useMemo(() => getDayCapacity({ ...capacityInput, day: currentDate }), [capacityInput, currentDate]);
  const week = React.useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const day = addDays(currentDate, index - 3);
        return { ...getDayCapacity({ ...capacityInput, day }), label: format(day, "dd/MM") };
      }),
    [capacityInput, currentDate],
  );

  return (
    <aside className="w-72 shrink-0 space-y-3" dir="rtl">
      <Card className="justify-center p-2 shadow-none">
        <CardContent className="justify-center p-0">
          <Calendar
            mode="single"
            selected={currentDate}
            onSelect={(date) => date && onDateSelect(date)}
            className="w-full justify-center"
            locale={he}
            components={{
              DayButton: (dayProps: any) => {
                const dateStr = format(dayProps.day.date, "yyyy-MM-dd");
                const isVacation = [
                  ...(currentUser?.system_vacation_dates || []),
                  ...(currentUser?.added_vacation_dates || []),
                ].includes(dateStr);
                const holiday = holidaysByDate[dateStr];
                return (
                  <div className="relative">
                    <CalendarDayButton {...dayProps} />
                    {isVacation || holiday ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={`absolute top-1 right-1 size-1.5 rounded-full ${isVacation ? "bg-rose-500" : "bg-blue-500"}`} />
                          </TooltipTrigger>
                          <TooltipContent side="top" align="end">{isVacation ? "יום חופש" : holiday?.name}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : null}
                  </div>
                );
              },
            }}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="gap-0 py-0 shadow-none"><CardContent className="grid h-24 grid-rows-[16px_1fr_16px] gap-1 p-3"><p className="truncate text-xs text-muted-foreground">התורים שלי</p><p className="self-center text-xl font-semibold tabular-nums">{selected.appointments}</p><p className="truncate text-xs text-muted-foreground" title={`${selected.scheduledMinutes} דקות מתוזמנות`}>{selected.scheduledMinutes} דקות מתוזמנות</p></CardContent></Card>
        <Card className="gap-0 py-0 shadow-none"><CardContent className="grid h-24 grid-rows-[16px_1fr_16px] gap-1 p-3"><p className="truncate text-xs text-muted-foreground">זמן פנוי</p><p className="self-center text-xl font-semibold tabular-nums">{selected.unavailable ? "—" : `${Math.floor(selected.free / 60)}:${String(selected.free % 60).padStart(2, "0")}`}</p><p className="truncate text-xs text-muted-foreground">{selected.unavailable ? "יום לא זמין" : `${selected.utilization}% תפוסה`}</p></CardContent></Card>
      </div>

      <Card className="gap-0 py-0 shadow-none">
        <CardContent className="p-3">
          <div className="flex items-baseline justify-between gap-3"><p className="text-sm font-medium">תפוסה אישית</p><span className="text-xs text-muted-foreground">7 ימים</span></div>
          <div className="mt-2 h-12" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[...week].reverse()} margin={{ top: 3, right: 2, bottom: 3, left: 2 }}>
                <Line type="monotone" dataKey="utilization" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground" dir="rtl"><span>{week[0]?.label}</span><span>{week[6]?.label}</span></div>
        </CardContent>
      </Card>
    </aside>
  );
}
