import React, { useState, useEffect } from 'react';
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

interface DashboardStats {
  totalClinics: number;
  activeClinics: number;
  totalUsers: number;
  totalAppointments: number;
  monthlyRevenue: number;
}

const ControlCenterDashboardPage: React.FC = () => {
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

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      let companyData = sessionStorage.getItem('controlCenterCompany');
      let userData = sessionStorage.getItem('currentUser');
      
      console.log('Dashboard - Company data from sessionStorage:', companyData);
      console.log('Dashboard - User data from sessionStorage:', userData);
      console.log('Dashboard - Search params:', search);
      
      // If coming from setup wizard, restore authentication state
      if (search.fromSetup === 'true' && search.companyId && search.companyName) {
        console.log('Dashboard - Coming from setup wizard, restoring auth state');
        
        if (!companyData || !userData) {
          // Get company and user from database
          const companyResponse = await apiClient.getCompany(parseInt(search.companyId));
          const company = companyResponse.data;
          if (company) {
            const userResponse = await apiClient.getUserByUsername('admin');
            const user = userResponse.data;
            if (user) {
              console.log('Dashboard - Restored auth state from database');
              sessionStorage.setItem('controlCenterCompany', JSON.stringify(company));
              sessionStorage.setItem('currentUser', JSON.stringify(user));
              companyData = JSON.stringify(company);
              userData = JSON.stringify(user);
            }
          }
        }
      }
      
      if (!companyData) {
        console.log('Dashboard - No company data found, redirecting to control center');
        router.navigate({ to: '/control-center' });
        return;
      }
      
      const parsedCompany = JSON.parse(companyData) as Company;
      console.log('Dashboard - Parsed company:', parsedCompany);
      setCompany(parsedCompany);

      if (!userData) {
        console.log('Dashboard - No user data found, redirecting to control center');
        router.navigate({ to: '/control-center' });
        return;
      }

      const clinicsResult = await apiClient.getClinicsByCompany(parsedCompany.id!);
      const clinicsData = clinicsResult.data || [];
      setClinics(clinicsData);

      const allUsersResponse = await apiClient.getUsers();
      const allUsers = allUsersResponse.data || [];
      setUsers(allUsers);

      const activeClinics = clinicsData?.filter((clinic: Clinic) => clinic.is_active) || [];
      const totalAppointmentsResponse = await apiClient.getAppointments();
      const totalAppointments = totalAppointmentsResponse.data || [];
      
      setStats({
        totalClinics: clinicsData?.length || 0,
        activeClinics: activeClinics.length,
        totalUsers: allUsers.length,
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
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">טוען נתונים...</div>
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


        </div>
      </div>
    </>
  );
};

export default ControlCenterDashboardPage;