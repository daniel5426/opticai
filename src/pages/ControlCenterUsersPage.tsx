import React, { useState, useEffect } from 'react';
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from '@tanstack/react-router';
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  ArrowLeft,
  UserCheck,
  UserX,
  Building2,
  Mail,
  Phone
} from 'lucide-react';
import { toast } from 'sonner';
import type { Company, Clinic, User } from '@/lib/db/schema-interface';
import { UsersTable } from '@/components/users-table';
import { UserModal } from '@/components/UserModal';
import { getUsersByCompanyId } from '@/lib/db/users-db';
import { apiClient } from '@/lib/api-client';

interface LocalUserWithClinic extends User {
  clinic_name?: string;
}

const ControlCenterUsersPage: React.FC = () => {
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [users, setUsers] = useState<LocalUserWithClinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<LocalUserWithClinic | null>(null);



  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const companyData = sessionStorage.getItem('controlCenterCompany');
      if (!companyData) {
        router.navigate({ to: '/control-center' });
        return;
      }
      
      const parsedCompany = JSON.parse(companyData) as Company;
      setCompany(parsedCompany);

      const clinicsResponse = await apiClient.getClinicsByCompany(parsedCompany.id!);
      const clinicsResult = clinicsResponse.data || [];
      setClinics(clinicsResult);

      const allUsers = await getUsersByCompanyId(parsedCompany.id!);
      const usersWithClinics = (allUsers || []).map((user: User): LocalUserWithClinic => {
        const clinic = clinicsResult.find((c: Clinic) => c.id === user.clinic_id);
        return {
          ...user,
          clinic_name: clinic?.name || 'גלובלי'
        };
      });

      setUsers(usersWithClinics);
    } catch (error) {
      console.error('Error loading users data:', error);
      toast.error('שגיאה בטעינת נתוני המשתמשים');
    } finally {
      setLoading(false);
    }
  };

  const handleUserSaved = (newUser: User) => {
    const userWithClinic: LocalUserWithClinic = {
      ...newUser,
      clinic_name: clinics.find(c => c.id === newUser.clinic_id)?.name || 'גלובלי'
    };
    setUsers(prev => [...prev, userWithClinic]);
  };

  const handleUserUpdated = (updatedUser: LocalUserWithClinic) => {
    const userWithClinic: LocalUserWithClinic = {
      ...updatedUser,
      clinic_name: clinics.find(c => c.id === updatedUser.clinic_id)?.name || 'גלובלי'
    };
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? userWithClinic : u));
  };

  const handleUserDeleted = (userId: number) => {
    setUsers(users.filter(user => user.id !== userId));
  };



  const handleNewUser = () => {
    setIsAddModalOpen(true);
  };

  const handleEditUserClick = (user: LocalUserWithClinic) => {
    setEditingUser(user);
    setIsEditModalOpen(true);
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'admin': return 'מנהל מערכת';
      case 'worker': return 'עובד';
      case 'viewer': return 'צופה';
      default: return role;
    }
  };

  if (loading) {
    return (
      <>
      <SiteHeader title="ניהול משתמשים" />
      <div className="min-h-screen  flex items-center justify-center" dir="rtl" style={{scrollbarWidth: 'none'}}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">טוען נתוני משתמשים...</p>
        </div>
      </div>
      </>
    );
  }

  return (
    <>
      <SiteHeader title="ניהול משתמשים" />
      <div className="flex flex-col bg-muted/50 flex-1 gap-6 pb-40 h-full" dir="rtl" style={{scrollbarWidth: 'none'}}>
        <div className="container mx-auto p-6">


        <UsersTable
          data={users}
          onUserDeleted={handleUserDeleted}
          onUserUpdated={handleUserUpdated as any}
          searchQuery={searchTerm}
          onSearchChange={setSearchTerm}
          onNewUser={handleNewUser}
          onEditUser={handleEditUserClick as any}
        />
        </div>
      </div>

      <UserModal
        isOpen={isAddModalOpen || isEditModalOpen}
        onClose={() => {
          setIsAddModalOpen(false)
          setIsEditModalOpen(false)
          setEditingUser(null)
        }}
        editingUser={editingUser}
        currentUser={null}
        clinics={clinics.filter(c => c.id !== undefined).map(c => ({ id: c.id!, name: c.name }))}
        onUserSaved={handleUserSaved}
        onUserUpdated={handleUserUpdated}
      />
    </>
  );
};

export default ControlCenterUsersPage;