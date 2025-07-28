import React, { useState } from 'react';
import { useRouter } from '@tanstack/react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { ArrowRight, ArrowLeft, Building2, MapPin, Phone, Mail, User, Check } from 'lucide-react';
import { toast } from 'sonner';

interface SetupWizardProps {
  companyId: number;
  companyName: string;
}

interface ClinicData {
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

const SetupWizardPage: React.FC<SetupWizardProps> = ({ companyId, companyName }) => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  const [clinicData, setClinicData] = useState<ClinicData>({
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
        return clinicData.name.trim() !== '' && clinicData.location.trim() !== '';
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
      // Generate unique clinic ID
      const uniqueId = `clinic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create clinic
      const clinic = await window.electronAPI.db('createClinic', {
        company_id: companyId,
        name: clinicData.name,
        location: clinicData.location,
        phone_number: clinicData.phone_number || null,
        email: clinicData.email || null,
        unique_id: uniqueId,
        is_active: true
      });

      if (!clinic) {
        throw new Error('Failed to create clinic');
      }

      // Create clinic settings
      await window.electronAPI.db('createSettings', {
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

      toast.success('הגדרת המערכת הושלמה בהצלחה!');
      
      // Navigate to control center dashboard
      router.navigate({ to: '/control-center/dashboard' });
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
    </div>
  );
};

export default SetupWizardPage;