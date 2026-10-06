import * as React from "react";
import { useRouter, useSearch } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import {
  AnalyticsChartTooltip,
  AnalyticsMetricCard,
  AnalyticsPanel,
  AnalyticsRangePicker,
  AnalyticsTooltip,
  RankedMetricTable,
} from "@/components/analytics";
import { ListPageHeader } from "@/components/list-page-header";
import { SiteHeader } from "@/components/site-header";
import { Progress } from "@/components/ui/progress";
import { useAnalyticsRange } from "@/hooks/useAnalyticsRange";
import { apiClient } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import { useAppLocale } from "@/localization/use-app-locale";
import { rangeForPreset, type AnalyticsRange, type CompanyAnalyticsResponse } from "@/lib/analytics";
import type { Clinic, Company, User } from "@/lib/db/schema-interface";
import { useIsMobile } from "@/hooks/use-mobile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MobileCompanyDashboard } from "@/pages/control-center/MobileCompanyDashboard";
import { useTranslation } from "react-i18next";

const integerFormatter = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
const ORDER_MIX_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];
const ANALYTICS_CACHE_TTL_MS = 60_000;
const analyticsCache = new Map<string, { data: CompanyAnalyticsResponse; expiresAt: number }>();

function analyticsCacheKey(companyId: number, range: AnalyticsRange, currency?: string, clinicId?: number) {
  return [companyId, range.startDate, range.endDate, range.bucket, currency || "ILS", clinicId || "all"].join(":");
}

