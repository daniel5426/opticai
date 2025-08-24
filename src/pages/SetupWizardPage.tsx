import React, { useState, useEffect } from 'react';
import { useRouter, useSearch } from '@tanstack/react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { ArrowRight, ArrowLeft, Building2, MapPin, Phone, Mail, User, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { apiClient } from '@/lib/api-client';
import { supabase } from '@/lib/supabaseClient';
import type { Company } from '@/lib/db/schema-interface';

interface SetupWizardProps {}

interface ClinicData {
  companyName: string;
  name: string;
  location: string;
  phone_number: string;
  email: string;
}

interface SettingsData {
  work_start_time: string;
  work_end_time: string;
  appointment_duration: number;
}

const SetupWizardPage: React.FC<SetupWizardProps> = () => {
  const router = useRouter();
  const search = useSearch({ from: '/setup-wizard' });
  const { setCurrentUser } = useUser();
  const companyId = parseInt(search.companyId || '0');
  const companyName = search.companyName || '';
  const username = search.username || '';
  const full_name = (search as any).full_name || '';
  const password = search.password || '';
  const email = search.email || '';
  const phone = search.phone || '';
  
  console.log('SetupWizard - Loaded with companyId:', companyId);
  console.log('SetupWizard - Loaded with companyName:', companyName);
  console.log('SetupWizard - Loaded with username:', username);
  console.log('SetupWizard - Storage company:', localStorage.getItem('controlCenterCompany'));
  console.log('SetupWizard - Storage user:', localStorage.getItem('currentUser'));
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [company, setCompany] = useState<any>(null);
  const [ceoUser, setCeoUser] = useState<any>(null);

  useEffect(() => {
    if (companyId) {
      // This is an existing user coming to setup wizard, check authentication
      const companyData = localStorage.getItem('controlCenterCompany');
      const userData = localStorage.getItem('currentUser');
      
      if (!companyData || !userData) {
        console.log('SetupWizard - Authentication state lost, redirecting to control center');
        router.navigate({ to: '/control-center' });
      }
    } else if (!username || !password) {
      // No valid parameters, redirect to control center
      console.log('SetupWizard - No valid parameters, redirecting to control center');
      router.navigate({ to: '/control-center' });
    }
    // For new registrations (username && password && !companyId), we'll create company/CEO in handleFinish
  }, [router, username, password, companyId]);

  const createCompanyAndCEO = async (companyName: string): Promise<{ newCompany: any; newCeoUser: any }> => {
    try {
      console.log('SetupWizard - Creating company and CEO...');

      let newCompany: Company | null = null;
      let newCeoUser;

      // If we have username and password from registration form, this is a new registration
      // Ensure Supabase session exists for protected API calls
      if (username && password) {
        console.log('SetupWizard - New registration, using public endpoints');
        const { data: sessionData } = await supabase.auth.getSession()
        if (!sessionData?.session) {
          const { error: siErr } = await supabase.auth.signInWithPassword({ email, password })
          if (siErr) throw new Error('שגיאה בהתחברות לסשן אימות')
        }
        
        // Use public endpoints for new registration
        const newCompanyResponse = await apiClient.createCompanyPublic({
          name: companyName,
          owner_full_name: full_name || username,
          contact_email: email,
          contact_phone: phone,
          address: ''
        });
        newCompany = newCompanyResponse.data as Company;

        const ceoUserResponse = await apiClient.createUserPublic({
          username: username,
          full_name: full_name || username,
          password: password,
          role: 'company_ceo',
          clinic_id: null,
          company_id: newCompany?.id,
          email: email,
          phone: phone
        });
        newCeoUser = ceoUserResponse.data;
      } else {
        // This is an existing user setting up additional clinic, authenticate first
        console.log('SetupWizard - Existing user, authenticating first');
        const me = await apiClient.getCurrentUser();
        const authUser = me.data as any;
        if (!authUser) throw new Error('חיבור אימות חסר')
        if (authUser.role !== 'company_ceo') throw new Error('רק מנכ"ל החברה יכול ליצור חברות')

        // Create the new company using authenticated endpoint
        const newCompanyResponse = await apiClient.createCompany({
          name: companyName,
          owner_full_name: full_name || username,
          contact_email: email,
          contact_phone: phone,
          address: ''
        });
        newCompany = newCompanyResponse.data as Company;

        // Create the CEO user using authenticated endpoint
        const ceoUserResponse = await apiClient.createUser({
          username: username,
          full_name: full_name || username,
          password: password,
          role: 'company_ceo',
          clinic_id: null,
          company_id: newCompany?.id,
          email: email,
          phone: phone
        });
        newCeoUser = ceoUserResponse.data;
      }

      console.log('SetupWizard - Company and CEO created successfully');
      console.log('SetupWizard - Company:', newCompany);
      console.log('SetupWizard - CEO User:', newCeoUser);

      // Store authentication state
      localStorage.setItem('controlCenterCompany', JSON.stringify(newCompany));
      localStorage.setItem('currentUser', JSON.stringify(newCeoUser));

      return { newCompany, newCeoUser };

    } catch (error) {
      console.error('SetupWizard - Error creating company and CEO:', error);
      throw error;
    }
  };
  
  const [clinicData, setClinicData] = useState<ClinicData>({
    companyName: companyName || 'חברת הדגמה בע"מ',
    name: 'מרפאה ראשית',
    location: 'תל אביב, דיזנגוף 123',
    phone_number: '03-1234567',
    email: 'info@clinic.co.il'
  });

  const [settingsData, setSettingsData] = useState<SettingsData>({
    work_start_time: '08:00',
    work_end_time: '18:00',
    appointment_duration: 30
  });

  const totalSteps = 3;
  const progress = (currentStep / totalSteps) * 100;

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClinicDataChange = (field: keyof ClinicData, value: string) => {
    setClinicData(prev => ({ ...prev, [field]: value }));
  };

  const handleSettingsDataChange = (field: keyof SettingsData, value: string | number) => {
    setSettingsData(prev => ({ ...prev, [field]: value }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return clinicData.companyName.trim() !== '' && clinicData.name.trim() !== '' && clinicData.location.trim() !== '';
      case 2:
        return true;
      case 3:
        return true; // Review step is always valid
      default:
        return false;
    }
  };

  const handleFinish = async () => {
    setIsLoading(true);
    try {
      const ensureSession = async () => {
        const { data: sess } = await supabase.auth.getSession()
        if (!sess?.session) {
          if (email && password) {
            const { error: siErr } = await supabase.auth.signInWithPassword({ email, password })
            if (siErr) throw new Error('שגיאת אימות – נסה להתחבר שוב')
          } else {
            throw new Error('חיבור אימות חסר')
          }
        }
      }
      await ensureSession()

      let finalCompanyId = company?.id || companyId;
      let finalCompany = company;

      // For new registrations, create company and CEO user first
      if (!finalCompanyId && username && password) {
        console.log('SetupWizard - Creating company and CEO for new registration');
        const result = await createCompanyAndCEO(clinicData.companyName);
        finalCompanyId = result.newCompany.id;
        finalCompany = result.newCompany;
        
        // Store authentication state
        localStorage.setItem('controlCenterCompany', JSON.stringify(result.newCompany));
        localStorage.setItem('currentUser', JSON.stringify(result.newCeoUser));
        
        console.log('SetupWizard - Verifying current user role for clinic creation');
        const me = await apiClient.getCurrentUser();
        const authUser = me.data as any;
        if (!authUser) throw new Error('חיבור אימות חסר')
        if (authUser.role !== 'company_ceo') throw new Error('רק מנכ"ל החברה יכול ליצור חברות')
       }
      
      if (!finalCompanyId) {
        throw new Error('No company ID available');
      }

      // Generate unique clinic ID
      const uniqueId = `clinic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create clinic
      const clinicResponse = await apiClient.createClinic({
        company_id: finalCompanyId,
        name: clinicData.name,
        location: clinicData.location,
        phone_number: clinicData.phone_number || null,
        email: clinicData.email || null,
        unique_id: uniqueId,
        is_active: true
      });
      const clinic = clinicResponse.data;

      if (!clinic) {
        throw new Error('Failed to create clinic');
      }

      // Create clinic settings
      console.log('SetupWizard - Creating settings for clinic:', clinic.id);
      console.log('SetupWizard - Settings data:', settingsData);
      try {
        const settingsResponse = await apiClient.createSettings({
          clinic_id: clinic.id,
          work_start_time: settingsData.work_start_time,
          work_end_time: settingsData.work_end_time,
          appointment_duration: settingsData.appointment_duration
        });
        console.log('SetupWizard - Settings created successfully:', settingsResponse);
        
        // Add a small delay to ensure settings are committed
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify settings were created by trying to fetch them
        try {
          if (clinic.id) {
            const verifySettings = await apiClient.getSettingsByClinic(clinic.id);
            console.log('SetupWizard - Settings verification successful:', verifySettings);
          }
        } catch (verifyError) {
          console.error('SetupWizard - Settings verification failed:', verifyError);
        }
      } catch (settingsError) {
        console.error('SetupWizard - Error creating settings:', settingsError);
        throw new Error(`Failed to create settings: ${settingsError}`);
      }

      toast.success('הגדרת המערכת הושלמה בהצלחה!');
      
      // Clear any old sessionStorage data that might cause conflicts
      localStorage.removeItem('selectedClinic');
      localStorage.removeItem('selectedUser');
      
      // Ensure user is set in UserContext before navigation
      try {
        let userData = localStorage.getItem('currentUser');
        if (!userData || userData === 'undefined') {
          const me = await apiClient.getCurrentUser();
          if (me.data) {
            localStorage.setItem('currentUser', JSON.stringify(me.data));
            userData = JSON.stringify(me.data);
          }
        }
        if (userData) {
          const user = JSON.parse(userData);
          await setCurrentUser(user);
        }
      } catch {}

      try {
        if (!localStorage.getItem('controlCenterCompany') && finalCompanyId) {
          const c = await apiClient.getCompany(finalCompanyId);
          if (c.data) {
            localStorage.setItem('controlCenterCompany', JSON.stringify(c.data));
          }
        }
      } catch {}
      
      console.log('Setup wizard - Navigating to dashboard with auth data');
      // Navigate to control center dashboard with authentication data
      router.navigate({ 
        to: '/control-center/dashboard',
        search: {
          companyId: finalCompanyId.toString(),
          companyName: finalCompany?.name || companyName,
          fromSetup: 'true'
        }
      });
    } catch (error) {
      console.error('Setup wizard error:', error);
      toast.error('שגיאה בהגדרת המערכת. אנא נסה שוב.');
      setIsLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-4">
              <Building2 className="mx-auto h-10 w-10 text-blue-600 mb-3" />
              <h2 className="text-xl font-bold text-gray-900">הגדרת המרפאה הראשונה</h2>
              <p className="text-gray-600 mt-1 text-sm">בואו נתחיל בהגדרת המרפאה הראשונה שלכם</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="company-name" className="text-sm">שם החברה *</Label>
                <Input
                  id="company-name"
                  value={clinicData.companyName}
                  onChange={(e) => handleClinicDataChange('companyName', e.target.value)}
                  placeholder="לדוגמה: חברת אופטיקה בע״מ"
                  className="mt-1 h-9 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="clinic-name" className="text-sm">שם המרפאה *</Label>
                <Input
                  id="clinic-name"
                  value={clinicData.name}
                  onChange={(e) => handleClinicDataChange('name', e.target.value)}
                  placeholder="לדוגמה: מרפאת העיניים הראשית"
                  className="mt-1 h-9 text-sm"
                />
              </div>

              <div className="space-y-1 lg:col-span-1 md:col-span-2 col-span-1">
                <Label htmlFor="clinic-location" className="text-sm">מיקום המרפאה *</Label>
                <Input
                  id="clinic-location"
                  value={clinicData.location}
                  onChange={(e) => handleClinicDataChange('location', e.target.value)}
                  placeholder="לדוגמה: תל אביב, רחוב דיזנגוף 123"
                  className="mt-1 h-9 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="clinic-phone" className="text-sm">טלפון המרפאה</Label>
                <Input
                  id="clinic-phone"
                  value={clinicData.phone_number}
                  onChange={(e) => handleClinicDataChange('phone_number', e.target.value)}
                  placeholder="לדוגמה: 03-1234567"
                  className="mt-1 h-9 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="clinic-email" className="text-sm">אימייל המרפאה</Label>
                <Input
                  id="clinic-email"
                  type="email"
                  value={clinicData.email}
                  onChange={(e) => handleClinicDataChange('email', e.target.value)}
                  placeholder="לדוגמה: info@clinic.co.il"
                  className="mt-1 h-9 text-sm"
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-4">
              <User className="mx-auto h-10 w-10 text-blue-600 mb-3" />
              <h2 className="text-xl font-bold text-gray-900">פרטי המרפאה והגדרות עבודה</h2>
              <p className="text-gray-600 mt-1 text-sm">הגדירו את פרטי המרפאה ושעות העבודה</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="work-start" className="text-sm">שעת התחלה</Label>
                <Input
                  id="work-start"
                  type="time"
                  value={settingsData.work_start_time}
                  onChange={(e) => handleSettingsDataChange('work_start_time', e.target.value)}
                  className="mt-1 h-9 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="work-end" className="text-sm">שעת סיום</Label>
                <Input
                  id="work-end"
                  type="time"
                  value={settingsData.work_end_time}
                  onChange={(e) => handleSettingsDataChange('work_end_time', e.target.value)}
                  className="mt-1 h-9 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="appointment-duration" className="text-sm">משך תור (דקות)</Label>
                <Input
                  id="appointment-duration"
                  type="number"
                  min="15"
                  max="120"
                  step="15"
                  value={settingsData.appointment_duration}
                  onChange={(e) => handleSettingsDataChange('appointment_duration', parseInt(e.target.value))}
                  className="mt-1 h-9 text-sm"
                />
              </div>

              
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-4">
              <Check className="mx-auto h-10 w-10 text-green-600 mb-3" />
              <h2 className="text-xl font-bold text-gray-900">סיכום ההגדרות</h2>
              <p className="text-gray-600 mt-1 text-sm">אנא בדקו את הפרטים לפני השלמת ההגדרה</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="h-5 w-5" />
                    פרטי החברה
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p>שם החברה: {companyName || clinicData.companyName}</p>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MapPin className="h-5 w-5" />
                    פרטי המרפאה
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <p>שם המרפאה: {clinicData.name}</p>
                  <p>מיקום: {clinicData.location}</p>
                  {clinicData.phone_number && <p>טלפון: {clinicData.phone_number}</p>}
                  {clinicData.email && <p>אימייל: {clinicData.email}</p>}
                </CardContent>
              </Card>

              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <User className="h-5 w-5" />
                    הגדרות עבודה
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                  <p>שעות עבודה: {settingsData.work_start_time} - {settingsData.work_end_time}</p>
                  <p>משך תור: {settingsData.appointment_duration} דקות</p>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-full bg-accent/50 dark:bg-slate-900 flex items-center justify-center p-6" dir="rtl" style={{ scrollbarWidth: 'none' }}>
      {isLoading ? (
        <Card className="w-full max-w-md bg-white dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-900">
              מבצע הגדרה ושמירה...
            </CardTitle>
            <CardDescription className="text-lg">
              אנא המתן לסיום התהליך והעברה ללוח הבקרה
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center pb-6">
            <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full max-w-5xl bg-white dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl" dir="rtl">
          <CardHeader className="text-center pb-3">
            <CardTitle className="text-3xl font-bold text-slate-900 dark:text-slate-100">
             הגדרת המערכת
            </CardTitle>
            <CardDescription className="text-lg">
              שלב {currentStep} מתוך {totalSteps}
            </CardDescription>
            <div className="mt-4 px-6">
              <Progress value={progress} className="w-full" />
            </div>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs">
              <div className={`px-2 py-1 rounded-md ${currentStep === 1 ? 'bg-primary text-white' : 'bg-muted'}`}>פרטי חברה ומרפאה</div>
              <div className={`px-2 py-1 rounded-md ${currentStep === 2 ? 'bg-primary text-white' : 'bg-muted'}`}>הגדרות עבודה</div>
              <div className={`px-2 py-1 rounded-md ${currentStep === 3 ? 'bg-primary text-white' : 'bg-muted'}`}>סיכום</div>
            </div>
          </CardHeader>

          <CardContent className="p-6 sm:p-8" dir="rtl" style={{ scrollbarWidth: 'none' }}>
            {renderStepContent()}

            <div className="flex justify-between mt-8">
              {currentStep < totalSteps ? (
                <Button
                  onClick={handleNext}
                  disabled={!validateStep(currentStep)}
                  className="flex items-center gap-2"
                >
                  הבא
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleFinish}
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      מגדיר...
                    </>
                  ) : (
                    <>
                      סיים הגדרה
                      <Check className="h-4 w-4" />
                    </>
                  )}
                </Button>
              )}

              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 1}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                הקודם
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SetupWizardPage;