import React, { useState, useEffect } from 'react';
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter, useSearch } from '@tanstack/react-router';
import { 
  Building2, 
  Users, 
  Calendar, 
  TrendingUp, 
  Settings, 
  Plus,
  Eye,
  UserCheck,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import type { Company, Clinic, User } from '@/lib/db/schema-interface';
import { apiClient } from '@/lib/api-client';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Line, LineChart, CartesianGrid, XAxis, YAxis, BarChart, Bar, PieChart, Pie, Label } from 'recharts';

interface DashboardStats {
  totalClinics: number;
  activeClinics: number;
  totalUsers: number;
  totalAppointments: number;
  monthlyRevenue: number;
}

const ControlCenterDashboardPage: React.FC = () => {
  const USE_DUMMY_CHARTS = true;
  const buildMonthlySeries = (base: number) => {
    const series: { month: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const count = base + Math.floor(((12 - i) % 5) * 3) + (((12 - i) % 2) ? 7 : 3);
      series.push({ month, count });
    }
    return series;
  };
  const DUMMY_APPOINTMENTS_SERIES = buildMonthlySeries(40);
  const DUMMY_NEW_CLIENTS_SERIES = buildMonthlySeries(15);
  const router = useRouter();
  const search = useSearch({ from: '/control-center/dashboard' });
  const [company, setCompany] = useState<Company | null>(null);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalClinics: 0,
    activeClinics: 0,
    totalUsers: 0,
    totalAppointments: 0,
    monthlyRevenue: 0
  });
  const [loading, setLoading] = useState(true);
  const [newClientsSeries, setNewClientsSeries] = useState<{ month: string; count: number }[]>([]);
  const [ordersByType, setOrdersByType] = useState<{ type: string; count: number }[]>([]);
  const [appointmentsByClinic, setAppointmentsByClinic] = useState<{ clinic_name: string; count: number }[]>([]);
  const [usersClientsPerClinic, setUsersClientsPerClinic] = useState<{ clinic_name: string; users: number; clients: number }[]>([]);
  const [topSkus, setTopSkus] = useState<{ sku: string; quantity: number }[]>([]);
  const [aov, setAov] = useState<number>(0);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      const safeParse = <T,>(raw: string | null): T | null => {
        try {
          if (!raw) return null;
          if (raw === 'undefined') return null;
          return JSON.parse(raw) as T;
        } catch {
          return null;
        }
      };

      let companyDataRaw = localStorage.getItem('controlCenterCompany');
      let userDataRaw = localStorage.getItem('currentUser');

      console.log('Dashboard - Company data (localStorage):', companyDataRaw);
      console.log('Dashboard - User data (localStorage):', userDataRaw);
      console.log('Dashboard - Search params:', search);

      if ((!companyDataRaw || companyDataRaw === 'undefined') && search.companyId) {
        try {
          const companyResponse = await apiClient.getCompany(parseInt(String(search.companyId)));
          const fetchedCompany = companyResponse.data;
          if (fetchedCompany) {
            localStorage.setItem('controlCenterCompany', JSON.stringify(fetchedCompany));
            companyDataRaw = JSON.stringify(fetchedCompany);
          }
        } catch {
        }
      }

      if (!userDataRaw) {
        try {
          const meResponse = await apiClient.getCurrentUser();
          if (meResponse.data) {
            localStorage.setItem('currentUser', JSON.stringify(meResponse.data));
            userDataRaw = JSON.stringify(meResponse.data);
          }
        } catch {
        }
      }

      const parsedCompany = safeParse<Company>(companyDataRaw);
      const parsedUser = safeParse<User>(userDataRaw);

      if (!parsedCompany || !parsedUser) {
        console.log('Dashboard - Missing company or user, redirecting to control center');
        router.navigate({ to: '/control-center' });
        return;
      }

      setCompany(parsedCompany);

      const aggResp = await apiClient.getControlCenterDashboard(parsedCompany.id!);
      const agg = aggResp.data as any;
      const aggStats = (agg?.stats as any) || {};
      const currentMonthAppointmentsCount = Number(aggStats.totalAppointments || 0);
      
      const [usersClientsResp, apptMonthClinicResp, newClientsResp, aovResp, ordersByTypeResp, topSkusResp] = await Promise.all([
        apiClient.ccStatsUsersClientsPerClinic(parsedCompany.id!),
        apiClient.ccStatsAppointmentsMonthPerClinic(parsedCompany.id!),
        apiClient.ccStatsNewClientsSeries(parsedCompany.id!, 12),
        apiClient.ccStatsAov(parsedCompany.id!, 3),
        apiClient.ccStatsOrdersByType(parsedCompany.id!, 6),
        apiClient.ccStatsTopSkus(parsedCompany.id!, 6, 10),
      ]);
      setUsersClientsPerClinic(((usersClientsResp.data as any)?.items) || []);
      setAppointmentsByClinic(((apptMonthClinicResp.data as any)?.items) || []);
      setNewClientsSeries(((newClientsResp.data as any)?.items) || []);
      setAov(Number((aovResp.data as any)?.aov || 0));
      setOrdersByType(((ordersByTypeResp.data as any)?.items) || []);
      setTopSkus(((topSkusResp.data as any)?.items) || []);

      setStats({
        totalClinics: Number(aggStats.totalClinics || 0),
        activeClinics: Number(aggStats.activeClinics || 0),
        totalUsers: Number(aggStats.totalUsers || 0),
        totalAppointments: currentMonthAppointmentsCount,
        monthlyRevenue: Number(aggStats.monthlyRevenue || 0)
      });

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigateToUsers = () => {
    router.navigate({ to: '/control-center/users' });
  };

  const handleNavigateToClinics = () => {
    router.navigate({ to: '/control-center/clinics' });
  };



  return (
    <>
      <SiteHeader title="לוח בקרה" />
      <div className="flex flex-col bg-muted/50 h-full flex-1 gap-6 pb-40" dir="rtl" style={{ scrollbarWidth: 'none' }}>
        
        {/* Header Section */}
        <div className="flex items-center justify-between p-4 lg:p-6 pb-0 lg:pb-1">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-xl font-semibold">{company?.name}</h1>
              <p className="text-sm text-muted-foreground">ניהול כללי של כל המרפאות והמשתמשים במערכת</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button  variant="outline" className="bg-card shadow-md border-none dark:bg-card">
              <Settings className="h-4 w-4 ml-2" />
              הגדרות
            </Button>
          </div>
        </div>

        <div className="px-4 lg:px-6 space-y-6 pb-40">
          
          {/* Stats Bar - First Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="bg-card border-none shadow-md">
              <CardHeader className="flex flex-row items-center mb-[-10px] justify-between space-y-0">
                <CardTitle className="text-sm font-medium">סה"כ מרפאות</CardTitle>
                <Building2 className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <>
                    <Skeleton className="h-7 w-16" />
                    <Skeleton className="h-3 w-20 mt-2" />
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold text-primary">{stats.totalClinics}</div>
                    <p className="text-xs text-muted-foreground">
                      {stats.activeClinics} פעילות
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card border-none shadow-md">
              <CardHeader className="flex flex-row items-center mb-[-10px] justify-between space-y-0">
                <CardTitle className="text-sm font-medium">סה"כ משתמשים</CardTitle>
                <Users className="h-4 w-4 text-secondary-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <>
                    <Skeleton className="h-7 w-16" />
                    <Skeleton className="h-3 w-24 mt-2" />
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold text-secondary-foreground">{stats.totalUsers}</div>
                    <p className="text-xs text-muted-foreground">
                      בכל המרפאות
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card border-none shadow-md">
              <CardHeader className="flex flex-row items-center mb-[-10px] justify-between space-y-0">
                <CardTitle className="text-sm font-medium">תורים החודש</CardTitle>
                <Calendar className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <>
                    <Skeleton className="h-7 w-16" />
                    <Skeleton className="h-3 w-24 mt-2" />
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold text-primary">{stats.totalAppointments}</div>
                    <p className="text-xs text-muted-foreground">
                      בכל המרפאות
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card border-none shadow-md">
              <CardHeader className="flex flex-row items-center mb-[-10px] justify-between space-y-0">
                <CardTitle className="text-sm font-medium">הכנסות החודש</CardTitle>
                <TrendingUp className="h-4 w-4 text-secondary-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <>
                    <Skeleton className="h-7 w-24" />
                    <Skeleton className="h-3 w-28 mt-2" />
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold text-secondary-foreground">₪{stats.monthlyRevenue.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      מכל המרפאות
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card border-none shadow-md">
              <CardHeader className="flex flex-row items-center mb-[-10px] justify-between space-y-0">
                <CardTitle className="text-sm font-medium">AOV ממוצע</CardTitle>
                <TrendingUp className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <>
                    <Skeleton className="h-7 w-24" />
                    <Skeleton className="h-3 w-28 mt-2" />
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold text-primary">₪{Number(aov || 0).toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">3 חודשים אחרונים</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="bg-card border-none shadow-md">
              <CardHeader>
                <CardTitle className="text-sm font-medium">הזמנות לפי סוג</CardTitle>
              </CardHeader>
              <CardContent className="m-auto">
                {loading ? (
                  <div className="mx-auto w-full max-w-[320px] flex flex-col items-center justify-center">
                    <Skeleton className="h-64 w-64 rounded-full" />
                    <div className="mt-4 space-y-2">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                ) : ordersByType.length === 0 ? (
                  <div className="mx-auto m-auto w-full max-w-[320px] flex flex-col items-center justify-center text-center">
                    <div className="text-muted-foreground text-sm mb-2">אין נתונים זמינים</div>
                    <div className="text-muted-foreground text-xs">עדיין לא בוצעו הזמנות במערכת</div>
                  </div>
                ) : (
                  <ChartContainer
                    config={ordersByType.reduce((acc, it, idx) => {
                      acc[it.type || 'unknown'] = { label: it.type || 'לא ידוע', color: idx % 2 === 0 ? 'hsl(var(--primary))' : 'hsl(var(--secondary-foreground))' };
                      return acc;
                    }, {} as any)}
                    className="mx-auto aspect-square w-full max-w-[320px]"
                  >
                    <PieChart>
                      <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                      <Pie
                        data={ordersByType.map((it, idx) => ({ key: it.type || 'unknown', value: it.count, fill: idx % 2 === 0 ? 'hsl(var(--primary))' : 'hsl(var(--secondary-foreground))' }))}
                        dataKey="value"
                        nameKey="key"
                        innerRadius={60}
                        strokeWidth={5}
                      >
                        <Label content={({ viewBox }) => {
                          if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                            const total = ordersByType.reduce((s, i) => s + Number(i.count || 0), 0)
                            return (
                              <text x={viewBox.cx as number} y={viewBox.cy as number} textAnchor="middle" dominantBaseline="middle">
                                <tspan x={viewBox.cx as number} y={viewBox.cy as number} className="fill-foreground text-2xl font-bold">{total.toLocaleString()}</tspan>
                                <tspan x={viewBox.cx as number} y={(viewBox.cy as number) + 20} className="fill-muted-foreground text-xs">סה"כ</tspan>
                              </text>
                            )
                          }
                          return null
                        }} />
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                )}
              </CardContent>
              <CardFooter className="flex-col mb-0 items-start gap-2 text-sm">
                {loading ? (
                  <>
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </>
                ) : (
                  <>
                    <div className="flex gap-2 leading-none font-medium">התפלגות סוגי הזמנות לפי ספירה</div>
                    <div className="text-muted-foreground leading-none">חצי שנה אחרונה</div>
                  </>
                )}
              </CardFooter>
            </Card>

            <Card className="bg-card border-none shadow-md">
              <CardHeader>
                <CardTitle className="text-sm font-medium">תורים החודש לפי מרפאה</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="w-full h-64 flex flex-col items-center justify-center">
                    <Skeleton className="w-full h-64" />
                    <div className="mt-4 space-y-2">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ) : appointmentsByClinic.length === 0 ? (
                  <div className="w-full h-64 flex flex-col items-center justify-center text-center">
                    <div className="text-muted-foreground text-sm mb-2">אין תורים החודש</div>
                    <div className="text-muted-foreground text-xs">עדיין לא נקבעו תורים במרפאות</div>
                  </div>
                ) : (
                  <ChartContainer config={{ count: { label: 'תורים', color: 'hsl(var(--primary))' } }}>
                    <BarChart accessibilityLayer data={appointmentsByClinic}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="clinic_name" tickLine={false} tickMargin={10} axisLine={false} />
                      <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={4} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
              <CardFooter className="flex-col items-start gap-2 text-sm">
                {loading ? (
                  <>
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </>
                ) : (
                  <>
                    <div className="flex gap-2 leading-none font-medium">תורים לפי מרפאה (חודש נוכחי)</div>
                    <div className="text-muted-foreground leading-none">מסודר לפי כמות</div>
                  </>
                )}
              </CardFooter>
            </Card>

            <Card className="bg-card border-none shadow-md">
              <CardHeader>
                <CardTitle className="text-sm font-medium">משתמשים ולקוחות לפי מרפאה</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="w-full h-64 flex flex-col items-center justify-center">
                    <Skeleton className="w-full h-64" />
                    <div className="mt-4 space-y-2">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ) : usersClientsPerClinic.length === 0 ? (
                  <div className="w-full h-64 flex flex-col items-center justify-center text-center">
                    <div className="text-muted-foreground text-sm mb-2">אין מרפאות במערכת</div>
                    <div className="text-muted-foreground text-xs">נראה שעדיין לא הוגדרו מרפאות</div>
                  </div>
                ) : (
                  <ChartContainer config={{ users: { label: 'משתמשים', color: 'hsl(var(--primary))' }, clients: { label: 'לקוחות', color: 'hsl(var(--secondary-foreground))' } }}>
                    <BarChart accessibilityLayer data={usersClientsPerClinic}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="clinic_name" tickLine={false} tickMargin={10} axisLine={false} />
                      <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dashed" />} />
                      <Bar dataKey="users" fill="hsl(var(--primary))" radius={4} />
                      <Bar dataKey="clients" fill="hsl(var(--secondary-foreground))" radius={4} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
              <CardFooter className="flex-col items-start gap-2 text-sm">
                {loading ? (
                  <>
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </>
                ) : (
                  <>
                    <div className="flex gap-2 leading-none font-medium">משתמשים מול לקוחות בכל מרפאה</div>
                    <div className="text-muted-foreground leading-none">ממויין לפי סך הכול</div>
                  </>
                )}
              </CardFooter>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="bg-card border-none shadow-md">
              <CardHeader>
                <CardTitle className="text-sm font-medium">מוצרים מובילים (SKU)</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="w-full h-64 flex flex-col items-center justify-center">
                    <Skeleton className="w-full h-64" />
                  </div>
                ) : topSkus.length === 0 ? (
                  <div className="w-full h-64 flex flex-col items-center justify-center text-center">
                    <div className="text-muted-foreground text-sm mb-2">אין מוצרים</div>
                    <div className="text-muted-foreground text-xs">עדיין לא בוצעו הזמנות עם פריטים</div>
                  </div>
                ) : (
                  <ChartContainer config={{ quantity: { label: 'כמות', color: 'var(--chart-1)' } }}>
                    <BarChart accessibilityLayer data={topSkus.map((it) => ({ sku: it.sku || 'unknown', quantity: it.quantity }))} layout="vertical" margin={{ left: -10 }}>
                      <XAxis type="number" dataKey="quantity" hide />
                      <YAxis dataKey="sku" type="category" tickLine={false} tickMargin={10} axisLine={false} />
                      <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                      <Bar dataKey="quantity" fill="var(--color-quantity)" radius={5} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card border-none shadow-md lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm font-medium">לקוחות חדשים ב-12 חודשים</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="w-full h-64 flex flex-col items-center justify-center">
                    <Skeleton className="w-full h-64" />
                    <div className="mt-4 space-y-2">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ) : newClientsSeries.length === 0 ? (
                  <div className="w-full h-64 flex flex-col items-center justify-center text-center">
                    <div className="text-muted-foreground text-sm mb-2">אין נתוני לקוחות</div>
                    <div className="text-muted-foreground text-xs">עדיין לא נוספו לקוחות חדשים למערכת</div>
                  </div>
                ) : (
                  <ChartContainer config={{ clients: { label: 'לקוחות חדשים', color: 'var(--chart-1)' } }} className="w-full h-64">
                    <LineChart data={newClientsSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis allowDecimals={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line name="clients" type="monotone" dataKey="count" stroke="var(--color-clients)" strokeWidth={2} dot={false} />
                      <ChartLegend content={<ChartLegendContent />} />
                    </LineChart>
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