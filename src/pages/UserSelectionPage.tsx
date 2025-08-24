import React, { useState, useEffect, useMemo } from 'react'
import { User } from '@/lib/db/schema-interface'
import { useUser } from '@/contexts/UserContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useNavigate } from '@tanstack/react-router'
import { router } from '@/routes/router'

import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client';

export default function UserSelectionPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [password, setPassword] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set())
  const [selectedClinic, setSelectedClinic] = useState<any>(null)
  const { login, setCurrentClinic, setCurrentUser } = useUser()
  const navigate = useNavigate()

  // Preload profile images for better performance
  const preloadImages = useMemo(() => {
    const imageUrls = users
      .filter(user => user.profile_picture)
      .map(user => user.profile_picture!)
    
    imageUrls.forEach(url => {
      if (!loadedImages.has(url)) {
        const img = new Image()
        img.onload = () => {
          setLoadedImages(prev => new Set([...prev, url]))
        }
        img.src = url
      }
    })
  }, [users, loadedImages])

  // Optimized Avatar Component
  const OptimizedAvatar = React.memo(({ user, size = 'md' }: { user: User; size?: 'sm' | 'md' | 'lg' }) => {
    const sizeClasses = {
      sm: 'w-20 h-20',
      md: 'w-28 h-28',
      lg: 'w-32 h-32'
    }
    
    const textSizes = {
      sm: 'text-xl',
      md: 'text-3xl',
      lg: 'text-4xl'
    }

    return (
      <div className={`${sizeClasses[size]} rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm group-hover:shadow-lg group-hover:shadow-slate-900/10 dark:group-hover:shadow-slate-100/10 transition-all duration-500 overflow-hidden`}>
        {user.profile_picture && loadedImages.has(user.profile_picture) ? (
          <img 
            src={user.profile_picture} 
            alt={user.username}
            className="w-full h-full object-cover"
            loading="lazy"
            style={{ 
              transform: 'translateZ(0)', // Force hardware acceleration
              willChange: 'transform' // Optimize for animations
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className={`text-slate-700 dark:text-slate-300 ${textSizes[size]} font-medium group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors duration-300`}>
              {(user.full_name || user.username).charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>
    )
  })

  useEffect(() => {
    const loadUsers = async () => {
      try {
        // Get the selected clinic from sessionStorage
        const selectedClinicData = localStorage.getItem('selectedClinic')
        if (!selectedClinicData) {
          toast.error('לא נמצא מידע על המרפאה הנבחרת')
          setLoading(false)
          return
        }

        const clinic = JSON.parse(selectedClinicData)
        setSelectedClinic(clinic)
         const usersResponse = await apiClient.getUsersByClinicPublic(clinic.id)
        const usersData = usersResponse.data || []
        console.log('UserSelectionPage: Loaded users:', usersData.map(u => ({ id: u.id, username: u.username, hasPassword: !!u.password, passwordLength: u.password?.length })))
        setUsers(usersData)
      } catch (error) {
        console.error('Error loading users:', error)
        toast.error('שגיאה בטעינת המשתמשים')
      } finally {
        setLoading(false)
      }
    }

    loadUsers()
  }, [])

  const handleUserSelect = (user: User) => {
    setSelectedUser(user)
    setPassword('')
  }

  const handleLogin = async () => {
    if (!selectedUser) return

    setIsLoggingIn(true)
    try {
      console.log('UserSelectionPage: Starting login process');
      console.log('UserSelectionPage: Selected user:', selectedUser);
      console.log('UserSelectionPage: Selected clinic:', selectedClinic);
      
      const hasPassword = selectedUser.has_password
      console.log('UserSelectionPage: Selected user has_password field:', selectedUser.has_password);
      console.log('UserSelectionPage: Has password:', hasPassword);
      
      const identifier = selectedUser.email || selectedUser.username
      if (!identifier) {
        toast.error('למשתמש אין אימייל או שם משתמש תקין')
        setIsLoggingIn(false)
        return
      }
      // For users without password, use the passwordless login endpoint
      if (!hasPassword) {
        console.log('UserSelectionPage: User has no password, using passwordless login');
        try {
          const response = await fetch(`${(apiClient as any).baseUrl}/auth/login-no-password`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username: selectedUser.username }),
          });
          
          const loginResponse = await response.json();
          
          if (loginResponse?.access_token) {
            // Set the token for future API calls
            apiClient.setToken(loginResponse.access_token);
            
            // Set user in context
            await setCurrentUser(selectedUser)
            setCurrentClinic(selectedClinic)
            
            // Store user info locally
            localStorage.setItem('currentUserId', selectedUser.id!.toString())
            localStorage.setItem('currentUser', JSON.stringify(selectedUser))
            
            setTimeout(() => {
              try {
                navigate({ to: '/dashboard' })
                console.log('UserSelectionPage: Navigation command sent for passwordless user');
              } catch (navError) {
                console.error('UserSelectionPage: Navigation error:', navError);
                window.location.href = '/dashboard'
              }
            }, 0)
          } else {
            toast.error('שגיאה בהתחברות ללא סיסמה')
          }
        } catch (error) {
          console.error('Passwordless login error:', error);
          toast.error('שגיאה בהתחברות ללא סיסמה')
        }
        setIsLoggingIn(false)
        return
      }
      const success = await login(identifier, password)
      
      console.log('UserSelectionPage: Login result:', success);
      
      if (success && selectedClinic) {
        console.log('UserSelectionPage: Login successful, setting clinic context');
        setCurrentClinic(selectedClinic)
        console.log('UserSelectionPage: Clinic context set, navigating to dashboard');
        
        // Defer navigation to ensure context state is applied before route guards run
        setTimeout(() => {
          try {
            navigate({ to: '/dashboard' })
            console.log('UserSelectionPage: Navigation command sent via useNavigate');
          } catch (navError) {
            console.error('UserSelectionPage: Navigation error:', navError);
            window.location.href = '/dashboard'
          }
        }, 0)
      } else {
        console.log('UserSelectionPage: Login failed or no clinic selected');
        if (!success) {
          toast.error('שגיאה בהתחברות - בדוק את הסיסמה')
          setPassword('')
        }
      }
    } catch (error) {
      console.error('Login error:', error)
      toast.error('שגיאה בהתחברות')
      setPassword('')
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleBack = () => {
    setSelectedUser(null)
    setPassword('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && selectedUser) {
      const hasPassword = selectedUser.has_password
      if (!hasPassword || password) {
        handleLogin()
      }
    }
    if (e.key === 'Escape' && selectedUser) {
      handleBack()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center" style={{scrollbarWidth: 'none'}}>
        <div className="text-slate-900 dark:text-slate-100 text-lg">טוען משתמשים...</div>
      </div>
    )
  }

  return (
    <div 
      className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6"
      onKeyDown={handleKeyPress}
      tabIndex={0}
      style={{scrollbarWidth: 'none'}}
    >
      <div className="w-full max-w-5xl">
        {!selectedUser ? (
          <>
            <div className="text-center mb-8">
              {selectedClinic && (
                <div className="mb-4">
                  <Badge variant="outline" className="text-sm px-3 py-1 mb-2">
                    {selectedClinic.name}
                  </Badge>
                  <p className="text-xs text-slate-500 dark:text-slate-400" dir="rtl">
                    מרפאה נבחרת
                  </p>
                </div>
              )}
              <h1 className="text-3xl font-medium text-slate-900 dark:text-slate-100 mb-2" dir="rtl">
                בחר משתמש
              </h1>
                   <p className="text-slate-600 dark:text-slate-400" dir="rtl">
                 לחץ על המשתמש שלך כדי להתחבר למערכת
               </p>
              <div className="mt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    localStorage.removeItem('selectedClinic')
                    localStorage.removeItem('currentUser')
                    localStorage.removeItem('currentUserId')
                    localStorage.removeItem('controlCenterCompany')
                    localStorage.removeItem('auth_token')
                    router.navigate({ to: '/clinic-entrance' })
                  }}
                  className="text-xs"
                >
                  התנתקות מהמרפאה
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 justify-center">
              {users.map((user, index) => (
                <div
                  key={user.id}
                  className="flex flex-col items-center cursor-pointer group"
                  onClick={() => handleUserSelect(user)}
                  style={{
                    animation: `fadeInUp 0.6s ease-out ${index * 0.05}s both`
                  }}
                >
                  <div className="relative mb-3 transform transition-all duration-500 ease-out group-hover:scale-110 group-hover:-translate-y-2">
                    <OptimizedAvatar user={user} size="sm" />
                    
                    {user.has_password && (
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-100 dark:bg-emerald-900 border-2 border-white dark:border-slate-950 rounded-full flex items-center justify-center transform transition-all duration-300 group-hover:scale-110">
                        <svg className="w-3 h-3 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-center transform transition-all duration-300 group-hover:-translate-y-1">
                     <h3 className="text-slate-900 dark:text-slate-100 text-sm font-medium mb-1 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors duration-300">
                      {user.full_name || user.username}
                    </h3>
                    <Badge 
                      variant={
                        user.role === 'clinic_manager' || user.role === 'company_ceo' ? 'default' : 
                        user.role === 'clinic_worker' ? 'secondary' : 
                        'outline'
                      }
                      className="text-xs scale-90 group-hover:scale-100 transition-transform duration-300"
                    >
                      {user.role === 'clinic_manager' || user.role === 'company_ceo' ? 'מנהל' : 
                       user.role === 'clinic_worker' ? 'עובד' : 
                       'צופה'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div 
            className="flex flex-col items-center"
            style={{
              animation: 'slideInFromRight 0.6s cubic-bezier(0.16, 1, 0.3, 1) both'
            }}
          >
            <div className="mb-6">
              <div
                style={{
                  animation: 'bounce 1s ease-out'
                }}
              >
                <OptimizedAvatar user={selectedUser} size="md" />
              </div>
              
              <div className="text-center">
                 <h2 className="text-slate-900 dark:text-slate-100 text-2xl font-medium mb-2">
                  {selectedUser.full_name || selectedUser.username}
                </h2>
                <Badge 
                  variant={
                    selectedUser.role === 'clinic_manager' || selectedUser.role === 'company_ceo' ? 'default' : 
                    selectedUser.role === 'clinic_worker' ? 'secondary' : 
                    'outline'
                  }
                  className="text-sm"
                >
                  {selectedUser.role === 'clinic_manager' || selectedUser.role === 'company_ceo' ? 'מנהל' : 
                   selectedUser.role === 'clinic_worker' ? 'עובד' : 
                   'צופה'}
                </Badge>
              </div>
            </div>

            <Card className="w-full max-w-sm p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              {selectedUser.has_password ? (
                <div className="space-y-4" dir="rtl">
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-slate-700 dark:text-slate-300">
                      הזן סיסמה
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                      placeholder="סיסמה"
                      autoFocus
                      dir="rtl"
                    />
                  </div>
                  
                  <div className="flex gap-3">
                    <Button 
                      onClick={handleLogin}
                      disabled={!password || isLoggingIn}
                      className="flex-1 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900"
                    >
                      {isLoggingIn ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        'התחבר'
                      )}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={handleBack}
                      size="icon"
                      className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-4" dir="rtl">
                  <p className="text-slate-600 dark:text-slate-400">
                    משתמש זה אינו מוגן בסיסמה
                  </p>
                  <div className="flex gap-3">
                    <Button 
                      onClick={handleLogin}
                      disabled={isLoggingIn}
                      className="flex-1 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900"
                    >
                      {isLoggingIn ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        'התחבר'
                      )}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={handleBack}
                      size="icon"
                      className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            <div className="text-center mt-6">
              <p className="text-slate-500 dark:text-slate-400 text-xs">
                לחץ ESC כדי לחזור • לחץ Enter כדי להתחבר
              </p>
            </div>
          </div>
        )}
      </div>

      <style>{`
        /* Performance optimizations */
        .group {
          will-change: transform;
          transform: translateZ(0);
        }
        
        .group:hover {
          transform: translateZ(0) scale(1.05);
        }
        
        /* Optimized animations with hardware acceleration */
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translate3d(0, 20px, 0);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }

        @keyframes slideInFromRight {
          from {
            opacity: 0;
            transform: translate3d(30px, 0, 0);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }

        @keyframes bounce {
          0%, 20%, 53%, 80%, 100% {
            transform: translate3d(0, 0, 0);
          }
          40%, 43% {
            transform: translate3d(0, -10px, 0);
          }
          70% {
            transform: translate3d(0, -5px, 0);
          }
          90% {
            transform: translate3d(0, -2px, 0);
          }
        }
        
        /* Optimize image rendering */
        img {
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
          backface-visibility: hidden;
        }
      `}</style>
    </div>
  )
} 