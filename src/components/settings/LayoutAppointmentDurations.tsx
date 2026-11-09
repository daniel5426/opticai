import React from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const { currentClinic } = useUser();
  const { direction } = useAppLocale();
  const [layouts, setLayouts] = React.useState<ExamLayout[]>([]);
  const [saving, setSaving] = React.useState(false);

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
    if (saving) return;
    const appointment_duration = value === DEFAULT_VALUE ? null : Number(value);
    const previous = layout.appointment_duration;
    const apply = (duration: number | null | undefined) =>
      setLayouts((items) =>
        items.map((item) => (item.id === layout.id ? { ...item, appointment_duration: duration } : item)),
      );
    apply(appointment_duration);
    setSaving(true);
    try {
      const response = await apiClient.updateExamLayout(layout.id!, { appointment_duration });
      if (response.error) throw new Error(response.error);
      toast.success(t("layoutDuration.saved", { name: layout.name }));
    } catch {
      apply(previous);
      toast.error(t("layoutDuration.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (layouts.length === 0) return null;

  return (
    <div className="space-y-3">
      <div>
        <Label className="block text-start">{t("layoutDuration.title")}</Label>
        <p className="text-muted-foreground text-start text-sm">
          {t("layoutDuration.description")}
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
                disabled={saving}
                dir={direction}
                value={layout.appointment_duration ? String(layout.appointment_duration) : DEFAULT_VALUE}
                onValueChange={(value) => void save(layout, value)}
              >
                <SelectTrigger id={selectId} className="w-[170px] shrink-0 text-start" dir={direction}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_VALUE}>{t("layoutDuration.default", { minutes: defaultDuration })}</SelectItem>
                  {[...new Set([...DURATIONS, layout.appointment_duration || DURATIONS[0]])]
                    .sort((a, b) => a - b)
                    .map((minutes) => (
                      <SelectItem key={minutes} value={String(minutes)}>
                        {t("layoutDuration.minutes", { minutes })}
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
