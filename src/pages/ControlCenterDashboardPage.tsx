import React, { useState, useEffect } from 'react';
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRouter } from '@tanstack/react-router';
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
import type { Company, Clinic, User } from '@/lib/db/schema';

interface DashboardStats {
  totalClinics: number;
  activeClinics: number;
  totalUsers: number;
  totalAppointments: number;
  monthlyRevenue: number;
}

const ControlCenterDashboardPage: React.FC = () => {
  const router = useRouter();
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
      
      const companyData = sessionStorage.getItem('controlCenterCompany');
      if (!companyData) {
        router.navigate({ to: '/control-center' });
        return;
      }
      
      const parsedCompany = JSON.parse(companyData) as Company;
      setCompany(parsedCompany);

      const clinicsResult = await window.electronAPI.db('getClinicsByCompanyId', parsedCompany.id);
      setClinics(clinicsResult || []);

      const allUsers = await window.electronAPI.db('getAllUsers');
      setUsers(allUsers || []);

      const activeClinics = clinicsResult?.filter((clinic: Clinic) => clinic.is_active) || [];
      const totalAppointments = await window.electronAPI.db('getAllAppointments');
      
      setStats({
        totalClinics: clinicsResult?.length || 0,
        activeClinics: activeClinics.length,
        totalUsers: allUsers?.length || 0,
        totalAppointments: totalAppointments?.length || 0,
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

  const handleNavigateToSettings = () => {
    router.navigate({ to: '/control-center/settings' });
  };

  const handleAddClinic = () => {
    router.navigate({ to: '/control-center/clinics/new' });
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
      <div className="flex flex-col bg-muted/50 flex-1 gap-6 pb-40" dir="rtl" style={{ scrollbarWidth: 'none' }}>
        
        {/* Header Section */}
        <div className="flex items-center justify-between p-4 lg:p-6 pb-0 lg:pb-1">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-xl font-semibold">{company?.name}</h1>
              <p className="text-sm text-muted-foreground">ניהול כללי של כל המרפאות והמשתמשים במערכת</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleNavigateToSettings} variant="outline" className="bg-card shadow-md border-none dark:bg-card">
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

          {/* Clinics Overview Card */}
          <Card className="bg-card border-none shadow-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <Building2 className="w-4 h-4 text-primary" />
                    מרפאות
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">רשימת כל המרפאות במערכת</p>
                </div>
                <Button onClick={handleNavigateToClinics} variant="outline" size="sm" className="bg-card shadow-md border-none dark:bg-card">
                  <Eye className="w-4 h-4 ml-2" />
                  צפה בכל
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {clinics.slice(0, 5).map((clinic) => (
                  <div key={clinic.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${clinic.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <div>
                        <p className="text-sm font-medium">{clinic.name}</p>
                        <p className="text-xs text-muted-foreground">{clinic.address}</p>
                      </div>
                    </div>
                    <Badge variant={clinic.is_active ? "default" : "secondary"} className="text-xs">
                      {clinic.is_active ? 'פעיל' : 'לא פעיל'}
                    </Badge>
                  </div>
                ))}
                {clinics.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Building2 className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm">אין מרפאות במערכת</p>
                    <Button onClick={handleAddClinic} className="mt-2" size="sm">
                      הוסף מרפאה ראשונה
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Users Overview Card */}
          <Card className="bg-card border-none shadow-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <Users className="w-4 h-4 text-secondary-foreground" />
                    משתמשים
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">רשימת המשתמשים האחרונים במערכת</p>
                </div>
                <Button onClick={handleNavigateToUsers} variant="outline" size="sm" className="bg-card shadow-md border-none dark:bg-card">
                  <UserCheck className="w-4 h-4 ml-2" />
                  נהל משתמשים
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {users.slice(0, 5).map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <div>
                        <p className="text-sm font-medium">{user.username}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {user.role}
                    </Badge>
                  </div>
                ))}
                {users.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm">אין משתמשים במערכת</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </>
  );
};

export default ControlCenterDashboardPage;