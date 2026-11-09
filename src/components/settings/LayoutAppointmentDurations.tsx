import React from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUser } from "@/contexts/UserContext";
import { apiClient } from "@/lib/api-client";
import { getAllExamLayouts } from "@/lib/db/exam-layouts-db";
import { ExamLayout } from "@/lib/db/schema-interface";
import { appointmentDurationTargets } from "@/components/appointments/exam-layouts";
import { useAppLocale } from "@/localization/use-app-locale";

const DURATIONS = [10, 15, 20, 30, 40, 45, 60, 75, 90, 120];
const DEFAULT_VALUE = "default";

export function LayoutAppointmentDurations({ defaultDuration }: { defaultDuration: number }) {
  const { currentClinic } = useUser();
  const { direction } = useAppLocale();
  const [layouts, setLayouts] = React.useState<ExamLayout[]>([]);

  React.useEffect(() => {
    if (!currentClinic?.id) return;
    let cancelled = false;
    getAllExamLayouts(currentClinic.id).then((all) => {
      if (!cancelled) setLayouts(appointmentDurationTargets(all));
    });
    return () => {
      cancelled = true;
    };
  }, [currentClinic?.id]);

  const save = async (layout: ExamLayout, value: string) => {
    const appointment_duration = value === DEFAULT_VALUE ? null : Number(value);
    const previous = layout.appointment_duration;
    const apply = (duration: number | null | undefined) =>
      setLayouts((items) =>
        items.map((item) => (item.id === layout.id ? { ...item, appointment_duration: duration } : item)),
      );
    apply(appointment_duration);
    const response = await apiClient.updateExamLayout(layout.id!, { appointment_duration });
    if (response.error) {
      apply(previous);
      toast.error("שגיאה בשמירת משך התור");
      return;
    }
    toast.success(`משך התור של ${layout.name} נשמר`);
  };

  if (layouts.length === 0) return null;

  return (
    <div className="space-y-3">
      <div>
        <Label className="block text-start">משך תור לפי סוג בדיקה</Label>
        <p className="text-muted-foreground text-start text-sm">
          תור שנקבע עם הפריסה או הקבוצה יקבל את המשך שהוגדר כאן
        </p>
      </div>
      <div className="divide-y rounded-md border">
        {layouts.map((layout) => {
          const selectId = `layout-duration-${layout.id}`;
          return (
            <div key={layout.id} className="flex items-center justify-between gap-4 px-3 py-2">
              <Label htmlFor={selectId} className="min-w-0 flex-1 text-start leading-snug font-normal break-words">
                {layout.name}
              </Label>
              <Select
                dir={direction}
                value={layout.appointment_duration ? String(layout.appointment_duration) : DEFAULT_VALUE}
                onValueChange={(value) => void save(layout, value)}
              >
                <SelectTrigger id={selectId} className="w-[170px] shrink-0 text-start" dir={direction}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_VALUE}>ברירת מחדל ({defaultDuration} דקות)</SelectItem>
                  {[...new Set([...DURATIONS, layout.appointment_duration || DURATIONS[0]])]
                    .sort((a, b) => a - b)
                    .map((minutes) => (
                      <SelectItem key={minutes} value={String(minutes)}>
                        {minutes} דקות
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
