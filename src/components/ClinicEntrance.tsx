import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Building2, ArrowLeft } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { authService } from '@/lib/auth/AuthService';

interface ClinicEntranceProps {
  onBackToWelcome?: () => void;
}

/**
 * ClinicEntrance - Clinic ID input component
 * Validates clinic unique ID and sets clinic session
 */
export function ClinicEntrance({ onBackToWelcome }: ClinicEntranceProps) {
  const [clinicId, setClinicId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!clinicId.trim()) {
        throw new Error('אנא הכנס מזהה מרפאה');
      }

      console.log('[ClinicEntrance] Looking up clinic:', clinicId.trim());

      const clinicResponse = await apiClient.getClinicByUniqueId(clinicId.trim());
      const clinic = clinicResponse.data;

      if (!clinic) {
        throw new Error('מזהה מרפאה לא נמצא במערכת');
      }

      if (!clinic.is_active) {
        throw new Error('המרפאה אינה פעילה');
      }

      console.log('[ClinicEntrance] Clinic found:', clinic.name);
      
      // Set clinic session (without user yet)
      authService.setClinicSession(clinic);
      
    } catch (error) {
      console.error('[ClinicEntrance] Error:', error);
      setError(error instanceof Error ? error.message : 'שגיאה בחיפוש המרפאה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
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
                  autoFocus
                />
              </div>
              <p className="text-xs text-gray-500">
                מזהה המרפאה מסופק על ידי מנהל המערכת
              </p>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-general-primary hover:bg-general-primary/80" 
              disabled={loading}
            >
              {loading ? 'מחפש מרפאה...' : 'כניסה למרפאה'}
              <ArrowLeft className="mr-2 h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>

      {onBackToWelcome && (
        <div className="text-center mt-6">
          <Button
            variant="ghost"
            onClick={onBackToWelcome}
            className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          >
            חזרה למסך הבית
          </Button>
        </div>
      )}
    </div>
  );
}