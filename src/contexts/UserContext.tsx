import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { User } from '@/lib/db/schema'
import { getUserById, authenticateUser } from '@/lib/db/users-db'
import { applyThemeColorsFromSettings, applyUserThemePreference, applyUserThemeComplete } from '@/helpers/theme_helpers'

interface UserContextType {
  currentUser: User | null
  isLoading: boolean
  login: (username: string, password?: string) => Promise<boolean>
  logout: () => void
  setCurrentUser: (user: User | null) => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

interface UserProviderProps {
  children: ReactNode
}

export function UserProvider({ children }: UserProviderProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const savedUserId = localStorage.getItem('currentUserId')
        if (savedUserId) {
          const user = await getUserById(parseInt(savedUserId))
          if (user && user.is_active) {
            // Apply complete theme atomically before setting user state
            await applyUserThemeComplete(user.id!)
            setCurrentUser(user)
          } else {
            localStorage.removeItem('currentUserId')
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
  }, [])

  const login = async (username: string, password?: string): Promise<boolean> => {
    try {
      const user = await authenticateUser(username, password)
      if (user && user.is_active) {
        // Apply complete theme atomically before setting user state
        await applyUserThemeComplete(user.id!)
        setCurrentUser(user)
        localStorage.setItem('currentUserId', user.id!.toString())
        
        return true
      }
      return false
    } catch (error) {
      console.error('Login error:', error)
      return false
    }
  }

  const logout = () => {
    setCurrentUser(null)
    localStorage.removeItem('currentUserId')
  }

  const value: UserContextType = {
    currentUser,
    isLoading,
    login,
    logout,
    setCurrentUser: async (user: User | null) => {
      if (user) {
        // Apply complete theme atomically before setting user state
        await applyUserThemeComplete(user.id!)
        setCurrentUser(user)
        localStorage.setItem('currentUserId', user.id!.toString())
      } else {
        setCurrentUser(null)
        localStorage.removeItem('currentUserId')
      }
    }
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