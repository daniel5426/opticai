import React from "react";
import { format, isToday } from "date-fns";
import { getDateLocale } from "@/localization/date-locale";
import { useAppLocale } from "@/localization/use-app-locale";
import { useTranslation } from "react-i18next";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CalendarHoliday } from "@/lib/clinic-holidays";
import { Appointment, User } from "@/lib/db/schema-interface";
import { CalendarView } from "./types";
import { formatAppointmentTime } from "./utils";

interface MonthViewProps {
  visibleDates: Date[];
  currentDate: Date;
  getAppointmentsForDate: (date: Date) => Appointment[];
  currentUser: User | null;
  holidaysByDate: Record<string, CalendarHoliday>;
  onDateClick: (date: Date) => void;
  onViewChange: (view: CalendarView) => void;
}

export function MonthView({
  visibleDates,
  currentDate,
  getAppointmentsForDate,
  currentUser,
  holidaysByDate,
  onDateClick,
  onViewChange,
}: MonthViewProps) {
  const { locale } = useAppLocale();
  const { t } = useTranslation();
  const dateLocale = getDateLocale(locale);
  return (
    <div className="grid grid-cols-7 gap-0">
      {/* Day headers */}
      {visibleDates.slice(0, 7).map((date) => (
        <div
          key={date.toISOString()}
          className="border-b p-2 text-center text-sm font-medium"
        >
          {format(date, "EEEEE", { locale: dateLocale })}
        </div>
      ))}

      {/* Month grid */}
      {visibleDates.map((date, index) => {
        const dayAppointments = getAppointmentsForDate(date);
        const isCurrentMonth = date.getMonth() === currentDate.getMonth();
        const isCurrentDay = isToday(date);
        const dayBorderClass = [
          index % 7 !== 0 ? "border-r" : "",
          index < visibleDates.length - 7 ? "border-b" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <div
            key={index}
            className={`min-h-[120px] p-1 ${dayBorderClass} relative ${
              !isCurrentMonth ? "bg-muted/30 text-muted-foreground" : ""
            } ${isCurrentDay ? "bg-primary/5" : ""} hover:bg-muted/50 cursor-pointer`}
            onClick={() => {
              onDateClick(date);
              onViewChange("day");
            }}
          >
            <div className="relative">
              <div
                className={`text-sm ${isCurrentDay ? "text-primary font-bold" : ""}`}
              >
                {format(date, "d")}
              </div>
              {(() => {
                const dateStr = format(date, "yyyy-MM-dd");
                const vac = [
                  ...(currentUser?.system_vacation_dates || []),
                  ...(currentUser?.added_vacation_dates || []),
                ].includes(dateStr);
                if (vac) {
                  return (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="absolute top-0 left-0 h-2 w-2 rounded-full bg-red-500" />
                        </TooltipTrigger>
                        <TooltipContent side="top" align="start">
                          {t("vacationDay")}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                }
                const holiday = holidaysByDate[dateStr];
                if (holiday) {
                  return (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="absolute top-0 left-0 h-2 w-2 rounded-full bg-blue-500" />
                        </TooltipTrigger>
                        <TooltipContent side="top" align="start">
                          {holiday.name}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                }
                return null;
              })()}
            </div>
            <div className="mt-1 space-y-1">
              {dayAppointments.slice(0, 3).map((appointment) => (
                <div
                  key={appointment.id}
                  className="bg-primary/20 text-primary truncate rounded p-1 text-xs"
                  title={`${formatAppointmentTime(appointment.time || "")} - ${appointment.exam_name}`}
                >
                  {formatAppointmentTime(appointment.time || "")}{" "}
                  {appointment.exam_name}
                </div>
              ))}
              {dayAppointments.length > 3 && (
                <div className="text-muted-foreground text-xs">
                  +{dayAppointments.length - 3} {t("moreAppointments")}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
