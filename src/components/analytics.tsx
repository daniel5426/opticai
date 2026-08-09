import * as React from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ANALYTICS_PRESETS,
  analyticsChangeLabel,
  analyticsTrendTone,
  normalizeAnalyticsRange,
  rangeForPreset,
  type AnalyticsMetric,
  type AnalyticsPolarity,
  type AnalyticsPreset,
  type AnalyticsRange,
} from "@/lib/analytics";
import { cn } from "@/lib/utils";

export function AnalyticsRangePicker({
  value,
  onChange,
  disabled,
}: {
  value: AnalyticsRange;
  onChange: (range: AnalyticsRange) => void;
  disabled?: boolean;
}) {
  const [customOpen, setCustomOpen] = React.useState(false);
  const [from, setFrom] = React.useState(value.startDate);
  const [to, setTo] = React.useState(value.endDate);

  React.useEffect(() => {
    setFrom(value.startDate);
    setTo(value.endDate);
  }, [value.endDate, value.startDate]);

  const applyCustom = () => {
    const next = normalizeAnalyticsRange("custom", from, to, "30d");
    if (next.preset !== "custom") return;
    onChange(next);
    setCustomOpen(false);
  };

  return (
    <div className="bg-background flex h-9 items-center rounded-md border p-0.5" dir="rtl">
      {ANALYTICS_PRESETS.filter((item) => item.value !== "custom").map((item) => (
        <Button
          key={item.value}
          type="button"
          size="sm"
          variant="ghost"
          className={cn("h-8 rounded-[5px] px-2.5 font-normal", value.preset === item.value && "bg-muted font-medium")}
          disabled={disabled}
          onClick={() => onChange(rangeForPreset(item.value as Exclude<AnalyticsPreset, "custom">))}
        >
          {item.label}
        </Button>
      ))}
      <Popover open={customOpen} onOpenChange={setCustomOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn("h-8 rounded-[5px] px-2.5 font-normal", value.preset === "custom" && "bg-muted font-medium")}
            disabled={disabled}
          >
            טווח מותאם
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72" dir="rtl">
          <div className="space-y-3">
            <p className="text-sm font-medium">בחירת טווח תאריכים</p>
            <label className="grid gap-1.5 text-xs text-muted-foreground">
              מתאריך
              <Input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} />
            </label>
            <label className="grid gap-1.5 text-xs text-muted-foreground">
              עד תאריך
              <Input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} />
            </label>
            <Button className="w-full" disabled={!from || !to || from > to} onClick={applyCustom}>
              החל טווח
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

const toneClass = {
  positive: "text-emerald-600 dark:text-emerald-400",
  negative: "text-rose-600 dark:text-rose-400",
  neutral: "text-muted-foreground",
};

export function AnalyticsMetricCard({
  metric,
  formatter,
  polarity = "higher",
  loading,
  error,
  color = "hsl(var(--primary))",
}: {
  metric?: AnalyticsMetric;
  formatter: (value: number) => string;
  polarity?: AnalyticsPolarity;
  loading?: boolean;
  error?: boolean;
  color?: string;
}) {
  if (loading) {
    return (
      <Card className="gap-0 rounded-lg py-0 shadow-none">
        <CardContent className="grid h-28 grid-rows-[18px_1fr_18px] gap-1.5 p-4">
          <Skeleton className="h-4 w-24" />
          <div className="flex items-center justify-between gap-3"><Skeleton className="h-7 w-24" /><Skeleton className="h-9 w-20" /></div>
          <Skeleton className="h-3.5 w-32" />
        </CardContent>
      </Card>
    );
  }

  if (!metric) {
    return (
      <Card className="gap-0 rounded-lg py-0 shadow-none">
        <CardContent className="grid h-28 grid-rows-[18px_1fr_18px] gap-1.5 p-4 text-start" dir="rtl">
          <p className="truncate text-sm text-muted-foreground">נתון לא זמין</p>
          <p className="self-center text-2xl font-semibold text-muted-foreground">—</p>
          <p className="truncate text-xs text-muted-foreground">{error ? "אירעה שגיאה בטעינת הנתון" : "אין נתונים בטווח שנבחר"}</p>
        </CardContent>
      </Card>
    );
  }

  const tone = analyticsTrendTone(metric.value, metric.previous, polarity);
  const showComparison = !metric.snapshot;
  const comparison = showComparison
    ? `${analyticsChangeLabel(metric.value, metric.previous, metric.change_percent)} · מול התקופה הקודמת`
    : metric.context || "תמונת מצב נוכחית";
  return (
    <Card className="min-w-0 gap-0 rounded-lg py-0 shadow-none">
      <CardContent className="grid h-28 min-w-0 grid-rows-[18px_1fr_18px] gap-1.5 p-4 text-start" dir="rtl">
        <p className="truncate text-sm text-muted-foreground" title={metric.label}>{metric.label}</p>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <p className="min-w-0 truncate text-[clamp(1.35rem,1.8vw,1.75rem)] leading-none font-semibold tracking-tight tabular-nums" dir="ltr" title={formatter(metric.value)}>
            {formatter(metric.value)}
          </p>
        {metric.series.length > 1 ? (
          <div className="h-10 w-20 shrink-0" dir="ltr" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[...metric.series].reverse()} margin={{ top: 3, right: 1, bottom: 3, left: 1 }}>
                <Line type="monotone" dataKey="value" stroke={tone === "negative" ? "#f43f5e" : tone === "positive" ? "#10b981" : color} strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : null}
        </div>
        <p className={cn("truncate text-xs", showComparison ? toneClass[tone] : "text-muted-foreground")} title={comparison}>
          {comparison}
        </p>
      </CardContent>
    </Card>
  );
}

