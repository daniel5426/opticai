import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { IconCalendar, IconChevronDown, IconClock, IconPencil, IconUsers } from "@tabler/icons-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateInput } from "@/components/ui/date";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomModal } from "@/components/ui/custom-modal";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import type { User, WorkShift } from "@/lib/db/schema-interface";
import { useAppLocale } from "@/localization/use-app-locale";

type Preset = "thisMonth" | "lastMonth" | "thisYear";

type WorkerHours = { user_id: number; total_minutes: number; shifts: number; active_days: number; open_shifts: number };

// Local calendar dates, so the range never slips a day across time zones.
const isoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function presetRange(preset: Preset, today = new Date()) {
  const year = today.getFullYear();
  const month = today.getMonth();
  if (preset === "lastMonth") return { from: isoDate(new Date(year, month - 1, 1)), to: isoDate(new Date(year, month, 0)) };
  if (preset === "thisYear") return { from: isoDate(new Date(year, 0, 1)), to: isoDate(today) };
  return { from: isoDate(new Date(year, month, 1)), to: isoDate(today) };
}

/** Whole hours and the minutes left over; an hour-less time is minutes alone, so 23 minutes never reads as 23 hours. */
export const durationParts = (minutes: number) => {
  const total = Math.max(0, Math.round(minutes));
  return { hours: Math.floor(total / 60), minutes: total % 60 };
};

/** "4 ש׳ 18 ד׳" in running text. */
export function formatDuration(t: (key: string) => string, minutes: number) {
  const { hours, minutes: rest } = durationParts(minutes);
  const parts = [hours ? `${hours} ${t("teamHoursHoursUnit")}` : "", rest || !hours ? `${rest} ${t("teamHoursMinutesUnit")}` : ""];
  return parts.filter(Boolean).join(" ");
}

/** A length of time with its units small beside each number. */
function Duration({ minutes, className = "" }: { minutes: number; className?: string }) {
  const { t } = useTranslation();
  const { direction } = useAppLocale();
  const { hours, minutes: rest } = durationParts(minutes);
  const unit = "text-muted-foreground ms-0.5 text-[0.6em] font-medium";
  return (
    <span dir={direction} className={`inline-flex items-baseline gap-1.5 whitespace-nowrap tabular-nums ${className}`} aria-label={formatDuration(t, minutes)}>
      {hours > 0 && (
        <span>
          {hours}
          <span className={unit}>{t("teamHoursHoursUnit")}</span>
        </span>
      )}
      {(rest > 0 || hours === 0) && (
        <span>
          {rest}
          <span className={unit}>{t("teamHoursMinutesUnit")}</span>
        </span>
      )}
    </span>
  );
}

// Length of a shift from its hours; an end before the start runs past midnight.
const shiftMinutes = (start: string, end: string) => {
  const from = toMinutes(start);
  const to = toMinutes(end);
  return from === null || to === null ? 0 : (to - from + 1440) % 1440;
};

function toMinutes(time?: string | null) {
  const [hours, minutes] = String(time || "").split(":").map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : null;
}

