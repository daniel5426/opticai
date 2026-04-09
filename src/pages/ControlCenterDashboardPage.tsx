import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearch } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  Building2,
  Calendar,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { Company, User } from "@/lib/db/schema-interface";
import { apiClient } from "@/lib/api-client";

type OverviewRange = "7d" | "30d" | "12m";

interface DashboardStats {
  totalClinics: number;
  activeClinics: number;
  totalUsers: number;
  totalAppointments: number;
  monthlyRevenue: number;
}

interface OverviewItem {
  bucket: string;
  label: string;
  appointments: number;
  new_clients: number;
  revenue: number;
}

const RANGE_OPTIONS: Array<{ value: OverviewRange; label: string }> = [
  { value: "7d", label: "7 ימים" },
  { value: "30d", label: "30 ימים" },
  { value: "12m", label: "12 חודשים" },
];

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary-foreground))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const currencyFormatter = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});

const integerFormatter = new Intl.NumberFormat("he-IL", {
  maximumFractionDigits: 0,
});

const compactFormatter = new Intl.NumberFormat("he-IL", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const heCollator = new Intl.Collator("he");

const getOverviewTicks = (data: OverviewItem[], range: OverviewRange) => {
  if (data.length === 0) return [];
  if (range === "7d") return data.map((item) => item.bucket);
  if (range === "30d") {
    return data
      .filter((_, index) => index === 0 || index === data.length - 1 || index % 5 === 0)
      .map((item) => item.bucket);
  }
  return data
    .filter((_, index) => index === 0 || index === data.length - 1 || index % 2 === 0)
    .map((item) => item.bucket);
};

const truncateLabel = (value: string, maxLength = 18) => {
  if (!value) return "ללא שם";
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
};

const sortClinicsByName = <T extends { clinic_name: string }>(items: T[]) =>
  [...items].sort((left, right) =>
    heCollator.compare(left.clinic_name || "", right.clinic_name || ""),
  );

const StatCard = ({
  title,
  value,
  meta,
  icon: Icon,
  loading,
}: {
  title: string;
  value: string;
  meta: string;
  icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
}) => (
  <Card className="shadow-none">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      {loading ? (
        <div className="space-y-1 mt-1">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
      ) : (
        <>
          <div className="text-2xl font-bold tabular-nums">{value}</div>
          <p className="text-xs text-muted-foreground mt-1">{meta}</p>
        </>
      )}
    </CardContent>
  </Card>
);

const ControlCenterDashboardPage: React.FC = () => {
  const router = useRouter();
  const search = useSearch({ from: "/control-center/dashboard" });

  const [company, setCompany] = useState<Company | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalClinics: 0,
    activeClinics: 0,
    totalUsers: 0,
    totalAppointments: 0,
    monthlyRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [overviewRange, setOverviewRange] = useState<OverviewRange>("30d");
  const [overview, setOverview] = useState<OverviewItem[]>([]);
  const [ordersByType, setOrdersByType] = useState<{ type: string; count: number }[]>([]);
  const [appointmentsByClinic, setAppointmentsByClinic] = useState<{ clinic_name: string; count: number }[]>([]);
  const [usersClientsPerClinic, setUsersClientsPerClinic] = useState<
    { clinic_name: string; users: number; clients: number }[]
  >([]);
  const [topSkus, setTopSkus] = useState<{ sku: string; quantity: number }[]>([]);
  const [aov, setAov] = useState<number>(0);

  useEffect(() => {
    void loadDashboardData();
  }, [overviewRange]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const safeParse = <T,>(raw: string | null): T | null => {
        try {
          if (!raw || raw === "undefined") return null;
          return JSON.parse(raw) as T;
        } catch {
          return null;
        }
      };

      let companyDataRaw = localStorage.getItem("controlCenterCompany");
      let userDataRaw = localStorage.getItem("currentUser");

      if ((!companyDataRaw || companyDataRaw === "undefined") && search.companyId) {
        try {
          const companyResponse = await apiClient.getCompany(parseInt(String(search.companyId)));
          if (companyResponse.data) {
            companyDataRaw = JSON.stringify(companyResponse.data);
            localStorage.setItem("controlCenterCompany", companyDataRaw);
          }
        } catch {
          // noop
        }
      }

      if (!userDataRaw) {
        try {
          const meResponse = await apiClient.getCurrentUser();
          if (meResponse.data) {
            userDataRaw = JSON.stringify(meResponse.data);
            localStorage.setItem("currentUser", userDataRaw);
          }
        } catch {
          // noop
        }
      }

      const parsedCompany = safeParse<Company>(companyDataRaw);
      const parsedUser = safeParse<User>(userDataRaw);

      if (!parsedCompany || !parsedUser) {
        router.navigate({ to: "/control-center" });
        return;
      }

      setCompany(parsedCompany);

      const [
        aggResp,
        overviewResp,
        usersClientsResp,
        apptMonthClinicResp,
        aovResp,
        ordersByTypeResp,
        topSkusResp,
      ] = await Promise.all([
        apiClient.getControlCenterDashboard(parsedCompany.id!),
        apiClient.ccStatsOverview(parsedCompany.id!, overviewRange),
        apiClient.ccStatsUsersClientsPerClinic(parsedCompany.id!),
        apiClient.ccStatsAppointmentsMonthPerClinic(parsedCompany.id!),
        apiClient.ccStatsAov(parsedCompany.id!, 3),
        apiClient.ccStatsOrdersByType(parsedCompany.id!, 6),
        apiClient.ccStatsTopSkus(parsedCompany.id!, 6, 8),
      ]);

      const aggStats = ((aggResp.data as any)?.stats as Partial<DashboardStats>) || {};

      setStats({
        totalClinics: Number(aggStats.totalClinics || 0),
        activeClinics: Number(aggStats.activeClinics || 0),
        totalUsers: Number(aggStats.totalUsers || 0),
        totalAppointments: Number(aggStats.totalAppointments || 0),
        monthlyRevenue: Number(aggStats.monthlyRevenue || 0),
      });
      setOverview((((overviewResp.data as any)?.items as OverviewItem[]) || []).map((item) => ({
        ...item,
        appointments: Number(item.appointments || 0),
        new_clients: Number(item.new_clients || 0),
        revenue: Number(item.revenue || 0),
      })));
      setUsersClientsPerClinic(sortClinicsByName(((usersClientsResp.data as any)?.items as any[]) || []));
      setAppointmentsByClinic(sortClinicsByName(((apptMonthClinicResp.data as any)?.items as any[]) || []));
      setAov(Number((aovResp.data as any)?.aov || 0));
      setOrdersByType((((ordersByTypeResp.data as any)?.items as any[]) || []).filter((item: any) => Number(item.count || 0) > 0));
      setTopSkus((((topSkusResp.data as any)?.items as any[]) || []).filter((item: any) => Number(item.quantity || 0) > 0));
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const overviewTicks = useMemo(
    () => getOverviewTicks(overview, overviewRange),
    [overview, overviewRange],
  );

  const overviewSummary = useMemo(() => {
    const totals = overview.reduce(
      (acc, item) => {
        acc.appointments += item.appointments;
        acc.newClients += item.new_clients;
        acc.revenue += item.revenue;
        if (!acc.peak || item.appointments > acc.peak.appointments) {
          acc.peak = item;
        }
        return acc;
      },
      {
        appointments: 0,
        newClients: 0,
        revenue: 0,
        peak: null as OverviewItem | null,
      },
    );

    return {
      appointments: totals.appointments,
      newClients: totals.newClients,
      revenue: totals.revenue,
      averageAppointments:
        overview.length > 0 ? Math.round((totals.appointments / overview.length) * 10) / 10 : 0,
      peakLabel: totals.peak?.label || "ללא נתון",
    };
  }, [overview]);

  const ordersTotal = useMemo(
    () => ordersByType.reduce((sum, item) => sum + Number(item.count || 0), 0),
    [ordersByType],
  );

  const ordersChartData = useMemo(
    () =>
      ordersByType.map((item, index) => ({
        type: item.type || "לא ידוע",
        count: Number(item.count || 0),
        fill: "var(--color-" + encodeURIComponent(item.type).replace(/%/g, "") + ")",
        originalColor: PIE_COLORS[index % PIE_COLORS.length],
      })),
    [ordersByType],
  );

  const appointmentsChartData = useMemo(
    () => appointmentsByClinic.map((item) => ({ ...item, short_name: truncateLabel(item.clinic_name, 16) })),
    [appointmentsByClinic],
  );

  const usersClientsChartData = useMemo(
    () => usersClientsPerClinic.map((item) => ({ ...item, short_name: truncateLabel(item.clinic_name, 16) })),
    [usersClientsPerClinic],
  );

  const topSkuChartData = useMemo(
    () => topSkus.map((item) => ({ ...item, short_sku: truncateLabel(item.sku || "unknown", 22) })),
    [topSkus],
  );

  return (
    <>
      <SiteHeader title="לוח בקרה" />
      <div 
        className="flex flex-col bg-muted/50 flex-1 overflow-y-auto" 
        dir="rtl" 
      >
        <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6" style={{ maxWidth: "1400px" }}>
          
          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold tracking-tight">{company?.name || "לוח בקרה"}</h2>
            <div className="flex items-center bg-background rounded-md border p-1 shadow-none">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setOverviewRange(option.value)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-[4px] transition-colors ${
                    overviewRange === option.value
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Top KPI Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <StatCard title="סה״כ מרפאות" value={integerFormatter.format(stats.totalClinics)} meta={`${integerFormatter.format(stats.activeClinics)} פעילות כרגע`} icon={Building2} loading={loading} />
            <StatCard title="סה״כ משתמשים" value={integerFormatter.format(stats.totalUsers)} meta="משויכים לכלל המרפאות" icon={Users} loading={loading} />
            <StatCard title="תורים החודש" value={integerFormatter.format(stats.totalAppointments)} meta="חודש קלנדרי נוכחי" icon={Calendar} loading={loading} />
            <StatCard title="הכנסות החודש" value={currencyFormatter.format(stats.monthlyRevenue)} meta="חיובים עדכניים בלבד" icon={Wallet} loading={loading} />
            <StatCard title="AOV ממוצע" value={currencyFormatter.format(aov)} meta="ממוצע על פני רבעון אחרון" icon={TrendingUp} loading={loading} />
          </div>

          {/* Main Chart Area */}
          <div className="grid gap-4 md:gap-6 lg:grid-cols-7">
            {/* Area Chart */}
            <Card className="lg:col-span-5 shadow-none flex flex-col">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">פעילות תקופתית</CardTitle>
                <CardDescription>מגמות צמיחה בתורים ובלקוחות חדשים</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 mt-auto pb-6">
                {loading ? (
                  <Skeleton className="h-[250px] w-full" />
                ) : overview.length === 0 ? (
                  <div className="flex h-[250px] items-center justify-center border border-dashed rounded-md bg-muted/10 text-center">
                    <p className="text-sm text-muted-foreground">אין נתונים להצגה בטווח הזמן שנבחר.</p>
                  </div>
                ) : (
                  <ChartContainer
                    className="h-[250px] w-full"
                    config={{
                      appointments: { label: "תורים", color: "hsl(var(--primary))" },
                      new_clients: { label: "לקוחות חדשים", color: "hsl(var(--muted-foreground))" },
                    }}
                  >
                    <AreaChart data={overview} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradientAppts" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-appointments)" stopOpacity={0.15} />
                          <stop offset="100%" stopColor="var(--color-appointments)" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="gradientClients" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-new_clients)" stopOpacity={0.15} />
                          <stop offset="100%" stopColor="var(--color-new_clients)" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="4 4" strokeOpacity={0.4} />
                      <XAxis
                        dataKey="bucket"
                        ticks={overviewTicks}
                        tickLine={false}
                        axisLine={false}
                        tickMargin={12}
                        interval={0}
                        tickFormatter={(value) => overview.find((item) => item.bucket === value)?.label || ""}
                        fontSize={12}
                        opacity={0.6}
                      />
                      <YAxis width={40} allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} opacity={0.6} />
                      <ChartTooltip
                        cursor={{ stroke: 'var(--color-border)', strokeWidth: 1, strokeDasharray: '4 4' }}
                        content={
                          <ChartTooltipContent
                            className="bg-background shadow-md border-border"
                            labelFormatter={(value) => overview.find((item) => item.bucket === value)?.label || ""}
                          />
                        }
                      />
                      <Area type="monotone" dataKey="appointments" stroke="var(--color-appointments)" fill="url(#gradientAppts)" strokeWidth={2} />
                      <Area type="monotone" dataKey="new_clients" stroke="var(--color-new_clients)" fill="url(#gradientClients)" strokeWidth={2} />
                    </AreaChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Summary Cards */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              {loading ? (
                <>
                  <Skeleton className="h-[100px] w-full rounded-xl" />
                  <Skeleton className="h-[100px] w-full rounded-xl" />
                  <Skeleton className="h-[100px] w-full rounded-xl" />
                </>
              ) : (
                <>
                  <Card className="shadow-none flex-1 flex flex-col justify-center">
                    <CardHeader className="py-4">
                      <CardDescription>סה״כ תורים בטווח</CardDescription>
                      <CardTitle className="text-2xl tabular-nums mt-1">{integerFormatter.format(overviewSummary.appointments)}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card className="shadow-none flex-1 flex flex-col justify-center">
                    <CardHeader className="py-4">
                      <CardDescription>מצטרפים חדשים</CardDescription>
                      <CardTitle className="text-2xl tabular-nums mt-1">{integerFormatter.format(overviewSummary.newClients)}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card className="shadow-none flex-1 flex flex-col justify-center">
                    <CardHeader className="py-4">
                      <CardDescription>מחזור בטווח נבחר</CardDescription>
                      <CardTitle className="text-2xl text-primary tabular-nums mt-1">{compactFormatter.format(overviewSummary.revenue)}</CardTitle>
                    </CardHeader>
                  </Card>
                </>
              )}
            </div>
          </div>

          {/* Secondary Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            
            {/* Appointments by Clinic */}
            <Card className="shadow-none flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">תורים לפי מרפאה</CardTitle>
                <CardDescription>פריסת תורים בחודש הנוכחי</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 mt-auto pb-6">
                {loading ? (
                  <Skeleton className="h-[220px] w-full" />
                ) : appointmentsChartData.length === 0 ? (
                  <div className="flex h-[220px] items-center justify-center border border-dashed rounded-md bg-muted/10 text-sm text-muted-foreground">
                    אין תורים להצגה
                  </div>
                ) : (
                  <ChartContainer
                    className="h-[220px] w-full"
                    config={{ count: { label: "תורים", color: "hsl(var(--primary))" } }}
                  >
                    <BarChart data={appointmentsChartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} strokeDasharray="4 4" strokeOpacity={0.4} />
                      <XAxis dataKey="short_name" tickLine={false} axisLine={false} tickMargin={12} interval={0} fontSize={12} opacity={0.6} />
                      <YAxis width={40} allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} opacity={0.6} />
                      <ChartTooltip cursor={{ fill: 'var(--color-muted)', opacity: 0.2 }} content={<ChartTooltipContent className="bg-background shadow-md border-border" />} />
                      <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Orders Distribution */}
            <Card className="shadow-none flex flex-col">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">התפלגות סוגי הזמנות</CardTitle>
                <CardDescription>פרופיל מכירות במהלך 6 החודשים האחרונים</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 pb-6 grid pt-2 md:grid-cols-[200px_1fr] items-center gap-6">
                {loading ? (
                  <div className="flex w-full gap-8 col-span-2">
                    <Skeleton className="h-[180px] w-[180px] rounded-full shrink-0" />
                    <div className="flex-1 space-y-4 py-8">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-5/6" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  </div>
                ) : ordersChartData.length === 0 ? (
                  <div className="col-span-2 flex h-[180px] items-center justify-center border border-dashed rounded-md bg-muted/10 text-sm text-muted-foreground">
                    אין הזמנות להצגה
                  </div>
                ) : (
                  <>
                    <ChartContainer
                      className="h-[180px] w-full"
                      config={ordersChartData.reduce((acc, item) => {
                        const key = encodeURIComponent(item.type).replace(/%/g, "");
                        return { ...acc, [key]: { label: item.type, color: item.originalColor } };
                      }, {} as Record<string, { label: string; color: string }>)}
                    >
                      <PieChart>
                        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel className="bg-background shadow-md border-border" />} />
                        <Pie data={ordersChartData} dataKey="count" nameKey="type" innerRadius={54} outerRadius={80} paddingAngle={2} strokeWidth={0}>
                          {ordersChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.originalColor} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ChartContainer>
                    
                    <div className="flex flex-col gap-2.5">
                      <div className="mb-1 pb-2 border-b">
                        <p className="text-xs text-muted-foreground">סה״כ מרשמים והזמנות</p>
                        <p className="text-xl font-semibold tabular-nums mt-0.5">{integerFormatter.format(ordersTotal)}</p>
                      </div>
                      {ordersChartData.map((item, i) => (
                        <div key={i} className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.originalColor }} />
                            <span className="text-sm text-foreground/90">{item.type}</span>
                          </div>
                          <span className="text-sm font-semibold tabular-nums text-muted-foreground">{integerFormatter.format(item.count)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

          </div>

          {/* Third row Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 pb-12">
            
            {/* Users vs Clients Grid */}
            <Card className="shadow-none flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">כוח אדם ולקוחות</CardTitle>
                <CardDescription>יחס משתמשים המותקנים מול לקוחות למרפאה</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 mt-auto pb-6">
                {loading ? (
                  <Skeleton className="h-[220px] w-full" />
                ) : usersClientsChartData.length === 0 ? (
                  <div className="flex h-[220px] items-center justify-center border border-dashed rounded-md bg-muted/10 text-sm text-muted-foreground">
                    אין נתונים להצגה
                  </div>
                ) : (
                  <ChartContainer
                    className="h-[220px] w-full"
                    config={{
                      users: { label: "משתמשים צוות", color: "hsl(var(--primary))" },
                      clients: { label: "לקוחות חוזרים", color: "hsl(var(--muted-foreground))" },
                    }}
                  >
                    <BarChart data={usersClientsChartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }} barGap={4}>
                      <CartesianGrid vertical={false} strokeDasharray="4 4" strokeOpacity={0.4} />
                      <XAxis dataKey="short_name" tickLine={false} axisLine={false} tickMargin={12} interval={0} fontSize={12} opacity={0.6} />
                      <YAxis width={40} allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} opacity={0.6} />
                      <ChartTooltip cursor={{ fill: 'var(--color-muted)', opacity: 0.15 }} content={<ChartTooltipContent className="bg-background shadow-md border-border" />} />
                      <Bar dataKey="users" fill="var(--color-users)" radius={[4, 4, 0, 0]} maxBarSize={20} />
                      <Bar dataKey="clients" fill="var(--color-clients)" radius={[4, 4, 0, 0]} maxBarSize={20} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Top Products */}
            <Card className="shadow-none flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">מוקדי רווח מובילים</CardTitle>
                <CardDescription>פריטים מבוקשים ברמת הרשת (SKU)</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 mt-auto pb-6">
                {loading ? (
                  <Skeleton className="h-[220px] w-full" />
                ) : topSkuChartData.length === 0 ? (
                  <div className="flex h-[220px] items-center justify-center border border-dashed rounded-md bg-muted/10 text-sm text-muted-foreground">
                    אין נתוני מוצרים זמינים
                  </div>
                ) : (
                  <ChartContainer
                    className="h-[220px] w-full"
                    config={{ quantity: { label: "כמות נמכרת", color: "hsl(var(--primary))" } }}
                  >
                    <BarChart data={topSkuChartData} layout="vertical" margin={{ top: 0, right: 16, left: 16, bottom: 0 }} barCategoryGap="20%">
                      <CartesianGrid horizontal={false} strokeDasharray="4 4" strokeOpacity={0.4} />
                      <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} opacity={0.6} />
                      <YAxis type="category" dataKey="short_sku" width={140} tickLine={false} axisLine={false} fontSize={12} opacity={0.8} />
                      <ChartTooltip
                        cursor={{ fill: 'var(--color-muted)', opacity: 0.15 }}
                        content={<ChartTooltipContent className="bg-background shadow-md border-border" />}
                      />
                      <Bar dataKey="quantity" fill="var(--color-quantity)" radius={[0, 4, 4, 0]} maxBarSize={24} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

          </div>

        </div>
      </div>
    </>
  );
};

export default ControlCenterDashboardPage;
