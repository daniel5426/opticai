import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Building2, ArrowRight, ArrowLeft, Settings } from 'lucide-react';
import { useRouter } from '@tanstack/react-router';
import { useUser } from '@/contexts/UserContext';
import { apiClient } from '@/lib/api-client';

export default function ClinicEntrancePage() {
  const [clinicId, setClinicId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasCompanies, setHasCompanies] = useState<boolean | null>(null);
  const [checkingSystem, setCheckingSystem] = useState(true);
  const router = useRouter();
  const { currentUser, isLoading } = useUser();

  useEffect(() => {
    const checkSystemSetup = async () => {
      try {
        const companiesResponse = await apiClient.getCompaniesPublic();
        const companies = companiesResponse.data || [];
        setHasCompanies(companies.length > 0);
        
        console.log('ClinicEntrancePage: currentUser:', currentUser);
        console.log('ClinicEntrancePage: isLoading:', isLoading);
        
        // Only auto-redirect if there's no current user logged in AND not loading
        if (!currentUser && !isLoading) {
          console.log('ClinicEntrancePage: No current user and not loading, checking for clinic data');
          // Check if there's already a selected clinic in sessionStorage
          const selectedClinicData = sessionStorage.getItem('selectedClinic');
          console.log('ClinicEntrancePage: selectedClinicData exists:', !!selectedClinicData);
          
          if (selectedClinicData) {
            try {
              const clinic = JSON.parse(selectedClinicData);
              // Verify the clinic still exists and is active
              const existingClinicResponse = await apiClient.getClinicByUniqueId(clinic.unique_id);
              const existingClinic = existingClinicResponse.data;
              console.log('ClinicEntrancePage: existingClinic:', existingClinic);
              
              if (existingClinic && existingClinic.is_active) {
                // Automatically redirect to user selection
                console.log('ClinicEntrancePage: Auto-redirecting to user-selection');
                router.navigate({ to: '/user-selection' });
                return;
              } else {
                // Clinic no longer exists or is inactive, remove from sessionStorage
                console.log('ClinicEntrancePage: Clinic no longer exists or inactive, clearing data');
                sessionStorage.removeItem('selectedClinic');
              }
            } catch (error) {
              console.error('Error parsing selected clinic data:', error);
              sessionStorage.removeItem('selectedClinic');
            }
          }
        } else {
          console.log('ClinicEntrancePage: User is logged in or still loading, not auto-redirecting');
        }
      } catch (error) {
        console.error('Error checking system setup:', error);
        setHasCompanies(false);
      } finally {
        setCheckingSystem(false);
      }
    };

    checkSystemSetup();
  }, [router, currentUser, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!clinicId.trim()) {
        throw new Error('אנא הכנס מזהה מרפאה');
      }

      // Find clinic by unique_id
      const clinicResponse = await apiClient.getClinicByUniqueId(clinicId.trim());
      const clinic = clinicResponse.data;

      if (!clinic) {
        throw new Error('מזהה מרפאה לא נמצא במערכת');
      }

      if (!clinic.is_active) {
        throw new Error('המרפאה אינה פעילה');
      }

      // Store clinic context for user selection
      sessionStorage.setItem('selectedClinic', JSON.stringify(clinic));
      
      // Navigate to user selection page with clinic context
      router.navigate({ to: '/user-selection' });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'שגיאה בחיפוש המרפאה');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSystem) {
    return (
      <div className="h-full bg-accent/50 dark:bg-slate-900 flex items-center justify-center p-6">
        <div className="text-slate-600 dark:text-slate-400 text-lg">בודק הגדרות מערכת...</div>
      </div>
    );
  }

  if (hasCompanies === false) {
    return (
      <div className="h-full bg-accent/50 dark:bg-slate-900 flex items-center justify-center p-6" dir="rtl" style={{scrollbarWidth: 'none'}}>
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-general-secondary rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Settings className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              המערכת טרם הוגדרה
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              יש להגדיר חברה ומרפאות במערכת לפני הכניסה למרפאה
            </p>
          </div>

          <Card className="bg-white dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl">
            <CardContent className="p-6 text-center space-y-4">
              <p className="text-slate-700 dark:text-slate-300">
                כדי להשתמש בכניסה למרפאה, יש להגדיר תחילה את המערכת דרך מרכז הבקרה.
              </p>
              
              <Button
                onClick={() => router.navigate({ to: '/control-center' })}
                className="w-full bg-general-primary hover:bg-general-primary/80"
              >
                <Settings className="ml-2 h-4 w-4" />
                מעבר למרכז הבקרה
              </Button>
            </CardContent>
          </Card>

          {/* Back to Welcome */}
          <div className="text-center mt-6">
            <Button
              variant="ghost"
              onClick={() => router.navigate({ to: '/' })}
              className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            >
              <ArrowLeft className="ml-2 h-4 w-4" />
              חזרה למסך הבית
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-accent/50 dark:bg-slate-900 flex items-center justify-center p-6" dir="rtl" style={{scrollbarWidth: 'none'}}>
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-general-secondary rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            כניסה למרפאה
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            הכנס את מזהה המרפאה כדי להיכנס
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50 text-red-800">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="bg-white dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl" dir="rtl">
          <CardHeader>
            <CardTitle className="text-center text-xl">מזהה המרפאה</CardTitle>
          </CardHeader>
          <CardContent className="p-6" dir="rtl">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2" dir="rtl">
                <Label htmlFor="clinicId">מזהה המרפאה</Label>
                <div className="relative">
                  <Building2 className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="clinicId"
                    type="text"
                    value={clinicId}
                    onChange={(e) => setClinicId(e.target.value)}
                    placeholder="לדוגמה: clinic_123456"
                    className="pr-10"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500">
                  מזהה המרפאה מסופק על ידי מנהל המערכת
                </p>
              </div>

              <Button type="submit" className="w-full bg-general-primary hover:bg-general-primary/80" disabled={loading}>
                {loading ? 'מחפש מרפאה...' : 'כניסה למרפאה'}
                <ArrowLeft className="mr-2 h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Back to Welcome */}
        <div className="text-center mt-6">
          <Button
            variant="ghost"
            onClick={() => router.navigate({ to: '/' })}
            className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          >
            חזרה למסך הבית
          </Button>
        </div>
      </div>
    </div>
  );
}