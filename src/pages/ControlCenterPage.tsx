import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowRight, Building2, User, Lock, Mail, Phone, ArrowLeft } from 'lucide-react'
import { useRouter } from '@tanstack/react-router'
import { useUser } from '@/contexts/UserContext'
import { apiClient } from '@/lib/api-client'

export default function ControlCenterPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isRegisterMode, setIsRegisterMode] = useState(false)
  const router = useRouter()
  const { setCurrentUser } = useUser()

  // Login form state
  const [loginForm, setLoginForm] = useState({
    username: 'admin',
    password: 'admin'
  })

  // Registration form state
  const [registerForm, setRegisterForm] = useState({
    username: 'admin',
    password: 'admin',
    confirmPassword: 'admin',
    email: 'admin@admin.com',
    phone: 'admin'
  })

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      console.log('Login attempt:', { username: loginForm.username })
      
      // Authenticate user with username and password
      const userResponse = await apiClient.authenticateUser(loginForm.username, loginForm.password);
      const user = userResponse.data;
      console.log('Authentication result:', user)

      if (!user || !('role' in user)) {
        throw new Error('שם משתמש או סיסמה שגויים')
      }

      // Verify user has CEO role
      if (user.role !== 'company_ceo') {
        throw new Error('אין לך הרשאות לגשת למרכז הבקרה')
      }

      // Determine user's company
      let userCompany = null as any
      // If CEO, prefer company_id on the user when available
      if ((user as any).company_id) {
        const companyResp = await apiClient.getCompany((user as any).company_id)
        userCompany = companyResp.data
      }
      if (!userCompany) {
        // Try authenticated companies
        const companiesAuth = await apiClient.getCompanies();
        const companies = companiesAuth.data || []
        userCompany = companies[0]
      }
      if (!userCompany) {
        const companiesPublic = await apiClient.getCompaniesPublic();
        userCompany = (companiesPublic.data || [])[0]
      }
      if (!userCompany) {
        throw new Error('לא נמצאה חברה במערכת')
      }

      // Store authentication state
      localStorage.setItem('controlCenterCompany', JSON.stringify(userCompany))
      localStorage.setItem('currentUser', JSON.stringify(user))
      console.log('Authentication state stored, navigating to dashboard...')

      await setCurrentUser(user)
      localStorage.setItem('currentUser', JSON.stringify(user))
      console.log('User set in context, navigating to dashboard...')

      // Navigate to control center dashboard
      router.navigate({ 
        to: '/control-center/dashboard',
        search: {
          companyId: userCompany.id?.toString() || '',
          companyName: userCompany.name,
          fromSetup: 'false'
        }
      })
    } catch (error) {
      console.error('Login error:', error)
      setError(error instanceof Error ? error.message : 'שגיאה בהתחברות')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Validate form
      if (registerForm.password !== registerForm.confirmPassword) {
        throw new Error('הסיסמאות אינן תואמות')
      }

      if (registerForm.password.length < 6) {
        throw new Error('הסיסמה חייבת להכיל לפחות 6 תווים')
      }

      // Validate username/email are available before proceeding
      const byUsername = await apiClient.getUserByUsernamePublic(registerForm.username)
      if (byUsername.data) {
        throw new Error('שם המשתמש כבר בשימוש')
      }
      if (byUsername.error && byUsername.error !== 'User not found') {
        throw new Error('שגיאת רשת בבדיקת שם המשתמש')
      }

      if (registerForm.email) {
        const byEmail = await apiClient.getUserByEmailPublic(registerForm.email)
        if (byEmail.data) {
          throw new Error('האימייל כבר בשימוש')
        }
        if (byEmail.error && byEmail.error !== 'User not found') {
          throw new Error('שגיאת רשת בבדיקת האימייל')
        }
      }

      // Navigate to setup wizard for company creation
      router.navigate({ 
        to: '/setup-wizard',
        search: {
          companyId: '',
          companyName: '',
          username: registerForm.username,
          password: registerForm.password,
          email: registerForm.email,
          phone: registerForm.phone
        }
      })
    } catch (error) {
      console.error('Registration error:', error)
      setError(error instanceof Error ? error.message : 'שגיאה בהרשמה')
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = () => {
    setIsRegisterMode(!isRegisterMode)
    setError('')
  }

  return (
    <div className="h-full bg-accent/50 dark:bg-slate-900 flex items-center justify-center p-6" dir="rtl" style={{scrollbarWidth: 'none'}}>
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-general-secondary rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            מרכז בקרה
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {isRegisterMode ? 'צור חשבון חדש' : 'התחבר למערכת'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50 text-red-800">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="bg-white dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl" dir="rtl">
          <CardContent className="p-6" dir="rtl">
            {isRegisterMode ? (
              // Registration Form
              <div>
                <CardHeader className="px-0 pb-4">
                  <CardTitle className="text-center text-xl">צור חשבון חדש</CardTitle>
                </CardHeader>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2" dir="rtl">
                    <Label htmlFor="regUsername">שם משתמש</Label>
                    <div className="relative">
                      <User className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        dir="rtl"
                        id="regUsername"
                        type="text"
                        value={registerForm.username}
                        onChange={(e) => setRegisterForm(prev => ({ ...prev, username: e.target.value }))}
                        className="pr-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2" dir="rtl">
                    <Label htmlFor="regPassword">סיסמה</Label>
                    <div className="relative">
                      <Lock className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        dir="rtl"
                        id="regPassword"
                        type="password"
                        value={registerForm.password}
                        onChange={(e) => setRegisterForm(prev => ({ ...prev, password: e.target.value }))}
                        className="pr-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2" dir="rtl">
                    <Label htmlFor="confirmPassword">אישור סיסמה</Label>
                    <div className="relative">
                      <Lock className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        dir="rtl"
                        id="confirmPassword"
                        type="password"
                        value={registerForm.confirmPassword}
                        onChange={(e) => setRegisterForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        className="pr-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2" dir="rtl">
                    <Label htmlFor="regEmail">אימייל</Label>
                    <div className="relative">
                      <Mail className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        dir="rtl"
                        id="regEmail"
                        type="email"
                        value={registerForm.email}
                        onChange={(e) => setRegisterForm(prev => ({ ...prev, email: e.target.value }))}
                        className="pr-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2" dir="rtl">
                    <Label htmlFor="regPhone">טלפון</Label>
                    <div className="relative">
                      <Phone className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        dir="rtl"
                        id="regPhone"
                        type="tel"
                        value={registerForm.phone}
                        onChange={(e) => setRegisterForm(prev => ({ ...prev, phone: e.target.value }))}
                        className="pr-10"
                        required
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full bg-general-primary hover:bg-general-primary/80" disabled={loading}>
                    {loading ? 'ממשיך...' : 'המשך להגדרת החברה'}
                    <ArrowRight className="mr-2 h-4 w-4" />
                  </Button>
                </form>

                <div className="mt-4 text-center">
                  <Button
                    variant="ghost"
                    onClick={toggleMode}
                    className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  >
                    יש לך כבר חשבון? התחבר
                  </Button>
                </div>
              </div>
            ) : (
              // Login Form
              <div>
                <CardHeader className="px-0 pb-4">
                  <CardTitle className="text-center text-xl">התחברות למערכת</CardTitle>
                </CardHeader>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2" dir="rtl">
                    <Label htmlFor="username">שם משתמש</Label>
                    <div className="relative">
                      <User className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        dir="rtl"
                        id="username"
                        type="text"
                        value={loginForm.username}
                        onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                        className="pr-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2" dir="rtl">
                    <Label htmlFor="password">סיסמה</Label>
                    <div className="relative">
                      <Lock className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        dir="rtl"
                        id="password"
                        type="password"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                        className="pr-10"
                        required
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full bg-general-primary hover:bg-general-primary/80" disabled={loading}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {loading ? 'מתחבר...' : 'התחברות'}
                  </Button>
                </form>

                <div className="mt-4 text-center">
                  <Button
                    variant="ghost"
                    onClick={toggleMode}
                    className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  >
                    אין לך חשבון? צור חשבון חדש
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Back to Welcome */}
        <div className="text-center mt-6">
          <Button
            variant="ghost"
            onClick={() => router.navigate({ to: '/' })}
            className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          >
            חזרה למסך הבית
          </Button>
        </div>
      </div>
    </div>
  )
}