function parseStored<T>(value: string | null): T | null {
  if (!value || value === "undefined") return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export default function ControlCenterDashboardPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const search = useSearch({ from: "/control-center/dashboard" });
  const { range, setRange } = useAnalyticsRange("30d");
  const { locale, direction } = useAppLocale();
  const isMobile = useIsMobile();
  const [company, setCompany] = React.useState<Company | null>(() =>
    parseStored<Company>(localStorage.getItem("controlCenterCompany")),
  );
  const [data, setData] = React.useState<CompanyAnalyticsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [clinics, setClinics] = React.useState<Clinic[]>([]);
  const [clinicsLoading, setClinicsLoading] = React.useState(true);
  const [selectedClinicId, setSelectedClinicId] = React.useState("all");
  const [weeklyData, setWeeklyData] = React.useState<CompanyAnalyticsResponse | null>(null);
  const [weeklyLoading, setWeeklyLoading] = React.useState(true);

  React.useEffect(() => {
    if (company?.id) return;
    const companyId = Number(search.companyId || 0);
    const user = parseStored<User>(localStorage.getItem("currentUser"));
    if (!companyId || !user) {
      void router.navigate({ to: "/control-center" });
      return;
    }
    void apiClient.getCompany(companyId).then((response) => {
      if (!response.data) {
        void router.navigate({ to: "/control-center" });
        return;
      }
      localStorage.setItem("controlCenterCompany", JSON.stringify(response.data));
      setCompany(response.data);
    });
  }, [company?.id, router, search.companyId]);

  React.useEffect(() => {
    if (!company?.id) return;
    let cancelled = false;
    setClinicsLoading(true);
    void apiClient.getControlCenterClinics(company.id).then((response) => {
      if (cancelled) return;
      setClinics(((response.data as { clinics?: Clinic[] } | undefined)?.clinics || []).filter((clinic) => clinic.id));
      setClinicsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [company?.id]);

  React.useEffect(() => {
    if (!company?.id) return;
    const clinicId = selectedClinicId === "all" ? undefined : Number(selectedClinicId);
    const cacheKey = analyticsCacheKey(company.id, range, company.default_currency, clinicId);
    const cached = analyticsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      setData(cached.data);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void apiClient.getControlCenterAnalytics(company.id, range, clinicId).then((response) => {
      if (cancelled) return;
      if (response.error || !response.data) {
        setError(String(response.error || "טעינת הנתונים נכשלה"));
        setData(null);
      } else {
        analyticsCache.set(cacheKey, {
          data: response.data,
          expiresAt: Date.now() + ANALYTICS_CACHE_TTL_MS,
        });
        setData(response.data);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [company?.default_currency, company?.id, range, selectedClinicId]);

  React.useEffect(() => {
    if (!company?.id) return;
    const weeklyRange = rangeForPreset("7d");
    const clinicId = selectedClinicId === "all" ? undefined : Number(selectedClinicId);
    const cacheKey = analyticsCacheKey(company.id, weeklyRange, company.default_currency, clinicId);
    const cached = analyticsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      setWeeklyData(cached.data);
      setWeeklyLoading(false);
      return;
    }
    let cancelled = false;
    setWeeklyLoading(true);
    void apiClient.getControlCenterAnalytics(company.id, weeklyRange, clinicId).then((response) => {
      if (cancelled) return;
      if (response.data) {
        analyticsCache.set(cacheKey, { data: response.data, expiresAt: Date.now() + ANALYTICS_CACHE_TTL_MS });
        setWeeklyData(response.data);
      } else {
        setWeeklyData(null);
      }
      setWeeklyLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [company?.default_currency, company?.id, selectedClinicId]);

  const formatCurrency = React.useCallback(
    (value: number) => formatMoney(value, data?.currency || company?.default_currency, locale, { maximumFractionDigits: 0 }),
    [company?.default_currency, data?.currency, locale],
  );

  const metrics = React.useMemo(
    () => new Map((data?.metrics || []).map((metric) => [metric.key, metric])),
    [data?.metrics],
  );
  const financialSeries = React.useMemo(() => [...(data?.financial_series || [])].reverse(), [data?.financial_series]);
  const activitySeries = React.useMemo(() => [...(data?.activity.series || [])].reverse(), [data?.activity.series]);
  const orderMixTotal = React.useMemo(
    () => (data?.order_mix || []).reduce((total, item) => total + item.count, 0),
    [data?.order_mix],
  );

  const clinicSelector = (
    <Select value={selectedClinicId} onValueChange={setSelectedClinicId} disabled={clinicsLoading} clearable={false}>
      <SelectTrigger className="w-52" aria-label={t("mobileDashboardClinicFilter")}>
        <SelectValue placeholder={t("mobileDashboardAllClinics")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{t("mobileDashboardAllClinics")}</SelectItem>
        {clinics.map((clinic) => <SelectItem key={clinic.id} value={String(clinic.id)}>{clinic.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
  const selectedClinic = clinics.find((clinic) => String(clinic.id) === selectedClinicId);

  if (isMobile) {
    return (
      <>
        <SiteHeader title={t("dashboard")} />
        <MobileCompanyDashboard
          company={company}
          clinics={clinics}
          clinicsLoading={clinicsLoading}
          selectedClinicId={selectedClinicId}
          onClinicChange={setSelectedClinicId}
          range={range}
          onRangeChange={setRange}
          data={data}
          weeklyData={weeklyData}
          loading={loading}
          weeklyLoading={weeklyLoading}
          error={error}
          formatCurrency={formatCurrency}
        />
      </>
    );
  }

  return (
    <>
      <SiteHeader title={t("dashboard")} />
      <main className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6" dir={direction}>
        <div className="mx-auto max-w-[1600px] space-y-5">
          <ListPageHeader
            title={selectedClinic
              ? t("mobileDashboardClinicSubtitle", { clinic: selectedClinic.name })
              : t("mobileDashboardSubtitle")}
            titleClassName="text-lg text-muted-foreground"
            className="mb-0 items-center pb-2"
            actions={
              <div className="flex items-center gap-2">
                {clinicSelector}
                <AnalyticsRangePicker value={range} onChange={setRange} disabled={loading} />
              </div>
            }
          />

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <AnalyticsMetricCard metric={metrics.get("sales")} formatter={formatCurrency} loading={loading} error={Boolean(error)} polarity="higher" />
            <AnalyticsMetricCard metric={metrics.get("collected")} formatter={formatCurrency} loading={loading} error={Boolean(error)} polarity="higher" />
            <AnalyticsMetricCard metric={metrics.get("outstanding")} formatter={formatCurrency} loading={loading} error={Boolean(error)} polarity="lower" />
            <AnalyticsMetricCard metric={metrics.get("aov")} formatter={formatCurrency} loading={loading} error={Boolean(error)} polarity="higher" />
            <AnalyticsMetricCard metric={metrics.get("orders")} formatter={integerFormatter.format} loading={loading} error={Boolean(error)} polarity="higher" />
          </section>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(360px,0.8fr)]">
            <AnalyticsPanel
              title="מכירות מול גבייה"
              description="מכירות לפי תאריך ההזמנה ותשלומים לפי מועד הגבייה"
              loading={loading}
              error={Boolean(error)}
              empty={!data?.financial_series.length}
            >
              <div className="h-64" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={financialSeries} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={10} fontSize={12} />
                    <YAxis orientation="right" axisLine={false} tickLine={false} width={54} tickFormatter={(value) => integerFormatter.format(value)} fontSize={12} />
                    <AnalyticsChartTooltip content={<AnalyticsTooltip />} />
                    <Legend verticalAlign="bottom" height={28} wrapperStyle={{ direction: "rtl" }} />
                    <Bar dataKey="sales" name="מכירות" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="collected" name="גבייה" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </AnalyticsPanel>

            <AnalyticsPanel title="תמהיל הזמנות" description="חלוקת ההזמנות המחויבות בטווח" loading={loading} error={Boolean(error)} empty={!data?.order_mix.length}>
              <div className="grid h-64 grid-cols-[minmax(0,1fr)_minmax(120px,0.8fr)] items-center gap-3" dir="rtl">
                <div className="min-w-0 space-y-2">
                  {(data?.order_mix || []).map((item, index) => (
                    <div key={item.type} className="flex min-w-0 items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: ORDER_MIX_COLORS[index % ORDER_MIX_COLORS.length] }} />
                        <span className="truncate" title={item.type}>{item.type}</span>
                      </span>
                      <span className="shrink-0 text-muted-foreground tabular-nums" dir="ltr">
                        {integerFormatter.format(item.count)} · {orderMixTotal ? Math.round((item.count / orderMixTotal) * 100) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
                <div className="relative h-48 min-w-0" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data?.order_mix || []}
                        dataKey="count"
                        nameKey="type"
                        cx="50%"
                        cy="50%"
                        innerRadius="57%"
                        outerRadius="82%"
                        paddingAngle={2}
                        stroke="hsl(var(--card))"
                        strokeWidth={2}
                        isAnimationActive={false}
                      >
                        {(data?.order_mix || []).map((item, index) => (
                          <Cell key={item.type} fill={ORDER_MIX_COLORS[index % ORDER_MIX_COLORS.length]} />
                        ))}
                      </Pie>
                      <AnalyticsChartTooltip content={<AnalyticsTooltip />} wrapperStyle={{ zIndex: 10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center">
                    <strong className="text-xl leading-none tabular-nums">{integerFormatter.format(orderMixTotal)}</strong>
                    <span className="mt-1 text-[11px] text-muted-foreground">הזמנות</span>
                  </div>
                </div>
              </div>
            </AnalyticsPanel>
          </div>

          <AnalyticsPanel flat title="ביצועים לפי מרפאה" description="דירוג פיננסי והשוואת חלק יחסי מהמכירות" loading={loading} error={Boolean(error)} empty={!data?.clinic_ranking.length}>
            <RankedMetricTable
              rows={data?.clinic_ranking || []}
              getKey={(row) => row.clinic_id}
              columns={[
                { key: "clinic", label: "מרפאה לפי ביצועים", render: (row) => <span className="font-medium">{row.clinic_name}</span> },
                { key: "sales", label: "מכירות", render: (row) => formatCurrency(row.sales), className: "tabular-nums" },
                { key: "collected", label: "נגבה", render: (row) => formatCurrency(row.collected), className: "tabular-nums" },
                { key: "outstanding", label: "יתרה פתוחה", render: (row) => formatCurrency(row.outstanding), className: "tabular-nums" },
                { key: "orders", label: "הזמנות", render: (row) => integerFormatter.format(row.orders), className: "tabular-nums" },
                {
                  key: "share",
                  label: "% מהמכירות",
                  className: "w-56",
                  render: (row) => (
                    <div className="flex items-center gap-3" dir="rtl">
                      <span className="w-11 text-start text-sm tabular-nums" dir="ltr">{row.share}%</span>
                      <Progress value={row.share} className="h-1.5 flex-1 rotate-180" />
                    </div>
                  ),
                },
              ]}
            />
          </AnalyticsPanel>

          <div className="grid items-start gap-4 xl:grid-cols-2">
            <AnalyticsPanel title="פעילות עסקית" description="תורים ולקוחות חדשים לאורך הטווח" loading={loading} error={Boolean(error)} empty={!data?.activity.series.length}>
              <div className="h-64" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activitySeries} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={10} fontSize={12} />
                    <YAxis orientation="right" axisLine={false} tickLine={false} allowDecimals={false} width={38} />
                    <AnalyticsChartTooltip content={<AnalyticsTooltip />} />
                    <Legend verticalAlign="bottom" height={28} wrapperStyle={{ direction: "rtl" }} />
                    <Line type="monotone" dataKey="appointments" name="תורים" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    <Line
                      type="monotone"
                      dataKey="new_clients"
                      name="לקוחות חדשים"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2.5}
                      strokeDasharray="6 4"
                      dot={{ r: 2.5, fill: "hsl(var(--card))", stroke: "hsl(var(--chart-2))", strokeWidth: 2 }}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </AnalyticsPanel>

            <AnalyticsPanel flat title="מוצרים מובילים" description="לפי מכירות בפריטי החיוב" loading={loading} error={Boolean(error)} empty={!data?.top_products.length}>
              <RankedMetricTable
                rows={data?.top_products || []}
                getKey={(row) => `${row.name}-${row.sku || ""}`}
                columns={[
                  { key: "name", label: "מוצרים מובילים לפי מכירות", render: (row) => <div><p className="font-medium">{row.name}</p>{row.sku ? <p className="text-xs text-muted-foreground" dir="ltr">{row.sku}</p> : null}</div> },
                  { key: "quantity", label: "כמות", render: (row) => integerFormatter.format(row.quantity), className: "tabular-nums" },
                  { key: "sales", label: "מכירות", render: (row) => formatCurrency(row.sales), className: "tabular-nums" },
                ]}
              />
            </AnalyticsPanel>
          </div>
        </div>
      </main>
    </>
  );
}
