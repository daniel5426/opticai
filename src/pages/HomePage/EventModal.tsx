import React from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomModal } from "@/components/ui/custom-modal";
import { DateInput } from "@/components/ui/date";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TimeInput } from "@/components/ui/time";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarEvent } from "@/lib/db/schema-interface";
import { useAppLocale } from "@/localization/use-app-locale";

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240, 480];

interface EventModalProps {
  event: CalendarEvent | null;
  saving: boolean;
  onChange: (changes: Partial<CalendarEvent>) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: (id: number) => void;
}

export function EventModal({ event, saving, onChange, onClose, onSave, onDelete }: EventModalProps) {
  const { t } = useTranslation();
  const { direction } = useAppLocale();
  const durations = event && !DURATIONS.includes(event.duration) ? [...DURATIONS, event.duration].sort((a, b) => a - b) : DURATIONS;
  const durationLabel = (minutes: number) =>
    minutes % 60 === 0 ? t("calendarEventHours", { count: minutes / 60 }) : t("calendarEventMinutes", { count: minutes });

  return (
    <CustomModal
      isOpen={Boolean(event)}
      onClose={onClose}
      title={t(event?.id ? "calendarEventEditTitle" : "calendarEventNewTitle")}
      className="border-none sm:max-w-[520px]"
    >
      {event && (
        <form
          className="grid gap-4"
          dir={direction}
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            onSave();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="calendar-event-text">{t("calendarEventText")}</Label>
            <Textarea
              id="calendar-event-text"
              value={event.text}
              onChange={(changeEvent) => onChange({ text: changeEvent.target.value })}
              placeholder={t("calendarEventTextPlaceholder")}
              maxLength={2000}
              rows={3}
              autoFocus
              onKeyDown={(keyEvent) => {
                if (keyEvent.key === "Enter" && (keyEvent.metaKey || keyEvent.ctrlKey)) keyEvent.currentTarget.form?.requestSubmit();
              }}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="calendar-event-date">{t("calendarEventDate")}</Label>
              <DateInput name="calendar_event_date" value={event.date} onChange={(changeEvent) => onChange({ date: changeEvent.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="calendar-event-time">{t("calendarEventTime")}</Label>
              <TimeInput id="calendar-event-time" name="calendar_event_time" value={event.time} onChange={(changeEvent) => onChange({ time: changeEvent.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="calendar-event-duration">{t("calendarEventDuration")}</Label>
              <Select value={String(event.duration)} onValueChange={(value) => onChange({ duration: Number(value) })} dir={direction} clearable={false}>
                <SelectTrigger id="calendar-event-duration" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {durations.map((minutes) => <SelectItem key={minutes} value={String(minutes)}>{durationLabel(minutes)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-2 flex justify-center gap-2">
            <Button type="submit" disabled={saving || !event.text.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("calendarEventSave")}
            </Button>
            {event.id && (
              <Button type="button" variant="destructive" size="icon" aria-label={t("calendarEventDelete")} title={t("calendarEventDelete")}
                onClick={() => onDelete(event.id!)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>
      )}
    </CustomModal>
  );
}
