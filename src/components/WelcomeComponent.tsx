import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building2, Stethoscope, Settings, Users } from 'lucide-react'
import { useRouter } from '@tanstack/react-router'
import { apiClient } from '@/lib/api-client'
import { OctahedronLoader } from '@/components/ui/octahedron-loader'
import { authService, AuthState } from '@/lib/auth/AuthService'
import { useUser } from '@/contexts/UserContext'
import { Skeleton } from '@/components/ui/skeleton'

interface WelcomeComponentProps {
  onControlCenterClick: () => void
  onClinicEntranceClick: () => void
}

export function WelcomeComponent({ onControlCenterClick, onClinicEntranceClick }: WelcomeComponentProps) {
  const [isMultiClinicMode, setIsMultiClinicMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { authState } = useUser()

  useEffect(() => {
    const bootstrap = async () => {
      try {
        console.log('WelcomeComponent: Starting bootstrap with auth state:', authState)

        // Let AuthService handle navigation for authenticated and setup states
        if (authState === AuthState.AUTHENTICATED || authState === AuthState.SETUP_REQUIRED) {
          console.log('WelcomeComponent: Auth state handled by AuthService, not bootstrapping')
          return
        }

        if (authState === AuthState.LOADING) {
          return
        }

        // Only handle welcome screen logic for unauthenticated state
        const companiesResponse = await apiClient.getCompaniesPublic()
        const companies = companiesResponse.data || []
        setIsMultiClinicMode(companies.length > 0)

        // AuthService handles navigation automatically based on state changes

      } catch (error) {
        console.error('WelcomeComponent: Bootstrap error:', error)
      } finally {
        setLoading(false)
      }
    }

    if (authState !== AuthState.LOADING) {
      bootstrap()
    }
  }, [authState])

  const handleControlCenterClick = () => {
    console.log('WelcomeComponent: Control center clicked')
    onControlCenterClick()
  }

  const handleClinicEntranceClick = () => {
    console.log('WelcomeComponent: Clinic entrance clicked')
    
    const keysToRemove = ['selectedClinic', 'currentUser', 'controlCenterCompany']
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key)
      } catch (error) {
        console.error(`Error removing ${key}:`, error)
      }
    })
    
    onClinicEntranceClick()
  }

  if (null) {
    return (
      <div className="h-full bg-accent/50 dark:bg-slate-900 flex items-center justify-center" dir="rtl">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-5">
              <Skeleton className="w-24 h-24 rounded-xl" />
            </div>
            <div className="flex flex-col items-center gap-3">
              <Skeleton className="h-8 w-72" />
              <Skeleton className="h-5 w-96" />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <div className="border-0 bg-white dark:bg-slate-800/80 backdrop-blur-sm rounded-xl p-6 shadow-sm">
              <div className="text-center pb-15">
                <div className="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-sm">
                  <Skeleton className="w-8 h-8 rounded-md" />
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Skeleton className="h-6 w-40" />
                </div>
              </div>
              <div className="text-center space-y-3 pb-2">
                <Skeleton className="h-4 w-56 mx-auto" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-44 mx-auto" />
                  <Skeleton className="h-3 w-40 mx-auto" />
                  <Skeleton className="h-3 w-36 mx-auto" />
                </div>
              </div>
            </div>

            <div className="border-0 bg-white dark:bg-slate-800/80 backdrop-blur-sm rounded-xl p-6 shadow-sm">
              <div className="text-center pb-15">
                <div className="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-sm">
                  <Skeleton className="w-8 h-8 rounded-md" />
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Skeleton className="h-6 w-40" />
                </div>
              </div>
              <div className="text-center space-y-3 pb-2">
                <Skeleton className="h-4 w-56 mx-auto" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-44 mx-auto" />
                  <Skeleton className="h-3 w-40 mx-auto" />
                  <Skeleton className="h-3 w-36 mx-auto" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full bg-accent/50 dark:bg-slate-900 flex items-center justify-center" dir="rtl">
      <div className="w-full max-w-4xl">
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

        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
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
