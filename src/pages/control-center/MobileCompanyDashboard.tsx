import * as React from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
} from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip } from "recharts";
import { useTranslation } from "react-i18next";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  analyticsTrendTone,
  rangeForPreset,
  type AnalyticsMetric,
  type AnalyticsPreset,
  type AnalyticsRange,
  type CompanyAnalyticsResponse,
} from "@/lib/analytics";
import type { Clinic, Company } from "@/lib/db/schema-interface";
import { cn } from "@/lib/utils";
import { useAppLocale } from "@/localization/use-app-locale";

type MobileCompanyDashboardProps = {
  company: Company | null;
  clinics: Clinic[];
  clinicsLoading: boolean;
  selectedClinicId: string;
  onClinicChange: (clinicId: string) => void;
  range: AnalyticsRange;
  onRangeChange: (range: AnalyticsRange) => void;
  data: CompanyAnalyticsResponse | null;
  weeklyData: CompanyAnalyticsResponse | null;
  loading: boolean;
  weeklyLoading: boolean;
  error: string | null;
  formatCurrency: (value: number) => string;
};

function ChangeBadge({ metric }: { metric?: AnalyticsMetric }) {
  const { t } = useTranslation();
  if (!metric || metric.change_percent === null) {
    return <span className="text-muted-foreground text-xs">{t("mobileDashboardNoComparison")}</span>;
  }

  const tone = analyticsTrendTone(metric.value, metric.previous, "higher");
  const Icon = metric.change_percent >= 0 ? ArrowUpRight : ArrowDownLeft;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
        tone === "positive"
          ? "text-emerald-600 dark:text-emerald-400"
          : tone === "negative"
            ? "text-rose-600 dark:text-rose-400"
            : "text-muted-foreground",
      )}
      dir="ltr"
    >
      <Icon className="size-3" />
      {Math.abs(metric.change_percent).toLocaleString(undefined, {
        maximumFractionDigits: 1,
      })}
      %
    </span>
  );
}

