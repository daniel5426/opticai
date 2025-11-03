import React, { useState, useEffect, useMemo } from 'react'
import { User } from '@/lib/db/schema-interface'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ROLE_LEVELS, getRoleBadgeVariant, getRoleLabel, isRoleAtLeast } from '@/lib/role-levels'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { authService } from '@/lib/auth/AuthService'

export default function UserSelectionPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [password, setPassword] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set())
  const [selectedClinic, setSelectedClinic] = useState<any>(null)

  // Preload user images
  useMemo(() => {
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

  // Load users for selected clinic
  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const selectedClinicData = localStorage.getItem('selectedClinic')
      if (!selectedClinicData) {
        // Silently return - this is expected during logout or if navigation is happening
        console.log('[UserSelection] No clinic data found, likely during logout')
        setLoading(false)
        return
      }

      const clinic = JSON.parse(selectedClinicData)
      setSelectedClinic(clinic)
      
      const usersResponse = await apiClient.getUsersByClinicPublic(clinic.id)
      const usersData = usersResponse.data || []
      
      console.log('[UserSelection] Loaded users:', usersData.length)
      setUsers(usersData)
    } catch (error) {
      console.error('[UserSelection] Error loading users:', error)
      toast.error('שגיאה בטעינת המשתמשים')
    } finally {
      setLoading(false)
    }
  }

  // ============================================================================
  // LOGIN HANDLERS
  // ============================================================================

  const handlePasswordLogin = async () => {
    if (!selectedUser || !password) return

    setIsLoggingIn(true)
    try {
      console.log('[UserSelection] Password login for:', selectedUser.username)
      
      const user = await authService.signInClinicUser(selectedUser.username, password)
      
      if (user) {
        authService.setClinicSession(selectedClinic, user)
      } else {
        toast.error('שגיאה בהתחברות - בדוק את הסיסמה')
        setPassword('')
      }
    } catch (error) {
      console.error('[UserSelection] Login error:', error)
      toast.error('שגיאה בהתחברות')
      setPassword('')
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handlePasswordlessLogin = async () => {
    if (!selectedUser) return

    setIsLoggingIn(true)
    try {
      console.log('[UserSelection] Passwordless login for:', selectedUser.username)
      
      const user = await authService.signInClinicUser(selectedUser.username)
      
      if (user) {
        authService.setClinicSession(selectedClinic, user)
      } else {
        toast.error('שגיאה בהתחברות')
      }
    } catch (error) {
      console.error('[UserSelection] Passwordless login error:', error)
      toast.error('שגיאה בהתחברות')
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleGoogleLogin = async () => {
    if (!selectedUser?.google_account_connected) return

    setIsLoggingIn(true)
    try {
      console.log('[UserSelection] Google login for:', selectedUser.username)
      
      await authService.signInClinicUserWithGoogle(selectedUser.id!)
      // OAuth will handle the rest via popup
    } catch (error: any) {
      console.error('[UserSelection] Google login error:', error)
      toast.error(error.message || 'שגיאה בהתחברות עם Google')
      setIsLoggingIn(false)
    }
  }

  // ============================================================================
  // UI HANDLERS
  // ============================================================================

  const handleUserSelect = (user: User) => {
    setSelectedUser(user)
    setPassword('')
  }

  const handleBack = () => {
    setSelectedUser(null)
    setPassword('')
  }

  const handleLogoutFromClinic = async () => {
    try {
      console.log('[UserSelection] Logging out from clinic')
      await authService.logoutClinic()
    } catch (error) {
      console.error('[UserSelection] Error logging out from clinic:', error)
      toast.error('שגיאה בהתנתקות')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && selectedUser) {
      if (selectedUser.has_password && password) {
        handlePasswordLogin()
      } else if (!selectedUser.has_password) {
        if (selectedUser.google_account_connected) {
          handleGoogleLogin()
        } else {
          handlePasswordlessLogin()
        }
      }
    }
    if (e.key === 'Escape' && selectedUser) {
      handleBack()
    }
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">טוען משתמשים...</p>
        </div>
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
                  onClick={handleLogoutFromClinic}
                  className="text-xs"
                >
                  התנתקות מהמרפאה
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 justify-center">
              {users.map((user, index) => (
                <UserCard
                  key={user.id}
                  user={user}
                  index={index}
                  loadedImages={loadedImages}
                  onSelect={() => handleUserSelect(user)}
                />
              ))}
            </div>
          </>
        ) : (
          <UserLoginPanel
            user={selectedUser}
            password={password}
            setPassword={setPassword}
            isLoggingIn={isLoggingIn}
            loadedImages={loadedImages}
            onPasswordLogin={handlePasswordLogin}
            onPasswordlessLogin={handlePasswordlessLogin}
            onGoogleLogin={handleGoogleLogin}
            onBack={handleBack}
          />
        )}
      </div>

      <style>{`
        .group {
          will-change: transform;
          transform: translateZ(0);
        }
        
        .group:hover {
          transform: translateZ(0) scale(1.05);
        }
        
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
        
        img {
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
          backface-visibility: hidden;
        }
      `}</style>
    </div>
  )
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function UserAvatar({ user, loadedImages, size = 'md' }: { user: User; loadedImages: Set<string>; size?: 'sm' | 'md' | 'lg' }) {
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
            transform: 'translateZ(0)',
            willChange: 'transform'
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
}

function UserCard({ user, index, loadedImages, onSelect }: any) {
  const roleText = getRoleLabel(user.role_level)
  const roleVariant = getRoleBadgeVariant(user.role_level)

  return (
    <div
      className="flex flex-col items-center cursor-pointer group"
      onClick={onSelect}
      style={{
        animation: `fadeInUp 0.6s ease-out ${index * 0.05}s both`
      }}
    >
      <div className="relative mb-3 transform transition-all duration-500 ease-out group-hover:scale-110 group-hover:-translate-y-2">
        <UserAvatar user={user} loadedImages={loadedImages} size="sm" />
        
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
          variant={roleVariant}
          className="text-xs scale-90 group-hover:scale-100 transition-transform duration-300"
        >
          {roleText}
        </Badge>
      </div>
    </div>
  )
}

function UserLoginPanel({
  user,
  password,
  setPassword,
  isLoggingIn,
  loadedImages,
  onPasswordLogin,
  onPasswordlessLogin,
  onGoogleLogin,
  onBack,
}: any) {
  const roleText = getRoleLabel(user.role_level)
  
  const roleVariant = getRoleBadgeVariant(user.role_level)

  return (
    <div 
      className="flex flex-col items-center"
      style={{
        animation: 'slideInFromRight 0.6s cubic-bezier(0.16, 1, 0.3, 1) both'
      }}
    >
      <div className="mb-6">
        <div style={{ animation: 'bounce 1s ease-out', justifyItems: 'center' }} >
          <UserAvatar user={user} loadedImages={loadedImages} size="md" />
        </div>
        
        <div className="text-center mt-4">
          <h2 className="text-slate-900 dark:text-slate-100 text-2xl font-medium mb-2">
            {user.full_name || user.username}
          </h2>
          <Badge variant={roleVariant} className="text-sm">
            {roleText}
          </Badge>
        </div>
      </div>

      <Card className="w-full max-w-sm p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        {user.google_account_connected && !user.has_password ? (
          <div className="text-center space-y-4" dir="rtl">
            <p className="text-slate-600 dark:text-slate-400">
              התחברות עם Google עבור משתמש זה
            </p>
            <div className="flex gap-3">
              <Button
                onClick={onGoogleLogin}
                disabled={isLoggingIn}
                className="flex-1 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900"
              >
                {isLoggingIn ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  'התחבר עם Google'
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={onBack}
                size="icon"
                className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Button>
            </div>
          </div>
        ) : user.has_password ? (
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
                onClick={onPasswordLogin}
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
                onClick={onBack}
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
              התחברות ללא סיסמה עבור משתמש זה
            </p>
            <div className="flex gap-3">
              <Button
                onClick={onPasswordlessLogin}
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
                onClick={onBack}
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
  )
}