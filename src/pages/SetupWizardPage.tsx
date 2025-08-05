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

interface SetupWizardProps {}

interface ClinicData {
  companyName: string;
  name: string;
  location: string;
  phone_number: string;
  email: string;
}

interface SettingsData {
  clinic_name: string;
  clinic_position: string;
  clinic_email: string;
  clinic_phone: string;
  clinic_address: string;
  clinic_city: string;
  clinic_postal_code: string;
  manager_name: string;
  license_number: string;
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
  const password = search.password || '';
  const email = search.email || '';
  const phone = search.phone || '';
  
  console.log('SetupWizard - Loaded with companyId:', companyId);
  console.log('SetupWizard - Loaded with companyName:', companyName);
  console.log('SetupWizard - Loaded with username:', username);
  console.log('SetupWizard - SessionStorage company:', sessionStorage.getItem('controlCenterCompany'));
  console.log('SetupWizard - SessionStorage user:', sessionStorage.getItem('currentUser'));
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [company, setCompany] = useState<any>(null);
  const [ceoUser, setCeoUser] = useState<any>(null);

  useEffect(() => {
    if (companyId) {
      // This is an existing user coming to setup wizard, check authentication
      const companyData = sessionStorage.getItem('controlCenterCompany');
      const userData = sessionStorage.getItem('currentUser');
      
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
      setIsLoading(true);
      console.log('SetupWizard - Creating company and CEO...');

      let newCompany;
      let newCeoUser;

      // If we have username and password from registration form, this is a new registration
      // Always use public endpoints for new registrations
      if (username && password) {
        console.log('SetupWizard - New registration, using public endpoints');
        
        // Use public endpoints for new registration
        const newCompanyResponse = await apiClient.createCompanyPublic({
          name: companyName,
          owner_full_name: username,
          contact_email: email,
          contact_phone: phone,
          address: ''
        });
        newCompany = newCompanyResponse.data;

        const ceoUserResponse = await apiClient.createUserPublic({
          username: username,
          password: password,
          role: 'company_ceo',
          clinic_id: null,
          email: email,
          phone: phone
        });
        newCeoUser = ceoUserResponse.data;
      } else {
        // This is an existing user setting up additional clinic, authenticate first
        console.log('SetupWizard - Existing user, authenticating first');
        
        // Authenticate with the provided credentials
        const authResponse = await apiClient.authenticateUser(username, password);
        const authUser = authResponse.data;
        
        if (!authUser) {
          throw new Error('שם משתמש או סיסמה שגויים');
        }

        // Check if we got a token response or user response
        if ('access_token' in authUser) {
          // We got a token response, set it for authenticated requests
          apiClient.setToken(authUser.access_token);
        } else if ('role' in authUser) {
          // We got a user response, check if it's a CEO
          if (authUser.role !== 'company_ceo') {
            throw new Error('אין לך הרשאות ליצירת חברות');
          }
        } else {
          throw new Error('שם משתמש או סיסמה שגויים');
        }

        // Create the new company using authenticated endpoint
        const newCompanyResponse = await apiClient.createCompany({
          name: companyName,
          owner_full_name: username,
          contact_email: email,
          contact_phone: phone,
          address: ''
        });
        newCompany = newCompanyResponse.data;

        // Create the CEO user using authenticated endpoint
        const ceoUserResponse = await apiClient.createUser({
          username: username,
          password: password,
          role: 'company_ceo',
          clinic_id: null,
          email: email,
          phone: phone
        });
        newCeoUser = ceoUserResponse.data;
      }

      console.log('SetupWizard - Company and CEO created successfully');
      console.log('SetupWizard - Company:', newCompany);
      console.log('SetupWizard - CEO User:', newCeoUser);

      // Store authentication state
      sessionStorage.setItem('controlCenterCompany', JSON.stringify(newCompany));
      sessionStorage.setItem('currentUser', JSON.stringify(newCeoUser));

      return { newCompany, newCeoUser };

    } catch (error) {
      console.error('SetupWizard - Error creating company and CEO:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };
  
  const [clinicData, setClinicData] = useState<ClinicData>({
    companyName: '',
    name: '',
    location: '',
    phone_number: '',
    email: ''
  });

  const [settingsData, setSettingsData] = useState<SettingsData>({
    clinic_name: '',
    clinic_position: '',
    clinic_email: '',
    clinic_phone: '',
    clinic_address: '',
    clinic_city: '',
    clinic_postal_code: '',
    manager_name: '',
    license_number: '',
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
        return settingsData.clinic_name.trim() !== '' && settingsData.manager_name.trim() !== '';
      case 3:
        return true; // Review step is always valid
      default:
        return false;
    }
  };

  const handleFinish = async () => {
    setIsLoading(true);
    try {
      let finalCompanyId = company?.id || companyId;
      let finalCompany = company;

      // For new registrations, create company and CEO user first
      if (!finalCompanyId && username && password) {
        console.log('SetupWizard - Creating company and CEO for new registration');
        const result = await createCompanyAndCEO(clinicData.companyName);
        finalCompanyId = result.newCompany.id;
        finalCompany = result.newCompany;
        
        // Store authentication state
        sessionStorage.setItem('controlCenterCompany', JSON.stringify(result.newCompany));
        sessionStorage.setItem('currentUser', JSON.stringify(result.newCeoUser));
        
        // Authenticate the user for subsequent API calls
        console.log('SetupWizard - Authenticating user for clinic creation');
        const authResponse = await apiClient.authenticateUser(username, password);
        const authUser = authResponse.data;
        
        if (!authUser) {
          throw new Error('שם משתמש או סיסמה שגויים');
        }

        // Check if we got a token response or user response
        if ('access_token' in authUser) {
          // We got a token response, set it for authenticated requests
          apiClient.setToken(authUser.access_token);
          console.log('SetupWizard - Authentication token set');
        } else if ('role' in authUser) {
          // We got a user response, check if it's a CEO
          if (authUser.role !== 'company_ceo') {
            throw new Error('אין לך הרשאות ליצירת חברות');
          }
          console.log('SetupWizard - User authenticated successfully');
        } else {
          throw new Error('שם משתמש או סיסמה שגויים');
        }
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
          clinic_name: settingsData.clinic_name,
          clinic_position: settingsData.clinic_position,
          clinic_email: settingsData.clinic_email,
          clinic_phone: settingsData.clinic_phone,
          clinic_address: settingsData.clinic_address,
          clinic_city: settingsData.clinic_city,
          clinic_postal_code: settingsData.clinic_postal_code,
          manager_name: settingsData.manager_name,
          license_number: settingsData.license_number,
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
      sessionStorage.removeItem('selectedClinic');
      sessionStorage.removeItem('selectedUser');
      
      // Ensure user is set in UserContext before navigation
      const userData = sessionStorage.getItem('currentUser');
      if (userData) {
        try {
          const user = JSON.parse(userData);
          await setCurrentUser(user);
          console.log('SetupWizard - User set in context:', user);
        } catch (error) {
          console.error('SetupWizard - Error setting user in context:', error);
        }
      }
      
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
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Building2 className="mx-auto h-12 w-12 text-blue-600 mb-4" />
              <h2 className="text-2xl font-bold text-gray-900">הגדרת המרפאה הראשונה</h2>
              <p className="text-gray-600 mt-2">בואו נתחיל בהגדרת המרפאה הראשונה שלכם</p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="company-name">שם החברה *</Label>
                <Input
                  id="company-name"
                  value={clinicData.companyName}
                  onChange={(e) => handleClinicDataChange('companyName', e.target.value)}
                  placeholder="לדוגמה: חברת אופטיקה בע״מ"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="clinic-name">שם המרפאה *</Label>
                <Input
                  id="clinic-name"
                  value={clinicData.name}
                  onChange={(e) => handleClinicDataChange('name', e.target.value)}
                  placeholder="לדוגמה: מרפאת העיניים הראשית"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="clinic-location">מיקום המרפאה *</Label>
                <Input
                  id="clinic-location"
                  value={clinicData.location}
                  onChange={(e) => handleClinicDataChange('location', e.target.value)}
                  placeholder="לדוגמה: תל אביב, רחוב דיזנגוף 123"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="clinic-phone">טלפון המרפאה</Label>
                <Input
                  id="clinic-phone"
                  value={clinicData.phone_number}
                  onChange={(e) => handleClinicDataChange('phone_number', e.target.value)}
                  placeholder="לדוגמה: 03-1234567"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="clinic-email">אימייל המרפאה</Label>
                <Input
                  id="clinic-email"
                  type="email"
                  value={clinicData.email}
                  onChange={(e) => handleClinicDataChange('email', e.target.value)}
                  placeholder="לדוגמה: info@clinic.co.il"
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <User className="mx-auto h-12 w-12 text-blue-600 mb-4" />
              <h2 className="text-2xl font-bold text-gray-900">פרטי המרפאה והגדרות עבודה</h2>
              <p className="text-gray-600 mt-2">הגדירו את פרטי המרפאה ושעות העבודה</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="settings-clinic-name">שם המרפאה למסמכים *</Label>
                <Input
                  id="settings-clinic-name"
                  value={settingsData.clinic_name}
                  onChange={(e) => handleSettingsDataChange('clinic_name', e.target.value)}
                  placeholder="שם המרפאה כפי שיופיע במסמכים"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="manager-name">שם המנהל *</Label>
                <Input
                  id="manager-name"
                  value={settingsData.manager_name}
                  onChange={(e) => handleSettingsDataChange('manager_name', e.target.value)}
                  placeholder="לדוגמה: ד״ר יוסי כהן"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="clinic-position">מיקום במבנה</Label>
                <Input
                  id="clinic-position"
                  value={settingsData.clinic_position}
                  onChange={(e) => handleSettingsDataChange('clinic_position', e.target.value)}
                  placeholder="לדוגמה: קומה 2, חדר 15"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="license-number">מספר רישיון</Label>
                <Input
                  id="license-number"
                  value={settingsData.license_number}
                  onChange={(e) => handleSettingsDataChange('license_number', e.target.value)}
                  placeholder="לדוגמה: OPT-12345"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="settings-email">אימייל</Label>
                <Input
                  id="settings-email"
                  type="email"
                  value={settingsData.clinic_email}
                  onChange={(e) => handleSettingsDataChange('clinic_email', e.target.value)}
                  placeholder="info@clinic.co.il"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="settings-phone">טלפון</Label>
                <Input
                  id="settings-phone"
                  value={settingsData.clinic_phone}
                  onChange={(e) => handleSettingsDataChange('clinic_phone', e.target.value)}
                  placeholder="03-1234567"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="clinic-address">כתובת</Label>
                <Input
                  id="clinic-address"
                  value={settingsData.clinic_address}
                  onChange={(e) => handleSettingsDataChange('clinic_address', e.target.value)}
                  placeholder="רחוב הרצל 123"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="clinic-city">עיר</Label>
                <Input
                  id="clinic-city"
                  value={settingsData.clinic_city}
                  onChange={(e) => handleSettingsDataChange('clinic_city', e.target.value)}
                  placeholder="תל אביב"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="work-start">שעת התחלה</Label>
                <Input
                  id="work-start"
                  type="time"
                  value={settingsData.work_start_time}
                  onChange={(e) => handleSettingsDataChange('work_start_time', e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="work-end">שעת סיום</Label>
                <Input
                  id="work-end"
                  type="time"
                  value={settingsData.work_end_time}
                  onChange={(e) => handleSettingsDataChange('work_end_time', e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="appointment-duration">משך תור (דקות)</Label>
                <Input
                  id="appointment-duration"
                  type="number"
                  min="15"
                  max="120"
                  step="15"
                  value={settingsData.appointment_duration}
                  onChange={(e) => handleSettingsDataChange('appointment_duration', parseInt(e.target.value))}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="postal-code">מיקוד</Label>
                <Input
                  id="postal-code"
                  value={settingsData.clinic_postal_code}
                  onChange={(e) => handleSettingsDataChange('clinic_postal_code', e.target.value)}
                  placeholder="12345"
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Check className="mx-auto h-12 w-12 text-green-600 mb-4" />
              <h2 className="text-2xl font-bold text-gray-900">סיכום ההגדרות</h2>
              <p className="text-gray-600 mt-2">אנא בדקו את הפרטים לפני השלמת ההגדרה</p>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    פרטי החברה
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p><strong>שם החברה:</strong> {companyName}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    פרטי המרפאה
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p><strong>שם המרפאה:</strong> {clinicData.name}</p>
                  <p><strong>מיקום:</strong> {clinicData.location}</p>
                  {clinicData.phone_number && <p><strong>טלפון:</strong> {clinicData.phone_number}</p>}
                  {clinicData.email && <p><strong>אימייל:</strong> {clinicData.email}</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    הגדרות עבודה
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p><strong>מנהל המרפאה:</strong> {settingsData.manager_name}</p>
                  <p><strong>שעות עבודה:</strong> {settingsData.work_start_time} - {settingsData.work_end_time}</p>
                  <p><strong>משך תור:</strong> {settingsData.appointment_duration} דקות</p>
                  {settingsData.license_number && <p><strong>מספר רישיון:</strong> {settingsData.license_number}</p>}
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      {isLoading && !company ? (
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-900">
              יוצר חברה ומשתמש...
            </CardTitle>
            <CardDescription className="text-lg">
              אנא המתן בזמן יצירת החברה והמשתמש הראשונים
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card className="w-full max-w-4xl">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-gray-900">
              אשף הגדרת המערכת
            </CardTitle>
            <CardDescription className="text-lg">
              שלב {currentStep} מתוך {totalSteps}
            </CardDescription>
            <div className="mt-4">
              <Progress value={progress} className="w-full" />
            </div>
          </CardHeader>

          <CardContent className="p-8">
            {renderStepContent()}

            <div className="flex justify-between mt-8">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 1}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                הקודם
              </Button>

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
                  {isLoading ? 'מגדיר...' : 'סיים הגדרה'}
                  <Check className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SetupWizardPage;