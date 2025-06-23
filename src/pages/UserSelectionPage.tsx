import React, { useState, useEffect } from 'react'
import { User } from '@/lib/db/schema'
import { getAllUsers } from '@/lib/db/users-db'
import { useUser } from '@/contexts/UserContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

export default function UserSelectionPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [password, setPassword] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const { login } = useUser()

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const usersData = await getAllUsers()
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
      const hasPassword = selectedUser.password && selectedUser.password.trim() !== ''
      const success = await login(
        selectedUser.username, 
        hasPassword ? password : undefined
      )
      
      if (!success) {
        toast.error('שגיאה בהתחברות - בדוק את הסיסמה')
        setPassword('')
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
      const hasPassword = selectedUser.password && selectedUser.password.trim() !== ''
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
              <h1 className="text-3xl font-medium text-slate-900 dark:text-slate-100 mb-2" dir="rtl">
                בחר משתמש
              </h1>
              <p className="text-slate-600 dark:text-slate-400" dir="rtl">
                לחץ על המשתמש שלך כדי להתחבר למערכת
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 justify-center">
              {users.map((user, index) => (
                <div
                  key={user.id}
                  className="flex flex-col items-center cursor-pointer group"
                  onClick={() => handleUserSelect(user)}
                  style={{
                    animation: `fadeInUp 0.6s ease-out ${index * 0.1}s both`
                  }}
                >
                  <div className="relative mb-3 transform transition-all duration-500 ease-out group-hover:scale-110 group-hover:-translate-y-2">
                    <div className="w-20 h-20 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm group-hover:shadow-lg group-hover:shadow-slate-900/10 dark:group-hover:shadow-slate-100/10 transition-all duration-500">
                      <span className="text-slate-700 dark:text-slate-300 text-xl font-medium group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors duration-300">
                        {user.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    
                    {user.password && user.password.trim() !== '' && (
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-100 dark:bg-emerald-900 border-2 border-white dark:border-slate-950 rounded-full flex items-center justify-center transform transition-all duration-300 group-hover:scale-110">
                        <svg className="w-3 h-3 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-center transform transition-all duration-300 group-hover:-translate-y-1">
                    <h3 className="text-slate-900 dark:text-slate-100 text-sm font-medium mb-1 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors duration-300">
                      {user.username}
                    </h3>
                    <Badge 
                      variant={
                        user.role === 'admin' ? 'default' : 
                        user.role === 'worker' ? 'secondary' : 
                        'outline'
                      }
                      className="text-xs scale-90 group-hover:scale-100 transition-transform duration-300"
                    >
                      {user.role === 'admin' ? 'מנהל' : 
                       user.role === 'worker' ? 'עובד' : 
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
                className="w-28 h-28 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-lg mx-auto mb-4"
                style={{
                  animation: 'bounce 1s ease-out'
                }}
              >
                <span className="text-slate-700 dark:text-slate-300 text-3xl font-medium">
                  {selectedUser.username.charAt(0).toUpperCase()}
                </span>
              </div>
              
              <div className="text-center">
                <h2 className="text-slate-900 dark:text-slate-100 text-2xl font-medium mb-2">
                  {selectedUser.username}
                </h2>
                <Badge 
                  variant={
                    selectedUser.role === 'admin' ? 'default' : 
                    selectedUser.role === 'worker' ? 'secondary' : 
                    'outline'
                  }
                  className="text-sm"
                >
                  {selectedUser.role === 'admin' ? 'מנהל' : 
                   selectedUser.role === 'worker' ? 'עובד' : 
                   'צופה'}
                </Badge>
              </div>
            </div>

            <Card className="w-full max-w-sm p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              {selectedUser.password && selectedUser.password.trim() !== '' ? (
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
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideInFromRight {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes bounce {
          0%, 20%, 53%, 80%, 100% {
            transform: translate3d(0,0,0);
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
      `}</style>
    </div>
  )
} 