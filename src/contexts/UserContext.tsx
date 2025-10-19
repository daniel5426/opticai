import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { User, Clinic } from '@/lib/db/schema-interface'
import { authService, AuthState, AuthSession } from '@/lib/auth/AuthService'
import { applyUserThemeComplete, cacheCompanyThemeColors } from '@/helpers/theme_helpers'
import { apiClient } from '@/lib/api-client'

interface UserContextType {
  currentUser: User | null
  currentClinic: Clinic | null
  authState: AuthState
  isLoading: boolean
  setCurrentUser: (user: User | null, skipNavigation?: boolean) => void
  setCurrentClinic: (clinic: Clinic | null) => Promise<void>
  logout: () => void
  logoutUser: () => void
  logoutClinic: () => Promise<void>
  refreshClinics: () => void
  clinicRefreshTrigger: number
}

const UserContext = createContext<UserContextType | undefined>(undefined)

interface UserProviderProps {
  children: ReactNode
}

/**
 * UserProvider - React context wrapper for AuthService
 * Provides authentication state to React components
 */
export function UserProvider({ children }: UserProviderProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [currentClinic, setCurrentClinic] = useState<Clinic | null>(null)
  const [authState, setAuthState] = useState<AuthState>(AuthState.LOADING)
  const [isLoading, setIsLoading] = useState(true)
  const [clinicRefreshTrigger, setClinicRefreshTrigger] = useState(0)

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = authService.subscribe(async (state: AuthState, session: AuthSession | null) => {
      console.log('[UserContext] Auth state changed:', state, 'Session:', !!session)
      
      setAuthState(state)
      setIsLoading(state === AuthState.LOADING)

      // Update user and clinic from session
      if (session?.user) {
        // Load company and cache theme colors
        try {
          if (session.clinic?.company_id) {
            const companyResponse = await apiClient.getCompany(session.clinic.company_id)
            if (companyResponse.data) {
              cacheCompanyThemeColors(companyResponse.data)
            }
          } else {
            // Try to get company from localStorage (for control center users)
            const storedCompany = localStorage.getItem('controlCenterCompany')
            if (storedCompany) {
              try {
                const company = JSON.parse(storedCompany)
                cacheCompanyThemeColors(company)
              } catch (e) {
                console.error('[UserContext] Failed to parse stored company:', e)
              }
            }
          }
        } catch (error) {
          console.error('[UserContext] Failed to load company for theme colors:', error)
        }
        
        // Apply user theme
        try {
          await applyUserThemeComplete(session.user.id!, session.user)
        } catch (error) {
          console.error('[UserContext] Failed to apply theme:', error)
        }
        
        setCurrentUser(session.user)
        setCurrentClinic(session.clinic || null)
      } else {
        setCurrentUser(null)
        setCurrentClinic(session?.clinic || null)
      }
    })

    return unsubscribe
  }, [])

  const handleSetCurrentUser = (user: User | null, skipNavigation = false) => {
    console.log('[UserContext] setCurrentUser called:', user?.username, skipNavigation ? '(skip navigation)' : '')

    if (user) {
      // Only set clinic session if we have a clinic AND we're not explicitly skipping navigation
      // This prevents unwanted navigation when just updating user profile/settings
      if (!skipNavigation) {
        const clinic = currentClinic || authService.getSession()?.clinic
        if (clinic) {
          authService.setClinicSession(clinic, user)
        }
      } else {
        // When skipping navigation, just update the local state without triggering auth service
        setCurrentUser(user)
      }
    } else {
      authService.logoutUser()
    }
  }

  const handleSetCurrentClinic = async (clinic: Clinic | null) => {
    console.log('[UserContext] setCurrentClinic called:', clinic?.name)
    
    if (clinic) {
      authService.setClinicSession(clinic)
    } else {
      await authService.logoutClinic()
    }
  }

  const refreshClinics = () => {
    setClinicRefreshTrigger(prev => prev + 1)
  }

  const logout = () => {
    console.log('[UserContext] Full logout')
    authService.signOut()
  }

  const logoutUser = () => {
    console.log('[UserContext] Logout user only')
    authService.logoutUser()
  }

  const logoutClinic = async () => {
    console.log('[UserContext] Logout clinic')
    await authService.logoutClinic()
  }

  const value: UserContextType = {
    currentUser,
    currentClinic,
    authState,
    isLoading,
    setCurrentUser: handleSetCurrentUser,
    setCurrentClinic: handleSetCurrentClinic,
    logout,
    logoutUser,
    logoutClinic,
    refreshClinics,
    clinicRefreshTrigger
  }

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}