import React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getSafeHexColor } from "@/components/ui/color-input";
import { cn } from "@/utils/tailwind";
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

  const save = async (
    layout: ExamLayout,
    patch: Pick<ExamLayout, "appointment_duration"> | Pick<ExamLayout, "appointment_color">,
  ) => {
    if (saving) return;
    const field = "appointment_color" in patch ? "color" : "duration";
    const previous = Object.fromEntries(Object.keys(patch).map((key) => [key, layout[key as keyof ExamLayout]]));
    const apply = (values: Partial<ExamLayout>) =>
      setLayouts((items) => items.map((item) => (item.id === layout.id ? { ...item, ...values } : item)));
    apply(patch);
    setSaving(true);
    try {
      const response = await apiClient.updateExamLayout(layout.id!, patch);
      if (response.error) throw new Error(response.error);
      toast.success(t(field === "color" ? "layoutDuration.colorSaved" : "layoutDuration.saved", { name: layout.name }));
    } catch {
      apply(previous);
      toast.error(t(field === "color" ? "layoutDuration.colorSaveFailed" : "layoutDuration.saveFailed"));
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
              <LayoutColorPicker
                name={layout.name}
                color={layout.appointment_color}
                disabled={saving}
                onChange={(color) => {
                  if (color !== (layout.appointment_color ?? null)) void save(layout, { appointment_color: color });
                }}
              />
              <Select
                disabled={saving}
                dir={direction}
                value={layout.appointment_duration ? String(layout.appointment_duration) : DEFAULT_VALUE}
                onValueChange={(value) =>
                  void save(layout, { appointment_duration: value === DEFAULT_VALUE ? null : Number(value) })
                }
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

const swatchClass =
  "relative h-7 w-7 shrink-0 rounded-full border-2 shadow-sm transition-transform hover:scale-110 active:scale-95";

// Light to dark rows of red, orange, amber, lime, green, teal, sky, blue, violet, pink (Tailwind 300/400/600/800).
const PALETTE = [
  ["#fca5a5", "#fdba74", "#fcd34d", "#bef264", "#86efac", "#5eead4", "#7dd3fc", "#93c5fd", "#c4b5fd", "#f9a8d4"],
  ["#f87171", "#fb923c", "#fbbf24", "#a3e635", "#4ade80", "#2dd4bf", "#38bdf8", "#60a5fa", "#a78bfa", "#f472b6"],
  ["#dc2626", "#ea580c", "#d97706", "#65a30d", "#16a34a", "#0d9488", "#0284c7", "#2563eb", "#7c3aed", "#db2777"],
  ["#991b1b", "#9a3412", "#92400e", "#3f6212", "#166534", "#115e59", "#075985", "#1e40af", "#5b21b6", "#9d174d"],
];
const PALETTE_COLORS = PALETTE.flat();

/** The layout's calendar color: from the palette, a custom color, or none (the examiner's color). */
function LayoutColorPicker({
  name,
  color,
  disabled,
  onChange,
}: {
  name: string;
  color?: string | null;
  disabled?: boolean;
  onChange: (color: string | null) => void;
}) {
  const { t } = useTranslation();
  const { direction } = useAppLocale();
  // The native picker reports every drag step; show them at once but save once it settles.
  const [draft, setDraft] = React.useState<string | null>(null);
  const pending = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  React.useEffect(() => () => clearTimeout(pending.current), []);
  const pick = (next: string | null) => {
    clearTimeout(pending.current);
    setDraft(null);
    onChange(next);
  };
  const drag = (next: string) => {
    setDraft(next);
    clearTimeout(pending.current);
    pending.current = setTimeout(() => pick(next), 500);
  };
  color = draft ?? color;
  const custom = color && !PALETTE_COLORS.includes(color) ? color : null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={t("layoutDuration.colorFor", { name })}
          title={color ? t("layoutDuration.color") : t("layoutDuration.examinerColor")}
          className={cn(swatchClass, color ? "border-white" : "border-dashed border-muted-foreground/40 bg-background")}
          style={color ? { backgroundColor: color } : undefined}
        />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-3" dir={direction}>
        <div className="grid grid-cols-10 gap-1.5" dir="ltr">
          {PALETTE_COLORS.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-label={preset}
              className={cn(
                "h-6 w-6 rounded-md border-2 transition-transform hover:scale-110 active:scale-95",
                color === preset ? "border-foreground ring-2 ring-foreground/20" : "border-transparent",
              )}
              style={{ backgroundColor: preset }}
              onClick={() => pick(preset)}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <label
            className={cn(
              swatchClass,
              "cursor-pointer",
              custom ? "border-primary ring-2 ring-primary/20 ring-offset-1" : "border-dashed border-muted-foreground/40",
            )}
            style={custom ? { backgroundColor: custom } : undefined}
          >
            <input
              type="color"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              value={getSafeHexColor(color, "#2563eb")}
              onChange={(event) => drag(event.target.value)}
            />
          </label>
          <span className="text-muted-foreground text-sm">{t("layoutDuration.customColor")}</span>
        </div>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground mt-2 w-full text-start text-sm"
          onClick={() => pick(null)}
        >
          {t("layoutDuration.noColor")}
        </button>
      </PopoverContent>
    </Popover>
  );
}
