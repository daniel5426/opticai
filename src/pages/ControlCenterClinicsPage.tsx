import React, { useState, useEffect } from 'react';
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { CustomModal } from '@/components/ui/custom-modal';
import { Switch } from '@/components/ui/switch';
import { useRouter } from '@tanstack/react-router';
import { useUser } from '@/contexts/UserContext';
import { 
  Building2, 
  Plus, 
  Edit3, 
  Trash2, 
  MapPin,
  Phone,
  Mail,
  User,
  Settings,
  Eye,
  EyeOff,
  Users,
  Calendar,
  CheckCircle,
  XCircle,
  Copy
} from 'lucide-react';
import { toast } from 'sonner';
import type { Company, Clinic } from '@/lib/db/schema-interface';
import { apiClient } from '@/lib/api-client';

interface ClinicModalProps {
  isOpen: boolean;
  onClose: () => void;
  clinic?: Clinic;
  onSave: (data: Clinic) => void;
}

function ClinicModal({ isOpen, onClose, clinic, onSave }: ClinicModalProps) {
  const [name, setName] = useState(clinic?.name || '');
  const [location, setLocation] = useState(clinic?.location || '');
  const [phoneNumber, setPhoneNumber] = useState(clinic?.phone_number || '');
  const [email, setEmail] = useState(clinic?.email || '');
  const [isActive, setIsActive] = useState(clinic?.is_active ?? true);

  const handleConfirm = () => {
    const data = {
      id: clinic?.id,
      company_id: clinic?.company_id,
      name,
      location,
      phone_number: phoneNumber,
      email,
      unique_id: clinic?.unique_id || generateUniqueId(),
      is_active: isActive,
      created_at: clinic?.created_at,
      updated_at: clinic?.updated_at,
    };
    onSave(data as Clinic);
  };

  const generateUniqueId = () => {
    return 'CLINIC_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  };

  const reset = () => {
    setName(clinic?.name || '');
    setLocation(clinic?.location || '');
    setPhoneNumber(clinic?.phone_number || '');
    setEmail(clinic?.email || '');
    setIsActive(clinic?.is_active ?? true);
  };

  useEffect(() => {
    if (isOpen) reset();
  }, [isOpen, clinic]);

  return (
    <CustomModal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={clinic ? "עריכת מרפאה" : "מרפאה חדשה"} 
      onConfirm={handleConfirm} 
      confirmText="שמירה" 
      cancelText="ביטול"
      width="max-w-2xl"
    >
      <div className="space-y-6" dir="rtl">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-medium">שם המרפאה</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="הכנס שם למרפאה"
            className="w-full"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-medium">טלפון</Label>
            <Input
              id="phone"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="מספר טלפון"
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">אימייל</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="כתובת אימייל"
              className="w-full"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="location" className="text-sm font-medium">כתובת</Label>
          <Input
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="כתובת המרפאה"
            className="w-full"
          />
        </div>

      </div>
    </CustomModal>
  );
}

const ControlCenterClinicsPage: React.FC = () => {
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClinic, setEditingClinic] = useState<Clinic | undefined>(undefined);
  const { refreshClinics } = useUser();

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

      const clinicsResult = await apiClient.getClinicsByCompany(parsedCompany.id!);
      const clinicsData = clinicsResult.data || [];
      setClinics(clinicsData);
    } catch (error) {
      console.error('Error loading clinics data:', error);
      toast.error('שגיאה בטעינת נתוני המרפאות');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (data: Clinic) => {
    try {
      if (data.id) {
        const resultResponse = await apiClient.updateClinic(data.id!, data);
        const result = resultResponse.data;
        if (result) {
          setClinics(clinics.map(c => c.id === data.id ? result : c));
          toast.success("מרפאה עודכנה בהצלחה");
        } else {
          throw new Error('Failed to update clinic');
        }
      } else {
        if (!company) {
          toast.error('לא נמצאו נתוני החברה');
          return;
        }

        const clinicData = {
          ...data,
          company_id: company.id
        };

        const resultResponse = await apiClient.createClinic(clinicData);
        const result = resultResponse.data;
        if (result) {
          setClinics([result, ...clinics]);
          toast.success("מרפאה נוצרה בהצלחה");
        } else {
          throw new Error('Failed to create clinic');
        }
      }
      setIsModalOpen(false);
      setEditingClinic(undefined);
      refreshClinics();
    } catch (error) {
      console.error('Error saving clinic:', error);
      toast.error("שגיאה בשמירת המרפאה");
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("האם אתה בטוח שברצונך להשבית מרפאה זו?")) {
      const originalClinics = clinics;
      setClinics(clinics.filter(c => c.id !== id));
      
      try {
        const resultResponse = await apiClient.deleteClinic(id);
        const result = resultResponse.data;
        if (!result) {
          throw new Error('Failed to delete clinic');
        }
        toast.success("מרפאה הושבתה בהצלחה");
      } catch (error) {
        console.error('Error deleting clinic:', error);
        setClinics(originalClinics);
        toast.error("שגיאה בהשבתת המרפאה");
      }
      refreshClinics();
    }
  };

  const handleToggleStatus = async (clinic: Clinic) => {
    const optimisticClinics = clinics.map(c => 
      c.id === clinic.id 
        ? { ...c, is_active: !c.is_active }
        : c
    );
    setClinics(optimisticClinics);

    try {
      const updatedClinic = {
        ...clinic,
        is_active: !clinic.is_active
      };
      
      const resultResponse = await apiClient.updateClinic(clinic.id!, updatedClinic);
      const result = resultResponse.data;
      
      if (!result) {
        throw new Error('Failed to update clinic');
      }
      
      toast.success(updatedClinic.is_active ? "מרפאה הופעלה" : "מרפאה הושבתה");
    } catch (error) {
      console.error('Error toggling clinic status:', error);
      setClinics(clinics);
      toast.error("שגיאה בעדכון סטטוס המרפאה");
    }
    refreshClinics();
  };

  const openModal = (clinic?: Clinic) => {
    setEditingClinic(clinic);
    setIsModalOpen(true);
  };

  const getClinicStats = async (clinicId: number) => {
    try {
      const usersResponse = await apiClient.getUsersByClinic(clinicId);
      const appointmentsResponse = await apiClient.getAppointments(clinicId);
      const users = usersResponse.data || [];
      const appointments = appointmentsResponse.data || [];
      return {
        users: users.length,
        appointments: appointments.length
      };
    } catch {
      return { users: 0, appointments: 0 };
    }
  };

  if (loading) {
    return (
      <>
        <SiteHeader title="ניהול מרפאות" />
        <div className="flex items-center justify-center h-full">
          <div className="text-lg">טוען מרפאות...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <SiteHeader title="ניהול מרפאות" />
      <div className="h-full overflow-auto bg-muted/30" style={{scrollbarWidth: 'none'}} dir="rtl">
        <div className="max-w-7xl mx-auto p-6 pb-20 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">מרפאות</h1>
              <p className="text-muted-foreground">נהל את כל מרפאות החברה</p>
            </div>
            <Button onClick={() => openModal()} size="lg" className="gap-2">
              <Plus className="h-5 w-5" />
              מרפאה חדשה
            </Button>
          </div>

          {clinics.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">אין מרפאות</h3>
                <p className="text-muted-foreground text-center mb-4">
                  צור מרפאה ראשונה כדי להתחיל לנהל את הפעילות
                </p>
                <Button onClick={() => openModal()}>
                  <Plus className="h-4 w-4 mr-2" />
                  צור מרפאה ראשונה
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {clinics.map(clinic => (
                <Card key={clinic.id} className="group hover:shadow-lg transition-all duration-300 border-0 shadow-sm bg-gradient-to-br from-white to-gray-50/50">
                  <CardContent className="px-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-sm mb-1 truncate pr-2">
                          {clinic.name}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <MapPin className="h-3 w-3" />
                          {clinic.location ? clinic.location.substring(0, 30) + (clinic.location.length > 30 ? '...' : '') : 'ללא כתובת'}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openModal(clinic)}
                            className="h-6 w-6 p-0 hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(clinic.id!)}
                            className="h-6 w-6 p-0 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-3 p-2 rounded-lg bg-gray-50/50">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${clinic.is_active ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <span className="text-xs font-medium text-gray-600">
                          {clinic.is_active ? 'פעילה' : 'לא פעילה'}
                        </span>
                      </div>
                      <Switch dir="ltr"
                        checked={clinic.is_active}
                        onCheckedChange={() => handleToggleStatus(clinic)}
                        className="scale-75"
                      />
                    </div>

                    <div className="mb-3">
                      <div className="text-center p-2 py-3 rounded-md bg-blue-50/50 relative">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(clinic.unique_id);
                          }}
                          className="absolute left-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-blue-100 hover:text-blue-700"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <div className="text-xs font-semibold text-blue-600">
                          {clinic.unique_id}
                        </div>
                      </div>
                      
                    </div>

                    <div className="flex items-center gap-4">
                      {clinic.phone_number && (
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <Phone className="h-3 w-3" />
                          {clinic.phone_number}
                        </div>
                      )}
                      {clinic.email && (
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <Mail className="h-3 w-3" />
                          {clinic.email}
                        </div>
                      )}
                    </div>

                    <div className="w-full mt-3">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full h-8 bg-gradient-to-r from-blue-50 to-green-50 hover:from-blue-100 hover:to-green-100 border-blue-200 text-blue-700 hover:text-blue-800 text-xs font-medium"
                        onClick={() => {
                          sessionStorage.setItem('selectedClinic', JSON.stringify(clinic));
                          router.navigate({ to: '/clinic-entrance' });
                        }}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        כניסה למרפאה
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <ClinicModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        clinic={editingClinic} 
        onSave={handleSave} 
      />
    </>
  );
};

export default ControlCenterClinicsPage;