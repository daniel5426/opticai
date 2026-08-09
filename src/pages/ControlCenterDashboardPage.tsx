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
import type { CompanyAnalyticsResponse } from "@/lib/analytics";
import type { Company, User } from "@/lib/db/schema-interface";

const currencyFormatter = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});
const integerFormatter = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
const ORDER_MIX_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function parseStored<T>(value: string | null): T | null {
  if (!value || value === "undefined") return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export default function ControlCenterDashboardPage() {
  const router = useRouter();
  const search = useSearch({ from: "/control-center/dashboard" });
  const { range, setRange } = useAnalyticsRange("30d");
  const [company, setCompany] = React.useState<Company | null>(() =>
    parseStored<Company>(localStorage.getItem("controlCenterCompany")),
  );
  const [data, setData] = React.useState<CompanyAnalyticsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

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
    setLoading(true);
    setError(null);
    void apiClient.getControlCenterAnalytics(company.id, range).then((response) => {
      if (cancelled) return;
      if (response.error || !response.data) {
        setError(String(response.error || "טעינת הנתונים נכשלה"));
        setData(null);
      } else {
        setData(response.data);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [company?.id, range]);

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

  return (
    <>
      <SiteHeader title="לוח בקרה" />
      <main className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6" dir="rtl">
        <div className="mx-auto max-w-[1600px] space-y-5">
          <ListPageHeader
            title="תמונה פיננסית ותפעולית מאוחדת לכל המרפאות"
            className="mb-0 items-center pb-2"
            actions={<AnalyticsRangePicker value={range} onChange={setRange} disabled={loading} />}
          />

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <AnalyticsMetricCard metric={metrics.get("sales")} formatter={currencyFormatter.format} loading={loading} error={Boolean(error)} polarity="higher" />
            <AnalyticsMetricCard metric={metrics.get("collected")} formatter={currencyFormatter.format} loading={loading} error={Boolean(error)} polarity="higher" />
            <AnalyticsMetricCard metric={metrics.get("outstanding")} formatter={currencyFormatter.format} loading={loading} error={Boolean(error)} polarity="lower" />
            <AnalyticsMetricCard metric={metrics.get("aov")} formatter={currencyFormatter.format} loading={loading} error={Boolean(error)} polarity="higher" />
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
                { key: "sales", label: "מכירות", render: (row) => currencyFormatter.format(row.sales), className: "tabular-nums" },
                { key: "collected", label: "נגבה", render: (row) => currencyFormatter.format(row.collected), className: "tabular-nums" },
                { key: "outstanding", label: "יתרה פתוחה", render: (row) => currencyFormatter.format(row.outstanding), className: "tabular-nums" },
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
                  { key: "sales", label: "מכירות", render: (row) => currencyFormatter.format(row.sales), className: "tabular-nums" },
                ]}
              />
            </AnalyticsPanel>
          </div>
        </div>
      </main>
    </>
  );
}