export function AnalyticsPanel({
  title,
  description,
  children,
  className,
  loading,
  empty,
  error,
  flat = false,
}: React.PropsWithChildren<{
  title: string;
  description?: string;
  className?: string;
  loading?: boolean;
  empty?: boolean;
  error?: boolean;
  flat?: boolean;
}>) {
  const content = loading ? (
    <Skeleton className="h-60 w-full" />
  ) : error ? (
    <div className="flex h-60 items-center justify-center text-sm text-destructive">אירעה שגיאה בטעינת הנתונים.</div>
  ) : empty ? (
    <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">אין נתונים להצגה בטווח שנבחר.</div>
  ) : children;

  if (flat) {
    const flatContent = loading || error ? content : children;

    return (
      <section className={cn("min-w-0", className)} dir="rtl" aria-label={title}>
        {flatContent}
      </section>
    );
  }

  return (
    <Card className={cn("gap-3 rounded-lg py-4 shadow-none", className)} dir="rtl">
      <CardHeader className="gap-1 px-4 pb-0 text-start">
        <CardTitle className="truncate text-base" title={title}>{title}</CardTitle>
        {description ? <p className="truncate text-sm text-muted-foreground" title={description}>{description}</p> : null}
      </CardHeader>
      <CardContent className="px-4">{content}</CardContent>
    </Card>
  );
}

export function AnalyticsTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover min-w-40 rounded-md border p-2.5 text-sm shadow-md" dir="rtl">
      <p className="mb-2 font-medium">{label}</p>
      <div className="space-y-1.5">
        {payload.map((item: any) => (
          <div key={item.dataKey} className="flex items-center justify-between gap-5">
            <span className="flex items-center gap-2 text-muted-foreground"><span className="size-2 rounded-full" style={{ background: item.color }} />{item.name}</span>
            <span className="font-medium tabular-nums" dir="ltr">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const AnalyticsChartTooltip = RechartsTooltip;

export interface RankedMetricColumn<T> {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

export function RankedMetricTable<T>({
  rows,
  columns,
  getKey,
  emptyLabel = "אין נתונים להצגה.",
}: {
  rows: T[];
  columns: RankedMetricColumn<T>[];
  getKey: (row: T) => React.Key;
  emptyLabel?: string;
}) {
  return (
    <Table className="min-w-[680px] bg-card" containerClassName="border-border bg-card" dir="rtl">
      <TableHeader><TableRow>{columns.map((column) => <TableHead key={column.key} className={column.className}>{column.label}</TableHead>)}</TableRow></TableHeader>
      <TableBody>
        {rows.map((row) => <TableRow key={getKey(row)}>{columns.map((column) => <TableCell key={column.key} className={column.className}>{column.render(row)}</TableCell>)}</TableRow>)}
        {!rows.length ? <TableRow><TableCell colSpan={columns.length} className="h-28 text-center text-muted-foreground">{emptyLabel}</TableCell></TableRow> : null}
      </TableBody>
    </Table>
  );
}
