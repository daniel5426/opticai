import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { getDateLocale } from "@/localization/date-locale";
import { useAppLocale } from "@/localization/use-app-locale";
import { useTranslation } from "react-i18next";
import { CalendarView } from "./types";

interface CalendarHeaderProps {
  currentDate: Date;
  view: CalendarView;
  onNavigate: (direction: "prev" | "next") => void;
  onToday: () => void;
  onViewChange: (view: CalendarView) => void;
}

export function CalendarHeader({
  currentDate,
  view,
  onNavigate,
  onToday,
  onViewChange,
}: CalendarHeaderProps) {
  const { locale } = useAppLocale();
  const { t } = useTranslation();
  const dateLocale = getDateLocale(locale);
  const getDisplayTitle = () => {
    if (view === "day") {
      return format(currentDate, "dd/MM/yyyy - EEEE", { locale: dateLocale });
    } else if (view === "week") {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
      return `${format(weekStart, "dd/MM", { locale: dateLocale })} - ${format(weekEnd, "dd/MM/yyyy", { locale: dateLocale })}`;
    } else {
      return format(currentDate, "MMMM yyyy", { locale: dateLocale });
    }
  };

  return (
    <div className="flex items-center justify-between p-4 pb-0 lg:p-6">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          onClick={onToday}
          className="bg-card examcard dark:bg-card"
        >
          {t("today")}
        </Button>
        <div className="flex items-center gap-2">
          <Button
            className="bg-card examcard dark:bg-card border"
            variant="outline"
            size="icon"
            onClick={() => onNavigate("prev")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            className="bg-card examcard dark:bg-card border"
            variant="outline"
            size="icon"
            onClick={() => onNavigate("next")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
        <h1 className="text-xl font-semibold">{getDisplayTitle()}</h1>
      </div>

      <div className="bg-card examcard flex items-center gap-2 rounded-md">
        <div className="flex rounded-md">
          <Button
            variant={view === "day" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewChange("day")}
            className="rounded-l-none"
          >
            {t("day")}
          </Button>
          <Button
            variant={view === "week" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewChange("week")}
            className="rounded-none"
          >
            {t("week")}
          </Button>
          <Button
            variant={view === "month" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewChange("month")}
            className="rounded-r-none"
          >
            {t("month")}
          </Button>
        </div>
      </div>
    </div>
  );
}
