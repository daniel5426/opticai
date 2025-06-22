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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">טוען משתמשים...</div>
      </div>
    )
  }

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-8"
      onKeyDown={handleKeyPress}
      tabIndex={0}
    >
      <div className="w-full max-w-4xl">
        {!selectedUser ? (
          <>
            <div className="text-center mb-12">
              <h1 className="text-4xl font-light text-white mb-4" dir="rtl">
                בחר משתמש
              </h1>
              <p className="text-blue-200 text-lg" dir="rtl">
                לחץ על המשתמש שלך כדי להתחבר למערכת
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 justify-center">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col items-center cursor-pointer group transition-all duration-300 hover:scale-105"
                  onClick={() => handleUserSelect(user)}
                >
                  <div className="relative mb-4">
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center shadow-2xl group-hover:shadow-blue-500/30 transition-all duration-300">
                      <span className="text-white text-3xl font-bold">
                        {user.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    
                    {user.password && user.password.trim() !== '' && (
                      <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-center">
                    <h3 className="text-white text-xl font-medium mb-2">
                      {user.username}
                    </h3>
                    <Badge 
                      variant={
                        user.role === 'admin' ? 'default' : 
                        user.role === 'worker' ? 'secondary' : 
                        'outline'
                      }
                      className="text-xs"
                    >
                      {user.role === 'admin' ? 'מנהל' : 
                       user.role === 'worker' ? 'עובד' : 
                       'צופה'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mt-16">
              <p className="text-blue-200 text-sm">
                לחץ ESC כדי לצאת • לחץ Enter כדי להיכנס עם המשתמש הנבחר
              </p>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center">
            <div className="mb-8">
              <div className="w-40 h-40 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center shadow-2xl mx-auto mb-6">
                <span className="text-white text-5xl font-bold">
                  {selectedUser.username.charAt(0).toUpperCase()}
                </span>
              </div>
              
              <div className="text-center">
                <h2 className="text-white text-3xl font-light mb-2">
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

            <Card className="w-full max-w-md p-8 bg-white/10 backdrop-blur-md border-white/20">
              {selectedUser.password && selectedUser.password.trim() !== '' ? (
                <div className="space-y-6" dir="rtl">
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-white text-lg">
                      הזן סיסמה
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-white/20 border-white/30 text-white placeholder-white/50 text-lg h-12"
                      placeholder="סיסמה"
                      autoFocus
                      dir="rtl"
                    />
                  </div>
                  
                  <div className="flex gap-4">
                    <Button 
                      onClick={handleLogin}
                      disabled={!password || isLoggingIn}
                      className="flex-1 h-12 text-lg bg-blue-600 hover:bg-blue-700"
                    >
                      {isLoggingIn ? (
                        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        'התחבר'
                      )}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={handleBack}
                      className="h-12 px-8 bg-white/20 border-white/30 text-white hover:bg-white/30"
                    >
                      חזור
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-6" dir="rtl">
                  <p className="text-white text-lg">
                    משתמש זה אינו מוגן בסיסמה
                  </p>
                  <div className="flex gap-4">
                    <Button 
                      onClick={handleLogin}
                      disabled={isLoggingIn}
                      className="flex-1 h-12 text-lg bg-blue-600 hover:bg-blue-700"
                    >
                      {isLoggingIn ? (
                        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        'התחבר'
                      )}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={handleBack}
                      className="h-12 px-8 bg-white/20 border-white/30 text-white hover:bg-white/30"
                    >
                      חזור
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            <div className="text-center mt-8">
              <p className="text-blue-200 text-sm">
                לחץ ESC כדי לחזור • לחץ Enter כדי להתחבר
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 