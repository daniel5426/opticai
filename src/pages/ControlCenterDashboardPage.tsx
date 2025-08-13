import React, { useState, useEffect } from 'react';
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from 'recharts';

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
  const [appointmentsSeries, setAppointmentsSeries] = useState<{ month: string; count: number }[]>([]);
  const [newClientsSeries, setNewClientsSeries] = useState<{ month: string; count: number }[]>([]);

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

      const clinicsResult = await apiClient.getClinicsByCompany(parsedCompany.id!);
      const clinicsData = clinicsResult.data || [];
      setClinics(clinicsData);

      const companyUsersResponse = await apiClient.getUsersByCompany(parsedCompany.id!);
      const companyUsers = companyUsersResponse.data || [];
      setUsers(companyUsers);

      const activeClinics = clinicsData?.filter((clinic: Clinic) => clinic.is_active) || [];
      const totalAppointmentsResponse = await apiClient.getAppointments();
      const totalAppointments = totalAppointmentsResponse.data || [];
      
      if (USE_DUMMY_CHARTS) {
        setAppointmentsSeries(DUMMY_APPOINTMENTS_SERIES);
        setNewClientsSeries(DUMMY_NEW_CLIENTS_SERIES);
      } else {
        const [apptStatsResp, newClientsResp] = await Promise.all([
          apiClient.getCompanyAppointmentsStats(parsedCompany.id!),
          apiClient.getCompanyNewClientsStats(parsedCompany.id!),
        ]);
        setAppointmentsSeries((apptStatsResp.data as any) || []);
        setNewClientsSeries((newClientsResp.data as any) || []);
      }

      setStats({
        totalClinics: clinicsData?.length || 0,
        activeClinics: activeClinics.length,
        totalUsers: companyUsers.length,
        totalAppointments: totalAppointments.length,
        monthlyRevenue: 0
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


  if (loading) {
    return (
      <>
        <SiteHeader title="לוח בקרה" />
        <div className="flex flex-col bg-muted/50 h-full flex-1 gap-6 pb-40" dir="rtl" style={{ scrollbarWidth: 'none' }}>
          <div className="flex items-center justify-between p-4 lg:p-6 pb-0 lg:pb-1">
            <div className="flex items-center gap-4">
              <div>
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-64 mt-2" />
              </div>
            </div>
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>

          <div className="px-4 lg:px-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-card border-none shadow-md">
                <CardHeader className="flex flex-row items-center mb-[-10px] justify-between space-y-0">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4 rounded-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-7 w-16" />
                  <Skeleton className="h-3 w-20 mt-2" />
                </CardContent>
              </Card>
              <Card className="bg-card border-none shadow-md">
                <CardHeader className="flex flex-row items-center mb-[-10px] justify-between space-y-0">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-4 rounded-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-7 w-16" />
                  <Skeleton className="h-3 w-24 mt-2" />
                </CardContent>
              </Card>
              <Card className="bg-card border-none shadow-md">
                <CardHeader className="flex flex-row items-center mb-[-10px] justify-between space-y-0">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4 rounded-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-7 w-16" />
                  <Skeleton className="h-3 w-24 mt-2" />
                </CardContent>
              </Card>
              <Card className="bg-card border-none shadow-md">
                <CardHeader className="flex flex-row items-center mb-[-10px] justify-between space-y-0">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-4 rounded-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-7 w-24" />
                  <Skeleton className="h-3 w-28 mt-2" />
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-card border-none shadow-md">
                <CardHeader>
                  <Skeleton className="h-4 w-40" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="w-full h-64" />
                </CardContent>
              </Card>

              <Card className="bg-card border-none shadow-md">
                <CardHeader>
                  <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="w-full h-64" />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </>
    );
  }

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

        <div className="px-4 lg:px-6 space-y-6">
          
          {/* Stats Bar - First Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-card border-none shadow-md">
              <CardHeader className="flex flex-row items-center mb-[-10px] justify-between space-y-0">
                <CardTitle className="text-sm font-medium">סה"כ מרפאות</CardTitle>
                <Building2 className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{stats.totalClinics}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.activeClinics} פעילות
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-none shadow-md">
              <CardHeader className="flex flex-row items-center mb-[-10px] justify-between space-y-0">
                <CardTitle className="text-sm font-medium">סה"כ משתמשים</CardTitle>
                <Users className="h-4 w-4 text-secondary-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-secondary-foreground">{stats.totalUsers}</div>
                <p className="text-xs text-muted-foreground">
                  בכל המרפאות
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-none shadow-md">
              <CardHeader className="flex flex-row items-center mb-[-10px] justify-between space-y-0">
                <CardTitle className="text-sm font-medium">תורים החודש</CardTitle>
                <Calendar className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{stats.totalAppointments}</div>
                <p className="text-xs text-muted-foreground">
                  בכל המרפאות
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-none shadow-md">
              <CardHeader className="flex flex-row items-center mb-[-10px] justify-between space-y-0">
                <CardTitle className="text-sm font-medium">הכנסות החודש</CardTitle>
                <TrendingUp className="h-4 w-4 text-secondary-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-secondary-foreground">₪{stats.monthlyRevenue.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  מכל המרפאות
                </p>
              </CardContent>
            </Card>
          </div>


          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-card border-none shadow-md">
              <CardHeader>
                <CardTitle className="text-sm font-medium">תורים בחודשים</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{ appointments: { label: 'תורים', color: 'hsl(var(--primary))' } }}
                  className="w-full h-64"
                >
                  <LineChart data={appointmentsSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line name="appointments" type="monotone" dataKey="count" stroke="var(--color-appointments)" strokeWidth={2} dot={false} />
                    <ChartLegend content={<ChartLegendContent />} />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="bg-card border-none shadow-md">
              <CardHeader>
                <CardTitle className="text-sm font-medium">לקוחות חדשים בחודשים</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{ clients: { label: 'לקוחות חדשים', color: 'hsl(var(--secondary-foreground))' } }}
                  className="w-full h-64"
                >
                  <LineChart data={newClientsSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line name="clients" type="monotone" dataKey="count" stroke="var(--color-clients)" strokeWidth={2} dot={false} />
                    <ChartLegend content={<ChartLegendContent />} />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>


        </div>
      </div>
    </>
  );
};

export default ControlCenterDashboardPage;