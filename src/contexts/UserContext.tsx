import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { User, Clinic } from '@/lib/db/schema-interface'
import { apiClient } from '@/lib/api-client'
import { supabase } from '@/lib/supabaseClient'
import { applyThemeColorsFromSettings, applyUserThemePreference, applyUserThemeComplete } from '@/helpers/theme_helpers'
import { router } from '@/routes/router'

interface UserContextType {
  currentUser: User | null
  currentClinic: Clinic | null
  isLoading: boolean
  login: (username: string, password?: string) => Promise<boolean>
  logout: () => void
  logoutUser: () => void
  logoutClinic: () => void
  setCurrentUser: (user: User | null) => Promise<void>
  setCurrentClinic: (clinic: Clinic | null) => void
  refreshClinics: () => void
  clinicRefreshTrigger: number
}

const UserContext = createContext<UserContextType | undefined>(undefined)

interface UserProviderProps {
  children: ReactNode
}

export function UserProvider({ children }: UserProviderProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [currentClinic, setCurrentClinic] = useState<Clinic | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [clinicRefreshTrigger, setClinicRefreshTrigger] = useState(0)

  useEffect(() => {
    const onUnauthorized = () => {
      try {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('currentUser')
        localStorage.removeItem('currentUserId')
        localStorage.removeItem('selectedClinic')
      } catch {}
      setCurrentUser(null)
      setCurrentClinic(null)
      router.navigate({ to: '/' })
    }
    window.addEventListener('auth:unauthorized', onUnauthorized as EventListener)

    const loadCurrentUser = async () => {
      try {
        const savedUserId = localStorage.getItem('currentUserId')
        const savedClinicData = localStorage.getItem('selectedClinic')
        const controlCenterUserData = localStorage.getItem('currentUser')
        const { data: sessionData } = await supabase.auth.getSession()
        const hasSession = !!sessionData?.session
        if (hasSession && sessionData.session?.access_token) {
          apiClient.setToken(sessionData.session.access_token)
          try {
            const me = await apiClient.getCurrentUser()
            if (me.data) {
              await applyUserThemeComplete((me.data as User).id!, me.data as User)
              setCurrentUser(me.data as User)
              try { localStorage.setItem('currentUser', JSON.stringify(me.data)) } catch {}
            }
          } catch {}
        }
        console.log('UserContext: Loading current user with savedUserId:', savedUserId, 'hasSession:', hasSession)
        
        const hasSelectedClinic = Boolean(savedClinicData)
        if (!hasSelectedClinic && controlCenterUserData) {
          try {
            const user = JSON.parse(controlCenterUserData)
            if (user && user.is_active) {
              await applyUserThemeComplete(user.id!, user)
              setCurrentUser(user)
              console.log('UserContext: Loaded control center user:', user)
              
            } else {
              localStorage.removeItem('currentUser')
            }
          } catch (error) {
            console.error('Error parsing control center user data:', error)
            localStorage.removeItem('currentUser')
          }
        } else if (savedUserId) {
          console.log('UserContext: Attempting to load user by ID:', savedUserId)
          const response = await apiClient.getUser(parseInt(savedUserId))
          console.log('UserContext: getUser response:', response)
          if (response.data && (response.data as User).is_active) {
            await applyUserThemeComplete((response.data as User).id!, response.data as User)
            setCurrentUser(response.data as User)
            console.log('UserContext: Loaded clinic user:', response.data)
            try {
              localStorage.setItem('currentUser', JSON.stringify(response.data))
            } catch {}
          } else {
            console.log('UserContext: User not found or inactive, clearing savedUserId')
            localStorage.removeItem('currentUserId')
          }
        }

        if (savedClinicData) {
          try {
            const clinic = JSON.parse(savedClinicData)
            setCurrentClinic(clinic)
            console.log('UserContext: Loaded clinic data:', clinic)
          } catch (error) {
            console.error('Error parsing saved clinic data:', error)
            localStorage.removeItem('selectedClinic')
          }
        }
      } catch (error) {
        console.error('Error loading current user:', error)
        localStorage.removeItem('currentUserId')
      } finally {
        setIsLoading(false)
      }
    }

    loadCurrentUser()
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const token = session?.access_token
      if (token) {
        apiClient.setToken(token)
        try {
          const me = await apiClient.getCurrentUser()
          if (me.data) {
            await applyUserThemeComplete((me.data as User).id!, me.data as User)
            setCurrentUser(me.data as User)
            try { localStorage.setItem('currentUser', JSON.stringify(me.data)) } catch {}
          }
        } catch {}
      } else {
        apiClient.clearToken()
        setCurrentUser(null)
      }
    })

    return () => {
      window.removeEventListener('auth:unauthorized', onUnauthorized as EventListener)
      authListener?.subscription?.unsubscribe?.()
    }
  }, [])

  const login = async (username: string, password?: string): Promise<boolean> => {
    try {
      console.log('UserContext: Starting login for username:', username);
      
      if (password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email: username, password })
        if (error || !data.session) return false
        const userResponse = await apiClient.getCurrentUser();
        if (userResponse.data && (userResponse.data as User).is_active) {
          await applyUserThemeComplete((userResponse.data as User).id!, userResponse.data as User)
          console.log('UserContext: Setting current user:', userResponse.data);
          setCurrentUser(userResponse.data as User)
          localStorage.setItem('currentUser', JSON.stringify(userResponse.data))
          const hasSelectedClinic = !!localStorage.getItem('selectedClinic')
          if (!hasSelectedClinic) {
            localStorage.setItem('currentUserId', (userResponse.data as User).id!.toString())
          } else {
            localStorage.removeItem('currentUserId')
          }
          return true
        }
      } else {
        // For passwordless login, we don't use Supabase auth
        // The user is already set by UserSelectionPage
        console.log('UserContext: Passwordless login - user already set by UserSelectionPage');
        return true
      }
      
      console.log('UserContext: Login failed - user not found or inactive');
      return false
    } catch (error) {
      console.error('UserContext: Login error:', error);
      return false
    }
  }

  const logout = () => {
    console.log('UserContext: Logging out user');
    const role = currentUser?.role
    setCurrentUser(null)
    apiClient.clearToken()
    supabase.auth.signOut()
    localStorage.removeItem('currentUserId')
    if (role === 'company_ceo') {
      localStorage.removeItem('currentUser')
      localStorage.removeItem('controlCenterCompany')
      localStorage.removeItem('selectedClinic')
      router.navigate({ to: '/' })
    } else {
      router.navigate({ to: '/user-selection' })
    }
  }

  const logoutUser = () => {
    console.log('UserContext: Logout user only (keep clinic)')
    setCurrentUser(null)
    apiClient.clearToken()
    supabase.auth.signOut()
    localStorage.removeItem('currentUserId')
    router.navigate({ to: '/user-selection' })
  }

  const logoutClinic = () => {
    console.log('UserContext: Logout clinic (clear clinic and user)')
    setCurrentUser(null)
    setCurrentClinic(null)
    apiClient.clearToken()
    supabase.auth.signOut()
    localStorage.removeItem('currentUserId')
    localStorage.removeItem('currentUser')
    localStorage.removeItem('selectedClinic')
    router.navigate({ to: '/' })
  }

  const setClinic = (clinic: Clinic | null) => {
    console.log('UserContext: Setting current clinic:', clinic);
    setCurrentClinic(clinic)
    if (clinic) {
      localStorage.setItem('selectedClinic', JSON.stringify(clinic))
    } else {
      localStorage.removeItem('selectedClinic')
    }
  }

  const refreshClinics = () => {
    setClinicRefreshTrigger(prev => prev + 1)
  }

  const setUser = async (user: User | null) => {
    if (user) {
      await applyUserThemeComplete(user.id!, user)
      setCurrentUser(user)
      localStorage.setItem('currentUserId', user.id!.toString())
    } else {
      setCurrentUser(null)
      localStorage.removeItem('currentUserId')
    }
  }

  const value: UserContextType = {
    currentUser,
    currentClinic,
    isLoading,
    login,
    logout,
    logoutUser,
    logoutClinic,
    setCurrentUser: setUser,
    setCurrentClinic: setClinic,
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