/** One worker's shifts in the period: day, hours, where in the day, and how long. */
function WorkerShifts({ userId, from, to, canEdit }: { userId: number; from: string; to: string; canEdit: boolean }) {
  const { t } = useTranslation();
  const { locale, direction } = useAppLocale();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<WorkShift | null>(null);
  const [times, setTimes] = useState({ start: "", end: "" });
  const editedMinutes = shiftMinutes(times.start, times.end);
  const save = useMutation({
    mutationFn: async () => {
      const response = await apiClient.updateWorkShift(editing!.id!, {
        start_time: times.start,
        end_time: times.end,
        duration_minutes: editedMinutes,
        // Giving an open shift its end closes it.
        ...(editing!.end_time ? {} : { status: "completed" }),
      });
      if (response.error) throw new Error(response.error);
    },
    onSuccess: async () => {
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["worker-stats"] });
    },
    onError: () => toast.error(t("teamHoursEditError")),
  });
  const openEdit = (shift: WorkShift) => {
    setTimes({ start: (shift.start_time || "").slice(0, 5), end: (shift.end_time || "").slice(0, 5) });
    setEditing(shift);
  };
  const dateLocale = locale === "fr" ? "fr-FR" : locale === "en" ? "en-US" : "he-IL";
  const shifts = useQuery({
    queryKey: ["worker-stats", "range-shifts", userId, from, to],
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const response = await apiClient.getWorkShiftsByUserAndRange(userId, from, to);
      if (response.error) throw new Error(response.error);
      return (response.data || []) as WorkShift[];
    },
  });

  if (shifts.isLoading) {
    return (
      <div className="bg-muted/30 space-y-1.5 px-4 py-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }
  if (shifts.isError) return <p className="bg-muted/30 text-muted-foreground px-4 py-3 text-center text-sm">{t("teamHoursShiftsLoadError")}</p>;

  return (
    <ol className="bg-muted/30 px-3 py-2">
      {(shifts.data || []).map((shift, index, all) => {
        const start = toMinutes(shift.start_time);
        const end = toMinutes(shift.end_time);
        const open = !shift.end_time;
        const minutes = open ? null : Math.max(0, Number(shift.duration_minutes) || 0);
        const sameDayAsPrevious = index > 0 && all[index - 1].date === shift.date;
        const day = new Date(`${shift.date}T12:00:00`);
        // Where the shift sits in a 24-hour day; an overnight shift runs to midnight.
        const left = start === null ? 0 : (start / 1440) * 100;
        const right = open || end === null || start === null ? left + 1.5 : end >= start ? (end / 1440) * 100 : 100;
        return (
          <li
            key={shift.id ?? `${shift.date}-${shift.start_time}`}
            className={`group grid ${canEdit ? "grid-cols-[9.5rem_8rem_1fr_5.5rem]" : "grid-cols-[7.5rem_8rem_1fr_5.5rem]"} items-center gap-3 rounded-md px-2 py-1.5 text-sm ${sameDayAsPrevious ? "" : "border-border/60 border-t first:border-t-0"}`}
          >
            <span className="flex items-center gap-1">
              <span className={sameDayAsPrevious ? "invisible" : "font-medium"}>
                {day.toLocaleDateString(dateLocale, { weekday: "short", day: "numeric", month: "numeric" })}
              </span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => openEdit(shift)}
                  aria-label={t("teamHoursEditShift")}
                  title={t("teamHoursEditShift")}
                  className="text-foreground hover:bg-background inline-flex size-7 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <IconPencil className="size-4" stroke={2.25} />
                </button>
              )}
            </span>
            <span className="text-muted-foreground flex items-center gap-1.5 tabular-nums" dir="ltr">
              <span className="text-foreground">{(shift.start_time || "").slice(0, 5)}</span>
              <span aria-hidden="true">→</span>
              {open ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                  {t("teamHoursNow")}
                </span>
              ) : (
                <span className="text-foreground">{(shift.end_time || "").slice(0, 5)}</span>
              )}
              {!open && start !== null && end !== null && end < start && (
                <span title={t("teamHoursNextDay")} className="rounded bg-amber-100 px-1 text-[10px] leading-4 font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  +1
                </span>
              )}
            </span>
            <span className="bg-muted-foreground/10 relative h-1.5 rounded-full" dir="ltr" aria-hidden="true">
              <span
                className={`absolute inset-y-0 rounded-full ${open ? "bg-emerald-500" : "bg-primary/70"}`}
                style={{ left: `${left}%`, width: `${Math.max(1.5, right - left)}%` }}
              />
            </span>
            <span className="text-end font-semibold">
              {minutes === null ? "—" : <Duration minutes={minutes} />}
            </span>
          </li>
        );
      })}
      <CustomModal
        isOpen={Boolean(editing)}
        onClose={() => !save.isPending && setEditing(null)}
        title={t("teamHoursEditShift")}
        subtitle={editing ? new Date(`${editing.date}T12:00:00`).toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "numeric", year: "numeric" }) : undefined}
        width="max-w-md"
        onConfirm={() => save.mutateAsync().catch(() => undefined)}
        confirmText={t("teamHoursSave")}
        cancelText={t("teamHoursCancel")}
        isLoading={save.isPending}
        direction={direction}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="team-shift-start">{t("teamHoursStart")}</Label>
              <Input id="team-shift-start" type="time" value={times.start} onChange={(event) => setTimes((previous) => ({ ...previous, start: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="team-shift-end">{t("teamHoursEnd")}</Label>
              <Input id="team-shift-end" type="time" value={times.end} onChange={(event) => setTimes((previous) => ({ ...previous, end: event.target.value }))} />
            </div>
          </div>
          {times.start && times.end && (
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-muted-foreground text-sm">{t("teamHoursLength")}</div>
              <Duration minutes={editedMinutes} className="text-lg font-semibold" />
              {(toMinutes(times.end) ?? 0) < (toMinutes(times.start) ?? 0) && (
                <div className="mt-1 text-xs text-amber-700 dark:text-amber-400">{t("teamHoursEndsNextDay")}</div>
              )}
            </div>
          )}
        </div>
      </CustomModal>
    </ol>
  );
}

const PRESETS: Preset[] = ["thisMonth", "lastMonth", "thisYear"];
const PRESET_LABELS: Record<Preset, string> = { thisMonth: "teamHoursThisMonth", lastMonth: "teamHoursLastMonth", thisYear: "teamHoursThisYear" };

/** A manager's view of how long each worker worked in a period, from the first of this month by default. */
export function TeamHoursDashboard({ users, canEditShifts = false }: { users: User[]; canEditShifts?: boolean }) {
  const { t } = useTranslation();
  const { direction, locale } = useAppLocale();
  const [range, setRange] = useState(() => presetRange("thisMonth"));
  const [showIdle, setShowIdle] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const toggle = (userId: number) =>
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  const activePreset = PRESETS.find((preset) => {
    const candidate = presetRange(preset);
    return candidate.from === range.from && candidate.to === range.to;
  });
  const userIds = useMemo(() => users.map((user) => user.id!).filter(Boolean), [users]);
  const validRange = Boolean(range.from && range.to && range.from <= range.to);

  const summary = useQuery({
    queryKey: ["worker-stats", "team-summary", userIds, range.from, range.to],
    enabled: userIds.length > 0 && validRange,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const response = await apiClient.getTeamWorkSummary(userIds, range.from, range.to);
      if (response.error) throw new Error(response.error);
      return (response.data || []) as WorkerHours[];
    },
  });

  const rows = useMemo(() => {
    const byUser = new Map((summary.data || []).map((row) => [row.user_id, row]));
    return users
      .filter((user) => byUser.has(user.id!))
      .map((user) => ({ user, hours: byUser.get(user.id!)! }))
      .sort((a, b) => b.hours.total_minutes - a.hours.total_minutes || (a.user.full_name || a.user.username).localeCompare(b.user.full_name || b.user.username));
  }, [summary.data, users]);
  const maxMinutes = Math.max(1, ...rows.map((row) => row.hours.total_minutes));
  const totalMinutes = rows.reduce((sum, row) => sum + row.hours.total_minutes, 0);
  const totalShifts = rows.reduce((sum, row) => sum + row.hours.shifts, 0);
  const workedCount = rows.filter((row) => row.hours.shifts > 0).length;
  // Workers without shifts fold into one line, so the people who worked stay in view.
  const idleCount = rows.length - workedCount;
  const shownRows = showIdle ? rows : rows.filter((row) => row.hours.shifts > 0);
  const today = isoDate(new Date());
  const rangeIncludesToday = range.from <= today && today <= range.to;

  const dateLocale = locale === "fr" ? "fr-FR" : locale === "en" ? "en-US" : "he-IL";
  const formatDate = (value: string) => (value ? new Date(`${value}T12:00:00`).toLocaleDateString(dateLocale) : "");

  const tiles = [
    { icon: IconClock, label: t("teamHoursTotal"), value: <Duration minutes={totalMinutes} />, strong: true },
    { icon: IconCalendar, label: t("teamHoursShifts"), value: String(totalShifts) },
    { icon: IconUsers, label: t("teamHoursActiveWorkers"), value: `${workedCount}/${rows.length || users.length}` },
  ];

  return (
    <Card dir={direction}>
      <CardHeader className="gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="text-start">
            <CardTitle>{t("teamHoursTitle")}</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              {t("teamHoursSubtitle", { from: formatDate(range.from), to: formatDate(range.to) })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" className="bg-muted inline-flex rounded-lg p-0.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={activePreset === preset}
                  onClick={() => setRange(presetRange(preset))}
                  className={`rounded-md px-3 py-1 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                    activePreset === preset ? "bg-background text-foreground font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t(PRESET_LABELS[preset])}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground text-sm">{t("teamHoursFrom")}</span>
              <DateInput name="team_hours_from" aria-label={t("teamHoursFrom")} value={range.from} onChange={(event) => setRange((previous) => ({ ...previous, from: event.target.value }))} className="w-40 text-center" dir="ltr" />
              <span className="text-muted-foreground text-sm">{t("teamHoursTo")}</span>
              <DateInput name="team_hours_to" aria-label={t("teamHoursTo")} value={range.to} onChange={(event) => setRange((previous) => ({ ...previous, to: event.target.value }))} className="w-40 text-center" dir="ltr" />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid grid-cols-3 gap-3">
          {tiles.map(({ icon: Icon, label, value, strong }) => (
            <div key={label} className={`rounded-lg p-3 text-center ${strong ? "border-primary border" : "bg-accent/70"}`}>
              <div className="text-muted-foreground flex items-center justify-center gap-1.5 text-xs">
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </div>
              {summary.isLoading ? (
                <Skeleton className="mx-auto mt-1.5 h-7 w-16" />
              ) : (
                <div className={`mt-1 text-2xl font-bold tabular-nums ${strong ? "" : "text-primary"}`}>{value}</div>
              )}
            </div>
          ))}
        </div>

        {summary.isError ? (
          <p className="text-muted-foreground py-6 text-center text-sm">{t("teamHoursLoadError")}</p>
        ) : summary.isLoading ? (
          <div className="space-y-2">
            {users.slice(0, 4).map((user) => <Skeleton key={user.id} className="h-14 w-full rounded-lg" />)}
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {shownRows.map(({ user, hours }) => {
              const name = user.full_name || user.username;
              const worked = hours.shifts > 0;
              const isOpen = worked && expanded.has(user.id!);
              return (
                <li key={user.id}>
                  <button
                    type="button"
                    disabled={!worked}
                    aria-expanded={worked ? isOpen : undefined}
                    onClick={() => toggle(user.id!)}
                    aria-label={t("teamHoursShowShifts", { name })}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-start transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset disabled:cursor-default ${isOpen ? "bg-muted/40" : "hover:bg-muted/50"}`}
                  >
                    <span className="bg-muted flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold">
                      {user.profile_picture ? <img src={user.profile_picture} alt="" className="size-full object-cover" /> : name.charAt(0).toUpperCase()}
                    </span>
                    <span className="w-40 min-w-0 shrink-0">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate font-medium">{name}</span>
                        {hours.open_shifts > 0 && rangeIncludesToday && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-1.5 text-[10px] leading-4 font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                            {t("teamHoursOnShift")}
                          </span>
                        )}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {worked
                          ? `${t("teamHoursShiftCount", { count: hours.shifts })} · ${t("teamHoursDayCount", { count: hours.active_days })}`
                          : t("teamHoursNoShifts")}
                      </span>
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="bg-muted h-2 overflow-hidden rounded-full">
                        <span
                          className="bg-primary block h-full rounded-full transition-[width] duration-500"
                          style={{ width: `${worked ? Math.max(2, (hours.total_minutes / maxMinutes) * 100) : 0}%` }}
                        />
                      </span>
                      {worked && (
                        <span className="text-muted-foreground text-[11px]">
                          {t("teamHoursAverage", { value: formatDuration(t, hours.total_minutes / hours.shifts) })}
                        </span>
                      )}
                    </span>
                    <span className="flex w-24 shrink-0 flex-col items-center leading-tight">
                      <span className="text-muted-foreground text-[10px]">{t("teamHoursTotalTime")}</span>
                      <Duration minutes={hours.total_minutes} className={`text-lg font-bold ${worked ? "" : "text-muted-foreground/60"}`} />
                    </span>
                    <IconChevronDown
                      aria-hidden="true"
                      className={`text-muted-foreground size-4 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""} ${worked ? "" : "invisible"}`}
                    />
                  </button>
                  {isOpen && <WorkerShifts userId={user.id!} from={range.from} to={range.to} canEdit={canEditShifts} />}
                </li>
              );
            })}
            {idleCount > 0 && (
              <li>
                <button
                  type="button"
                  aria-expanded={showIdle}
                  onClick={() => setShowIdle((value) => !value)}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted/50 flex w-full items-center justify-center gap-1.5 px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
                >
                  <IconChevronDown className={`size-4 transition-transform duration-200 ${showIdle ? "rotate-180" : ""}`} aria-hidden="true" />
                  {t(showIdle ? "teamHoursHideIdle" : "teamHoursShowIdle", { count: idleCount })}
                </button>
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
