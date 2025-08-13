import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { User, Clinic } from '@/lib/db/schema-interface'
import { apiClient } from '@/lib/api-client'
import { applyThemeColorsFromSettings, applyUserThemePreference, applyUserThemeComplete } from '@/helpers/theme_helpers'
import { router } from '@/routes/router'

interface UserContextType {
  currentUser: User | null
  currentClinic: Clinic | null
  isLoading: boolean
  login: (username: string, password?: string) => Promise<boolean>
  logout: () => void
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
        const authToken = localStorage.getItem('auth_token')
        
        console.log('UserContext: Loading current user with savedUserId:', savedUserId, 'authToken:', !!authToken)
        
        if (controlCenterUserData) {
          try {
            const user = JSON.parse(controlCenterUserData)
            if (user && user.is_active) {
              await applyUserThemeComplete(user.id!, user)
              setCurrentUser(user)
              console.log('UserContext: Loaded control center user:', user)
              const existingToken = localStorage.getItem('auth_token')
              if (!existingToken && user?.username) {
                try {
                  await apiClient.loginWithoutPassword(user.username)
                  console.log('UserContext: Restored auth token via login-no-password')
                } catch (e) {
                  console.error('UserContext: Failed restoring token', e)
                }
              }
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

    return () => {
      window.removeEventListener('auth:unauthorized', onUnauthorized as EventListener)
    }
  }, [])

  const login = async (username: string, password?: string): Promise<boolean> => {
    try {
      console.log('UserContext: Starting login for username:', username);
      
      if (!password) {
        console.log('UserContext: No password provided, logging in without password');
        const response = await apiClient.loginWithoutPassword(username);
        console.log('UserContext: loginWithoutPassword response:', response);
        if (response.data) {
          console.log('UserContext: Token received, getting current user');
          const userResponse = await apiClient.getCurrentUser();
          console.log('UserContext: getCurrentUser response:', userResponse);
          if (userResponse.data && (userResponse.data as User).is_active) {
            await applyUserThemeComplete((userResponse.data as User).id!, userResponse.data as User)
            setCurrentUser(userResponse.data as User)
            localStorage.setItem('currentUser', JSON.stringify(userResponse.data))
            const hasSelectedClinic = !!localStorage.getItem('selectedClinic')
            if (!hasSelectedClinic) {
              localStorage.setItem('currentUserId', (userResponse.data as User).id!.toString())
            } else {
              localStorage.removeItem('currentUserId')
            }
            console.log('UserContext: Successfully logged in without password');
            return true;
          }
        }
        console.log('UserContext: Failed to login without password');
        return false;
      }

      const response = await apiClient.login(username, password);
      console.log('UserContext: Authentication result:', response);
      
      if (response.data) {
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