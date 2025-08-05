import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building2, Stethoscope, Settings, Users } from 'lucide-react'
import { useRouter } from '@tanstack/react-router'
import { apiClient } from '@/lib/api-client'
import { OctahedronLoader } from '@/components/ui/octahedron-loader'

export default function WelcomeScreen() {
  const [isMultiClinicMode, setIsMultiClinicMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkMultiClinicMode = async () => {
      try {
        const companiesResponse = await apiClient.getCompaniesPublic()
        const companies = companiesResponse.data || []
        setIsMultiClinicMode(companies.length > 0)
      } catch (error) {
        console.error('Error checking multi-clinic mode:', error)
        setIsMultiClinicMode(false)
      } finally {
        setLoading(false)
      }
    }

    checkMultiClinicMode()
  }, [])

  const handleControlCenterClick = () => {
    // Navigate to control center login/setup
    router.navigate({ to: '/control-center' })
  }

  const handleClinicEntranceClick = () => {
    // Clear any existing clinic data when user explicitly chooses clinic entrance
    sessionStorage.removeItem('selectedClinic');
    sessionStorage.removeItem('currentUser');
    
    // Navigate to clinic entrance flow
    router.navigate({ to: '/clinic-entrance' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
      <OctahedronLoader size="3xl" />
    </div>
)
  }

  return (
    <div className="h-full bg-accent/50  dark:bg-slate-900  flex items-center justify-center" dir="rtl">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center">
            <img src="/src/assets/images/prysm-logo.png" alt="Prysm Logo" className="w-26 h-26 pb-5 object-contain" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            ברוכים הבאים למערכת ניהול המרפאה
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            בחרו את סוג הגישה המתאים לכם כדי להתחיל לעבוד עם המערכת
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {/* Control Center Card */}
          <Card 
            className="group cursor-pointer border-0 bg-white dark:bg-slate-800/80 backdrop-blur-sm hover:bg-white/60 dark:hover:bg-slate-800/90 transition-colors duration-200"
            onClick={handleControlCenterClick}
          >
            <CardHeader className="text-center pb-3">
              <div className="w-16 h-16 bg-general-secondary rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:bg-general-primary/80 transition-all duration-300 shadow-sm">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
                מרכז בקרה
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-3">
              <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed">
                ניהול כללי של כל המרפאות
              </p>
              <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-500">
                <div className="flex items-center justify-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>ניהול משתמשים גלובלי</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Building2 className="w-4 h-4" />
                  <span>ניהול מרפאות</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Settings className="w-4 h-4" />
                  <span>הגדרות מערכת</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Clinic Entrance Card */}
          <Card 
            className="group cursor-pointer border-0 bg-white dark:bg-slate-800/80 backdrop-blur-sm hover:bg-white/60 dark:hover:bg-slate-800/90 transition-colors duration-200"
            onClick={handleClinicEntranceClick}
          >
            <CardHeader className="text-center pb-3">
              <div className="w-16 h-16 bg-general-secondary rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:bg-general-primary/80 transition-all duration-300 shadow-sm">
                <Stethoscope className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
                כניסה למרפאה
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-3">
              <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed">
                כניסה ישירה לעבודה במרפאה ספציפית
              </p>
              <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-500">
                <div className="flex items-center justify-center gap-2">
                  <Stethoscope className="w-4 h-4" />
                  <span>עבודה יומיומית במרפאה</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>ניהול לקוחות ותורים</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Building2 className="w-4 h-4" />
                  <span>גישה למרפאה ספציפית</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}