function MetricCard({
  label,
  value,
  metric,
  loading,
  featured,
}: {
  label: string;
  value: string;
  metric?: AnalyticsMetric;
  loading: boolean;
  featured?: boolean;
}) {
  return (
    <Card className={cn("gap-0 rounded-xl py-0 shadow-none", featured && "col-span-2")}>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-muted-foreground truncate text-xs font-medium">{label}</p>
        </div>
        {loading ? (
          <>
            <Skeleton className="mb-2 h-7 w-24" />
            <Skeleton className="h-3 w-16" />
          </>
        ) : (
          <>
            <p className="truncate text-2xl leading-none font-semibold tracking-tight tabular-nums" dir="ltr">
              {value}
            </p>
            <div className="mt-2 h-4">
              <ChangeBadge metric={metric} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function MobileCompanyDashboard({
  company,
  clinics,
  clinicsLoading,
  selectedClinicId,
  onClinicChange,
  range,
  onRangeChange,
  data,
  weeklyData,
  loading,
  weeklyLoading,
  error,
  formatCurrency,
}: MobileCompanyDashboardProps) {
  const { t } = useTranslation();
  const { locale } = useAppLocale();
  const compactNumber = React.useMemo(
    () => new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }),
    [locale],
  );
  const metrics = React.useMemo(
    () => new Map((data?.metrics || []).map((metric) => [metric.key, metric])),
    [data?.metrics],
  );
  const activityMetric = React.useCallback(
    (key: "appointments" | "new_clients", value: number, previous: number): AnalyticsMetric => ({
      key,
      label: key,
      value,
      previous,
      change_percent: previous === 0 ? null : ((value - previous) / previous) * 100,
      series: [],
    }),
    [],
  );
  const appointmentsMetric = activityMetric(
    "appointments",
    weeklyData?.activity.appointments || 0,
    weeklyData?.activity.previous_appointments || 0,
  );
  const newClientsMetric = activityMetric(
    "new_clients",
    weeklyData?.activity.new_clients || 0,
    weeklyData?.activity.previous_new_clients || 0,
  );
  const selectedClinic = clinics.find((clinic) => String(clinic.id) === selectedClinicId);
  const scopeName = selectedClinic?.name || t("mobileDashboardAllClinics");
  const sales = metrics.get("sales")?.value || 0;
  const collected = metrics.get("collected")?.value || 0;
  const collectionRate = sales > 0 ? Math.min(100, Math.round((collected / sales) * 100)) : 0;
  const activitySeries = [...(weeklyData?.activity.series || [])].reverse();
  const presets: Exclude<AnalyticsPreset, "custom">[] = ["7d", "30d", "90d", "365d"];

  return (
    <main className="bg-muted/40 min-h-0 flex-1 overflow-y-auto" aria-label={t("mobileDashboardTitle")}>
      <div className="mx-auto max-w-xl space-y-4 px-4 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <section className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium tracking-wide">
            {company?.name || t("controlCenter")}
          </p>
          <h1 className="text-foreground text-xl font-semibold tracking-tight">
            {t("mobileDashboardGreeting")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {selectedClinic
              ? t("mobileDashboardClinicSubtitle", { clinic: selectedClinic.name })
              : t("mobileDashboardSubtitle")}
          </p>
        </section>

        <Select
          value={selectedClinicId}
          onValueChange={onClinicChange}
          disabled={clinicsLoading}
          clearable={false}
        >
          <SelectTrigger className="h-12 rounded-xl px-3 shadow-none" aria-label={t("mobileDashboardClinicFilter")}>
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="bg-primary/8 text-primary grid size-8 shrink-0 place-items-center rounded-lg">
                <Building2 className="size-4" />
              </span>
              <span className="min-w-0 text-start">
                <span className="text-muted-foreground block text-[10px] leading-3">
                  {t("mobileDashboardViewing")}
                </span>
                <SelectValue placeholder={t("mobileDashboardAllClinics")} />
              </span>
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("mobileDashboardAllClinics")}</SelectItem>
            {clinics.map((clinic) => (
              <SelectItem key={clinic.id} value={String(clinic.id)}>
                {clinic.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="no-scrollbar -mx-4 overflow-x-auto px-4" aria-label={t("mobileDashboardPeriod")}>
          <div className="bg-card flex w-max min-w-full items-center gap-1 rounded-xl border p-1">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onRangeChange(rangeForPreset(preset))}
                disabled={loading}
                className={cn(
                  "min-w-[68px] flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                  range.preset === preset
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {t(`mobileDashboardRange${preset}`)}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="border-destructive/25 bg-destructive/5 text-destructive rounded-xl border p-3 text-sm">
            {t("mobileDashboardLoadError")}
          </div>
        ) : null}

        <section className="grid grid-cols-2 gap-3" aria-label={t("mobileDashboardKeyMetrics")}>
          <MetricCard
            featured
            label={t("mobileDashboardSales")}
            value={formatCurrency(metrics.get("sales")?.value || 0)}
            metric={metrics.get("sales")}
            loading={loading}
          />
          <MetricCard
            label={t("mobileDashboardCollected")}
            value={formatCurrency(metrics.get("collected")?.value || 0)}
            metric={metrics.get("collected")}
            loading={loading}
          />
          <MetricCard
            label={t("mobileDashboardOrders")}
            value={compactNumber.format(metrics.get("orders")?.value || 0)}
            metric={metrics.get("orders")}
            loading={loading}
          />
          <MetricCard
            label={t("mobileDashboardAppointmentsWeek")}
            value={compactNumber.format(weeklyData?.activity.appointments || 0)}
            metric={appointmentsMetric}
            loading={weeklyLoading}
          />
          <MetricCard
            label={t("mobileDashboardNewClientsWeek")}
            value={compactNumber.format(weeklyData?.activity.new_clients || 0)}
            metric={newClientsMetric}
            loading={weeklyLoading}
          />
        </section>

        <Card className="gap-0 rounded-xl py-0 shadow-none">
          <CardContent className="p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">{t("mobileDashboardWeeklyActivity")}</h2>
                <p className="text-muted-foreground mt-0.5 text-xs">{scopeName}</p>
              </div>
              {!weeklyLoading && (
                <span className="bg-primary/8 text-primary rounded-md px-2 py-1 text-xs font-semibold tabular-nums">
                  {weeklyData?.activity.appointments || 0}
                </span>
              )}
            </div>
            {weeklyLoading ? (
              <Skeleton className="h-36 w-full" />
            ) : activitySeries.length ? (
              <div className="h-36" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activitySeries} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted))", radius: 6 }}
                      contentStyle={{
                        borderRadius: 8,
                        borderColor: "hsl(var(--border))",
                        background: "hsl(var(--popover))",
                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey="appointments"
                      name={t("appointments")}
                      fill="hsl(var(--primary))"
                      radius={[5, 5, 2, 2]}
                      maxBarSize={24}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-muted-foreground grid h-36 place-items-center text-sm">
                {t("mobileDashboardNoActivity")}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="gap-0 rounded-xl py-0 shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold">{t("mobileDashboardCollectionRate")}</h2>
                <p className="text-muted-foreground mt-0.5 text-xs">{t("mobileDashboardOfSales")}</p>
              </div>
              <strong className="text-xl tabular-nums" dir="ltr">{collectionRate}%</strong>
            </div>
            <Progress value={collectionRate} className="mt-4 h-2" />
            <div className="text-muted-foreground mt-2 flex justify-between text-xs tabular-nums">
              <span>{formatCurrency(collected)}</span>
              <span>{formatCurrency(sales)}</span>
            </div>
          </CardContent>
        </Card>

        {selectedClinicId === "all" ? (
          <Card className="gap-0 rounded-xl py-0 shadow-none">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">{t("mobileDashboardClinicPerformance")}</h2>
                <span className="text-muted-foreground text-xs">{clinics.length}</span>
              </div>
              <div className="divide-y">
                {(data?.clinic_ranking || []).slice(0, 5).map((clinic, index) => (
                  <div key={clinic.clinic_id} className="flex items-center gap-3 py-3 first:pt-1 last:pb-0">
                    <span className="bg-muted text-muted-foreground grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{clinic.clinic_name}</p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {t("mobileDashboardOrdersCount", { count: clinic.orders })}
                      </p>
                    </div>
                    <div className="shrink-0 text-end">
                      <p className="text-sm font-semibold tabular-nums" dir="ltr">{formatCurrency(clinic.sales)}</p>
                      <p className="text-muted-foreground text-xs tabular-nums" dir="ltr">{clinic.share}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
