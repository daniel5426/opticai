import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
  MapPin
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
      
      // Get company data from session storage
      const companyData = sessionStorage.getItem('controlCenterCompany');
      if (!companyData) {
        router.navigate({ to: '/control-center' });
        return;
      }
      
      const parsedCompany = JSON.parse(companyData) as Company;
      setCompany(parsedCompany);

      // Load clinics for this company
      const clinicsResult = await window.electronAPI.db('getClinicsByCompanyId', parsedCompany.id);
      setClinics(clinicsResult || []);

      // Load users for all clinics
      const allUsers = await window.electronAPI.db('getAllUsers');
      setUsers(allUsers || []);

      // Calculate stats
      const activeClinics = clinicsResult?.filter((clinic: Clinic) => clinic.is_active) || [];
      const totalAppointments = await window.electronAPI.db('getAllAppointments');
      
      setStats({
        totalClinics: clinicsResult?.length || 0,
        activeClinics: activeClinics.length,
        totalUsers: allUsers?.length || 0,
        totalAppointments: totalAppointments?.length || 0,
        monthlyRevenue: 0 // TODO: Calculate from billing data
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">טוען נתוני לוח הבקרה...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100" dir="rtl">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                לוח בקרה - {company?.name}
              </h1>
              <p className="text-gray-600">
                ניהול כללי של כל המרפאות והמשתמשים במערכת
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleAddClinic} className="bg-green-600 hover:bg-green-700">
                <Plus className="w-4 h-4 ml-2" />
                הוסף מרפאה
              </Button>
              <Button onClick={handleNavigateToSettings} variant="outline">
                <Settings className="w-4 h-4 ml-2" />
                הגדרות
              </Button>
            </div>
          </div>
          
          {company && (
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-sm text-gray-600">בעל החברה</p>
                      <p className="font-semibold">{company.owner_full_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm text-gray-600">מיקום</p>
                      <p className="font-semibold">{company.address || 'לא צוין'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-purple-600" />
                    <div>
                      <p className="text-sm text-gray-600">נוצר</p>
                      <p className="font-semibold">
                        {new Date(company.created_at).toLocaleDateString('he-IL')}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/80 backdrop-blur-sm hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">סה"כ מרפאות</CardTitle>
              <Building2 className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalClinics}</div>
              <p className="text-xs text-muted-foreground">
                {stats.activeClinics} פעילות
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">סה"כ משתמשים</CardTitle>
              <Users className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">
                בכל המרפאות
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">תורים החודש</CardTitle>
              <Calendar className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAppointments}</div>
              <p className="text-xs text-muted-foreground">
                בכל המרפאות
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">הכנסות החודש</CardTitle>
              <TrendingUp className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₪{stats.monthlyRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                מכל המרפאות
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Clinics Overview */}
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    מרפאות
                  </CardTitle>
                  <CardDescription>
                    רשימת כל המרפאות במערכת
                  </CardDescription>
                </div>
                <Button onClick={handleNavigateToClinics} variant="outline" size="sm">
                  <Eye className="w-4 h-4 ml-2" />
                  צפה בכל
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {clinics.slice(0, 5).map((clinic) => (
                  <div key={clinic.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${clinic.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <div>
                        <p className="font-medium">{clinic.name}</p>
                        <p className="text-sm text-gray-600">{clinic.address}</p>
                      </div>
                    </div>
                    <Badge variant={clinic.is_active ? "default" : "secondary"}>
                      {clinic.is_active ? 'פעיל' : 'לא פעיל'}
                    </Badge>
                  </div>
                ))}
                {clinics.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>אין מרפאות במערכת</p>
                    <Button onClick={handleAddClinic} className="mt-4" size="sm">
                      הוסף מרפאה ראשונה
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Users Overview */}
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-green-600" />
                    משתמשים
                  </CardTitle>
                  <CardDescription>
                    רשימת המשתמשים האחרונים במערכת
                  </CardDescription>
                </div>
                <Button onClick={handleNavigateToUsers} variant="outline" size="sm">
                  <UserCheck className="w-4 h-4 ml-2" />
                  נהל משתמשים
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {users.slice(0, 5).map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <div>
                        <p className="font-medium">{user.username}</p>
                        <p className="text-sm text-gray-600">{user.email}</p>
                      </div>
                    </div>
                    <Badge variant="outline">
                      {user.role}
                    </Badge>
                  </div>
                ))}
                {users.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>אין משתמשים במערכת</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>פעולות מהירות</CardTitle>
              <CardDescription>
                פעולות נפוצות לניהול המערכת
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button 
                  onClick={handleAddClinic}
                  className="h-20 flex-col gap-2 bg-green-600 hover:bg-green-700"
                >
                  <Plus className="w-6 h-6" />
                  הוסף מרפאה חדשה
                </Button>
                
                <Button 
                  onClick={handleNavigateToUsers}
                  variant="outline"
                  className="h-20 flex-col gap-2"
                >
                  <Users className="w-6 h-6" />
                  נהל משתמשים
                </Button>
                
                <Button 
                  onClick={handleNavigateToSettings}
                  variant="outline"
                  className="h-20 flex-col gap-2"
                >
                  <Settings className="w-6 h-6" />
                  הגדרות מערכת
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ControlCenterDashboardPage;