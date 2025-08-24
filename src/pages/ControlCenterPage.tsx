import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowRight, User, Lock, Mail, Phone, ArrowLeft } from 'lucide-react'
import { useRouter } from '@tanstack/react-router'
import { useUser } from '@/contexts/UserContext'
import { apiClient } from '@/lib/api-client'
import { supabase } from '@/lib/supabaseClient'
import type { User as AppUser } from '@/lib/db/schema-interface'
import { cn } from '@/lib/utils'
import loginBanner from '@/assets/images/login-banner.png'

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
    full_name: 'Admin Admin',
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
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: loginForm.username,
        password: loginForm.password,
      })
      if (authError) {
        const code = (authError as any)?.status || (authError as any)?.code || ''
        const msg = String((authError as any)?.message || '').toLowerCase()
        if (msg.includes('email not confirmed')) throw new Error('יש לאשר את האימייל לפני התחברות')
        if (String(code) === '400') throw new Error('פרטי התחברות שגויים')
        throw new Error('שגיאה בהתחברות, נסה שוב')
      }
      if (!data.session) throw new Error('שגיאת התחברות')
      if (data?.session?.access_token) {
        apiClient.setToken(data.session.access_token)
      }
      const me = await apiClient.getCurrentUser()
      const raw = me.data
      const isUser = (u: any): u is AppUser => !!u && typeof u === 'object' && typeof u.username === 'string' && typeof u.role === 'string'
      if (!isUser(raw)) throw new Error('שם משתמש או סיסמה שגויים')
      const user = raw
      console.log('Authentication result:', user)

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

      // Create Supabase auth user and sign in
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: registerForm.email,
        password: registerForm.password,
        options: { data: { full_name: registerForm.full_name } }
      })
      if (signUpError && signUpError.message && !/User already registered/i.test(signUpError.message)) {
        const code = (signUpError as any)?.status || (signUpError as any)?.code || ''
        if (String(code).startsWith('429')) {
          throw new Error('יותר מדי נסיונות הרשמה, נסה שוב בעוד רגע')
        }
        throw new Error('שגיאה ביצירת משתמש אימייל')
      }
      const hasSession = !!signUpData?.session
      if (!hasSession) {
        const { error: siErr } = await supabase.auth.signInWithPassword({
          email: registerForm.email,
          password: registerForm.password,
        })
        if (siErr) {
          const code = (siErr as any)?.status || (siErr as any)?.code || ''
          const msg = String((siErr as any)?.message || '').toLowerCase()
          if (msg.includes('email not confirmed')) throw new Error('יש לאשר את האימייל שנשלח אליך לפני המשך')
          if (String(code) === '400') throw new Error('פרטי התחברות שגויים לאחר הרשמה')
          throw new Error('שגיאה בהתחברות לאחר הרשמה')
        }
        const sess = await supabase.auth.getSession()
        if (sess.data.session?.access_token) apiClient.setToken(sess.data.session.access_token)
      } else if (signUpData.session?.access_token) {
        apiClient.setToken(signUpData.session.access_token)
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
          phone: registerForm.phone,
          full_name: registerForm.full_name
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
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10" dir="rtl" style={{scrollbarWidth: 'none'}}>
      <div className="w-full max-w-sm md:max-w-3xl">
        {error && (
          <Alert className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className={cn('flex flex-col gap-6')}>
          <Card className="overflow-hidden p-0">
            <CardContent className="grid p-0 md:grid-cols-2">
              {isRegisterMode ? (
                <form onSubmit={handleRegister} className="p-6 md:p-8">
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col items-center text-center">
                      <h1 className="text-2xl font-bold">צור חשבון חדש</h1>
                      <p className="text-muted-foreground text-balance">המשך להגדרת החברה</p>
                    </div>
                    <div className="grid gap-3">
                      <Label htmlFor="regFullName">שם מלא</Label>
                      <Input id="regFullName" type="text" dir="rtl" value={registerForm.full_name} onChange={(e) => setRegisterForm(prev => ({ ...prev, full_name: e.target.value }))} required />
                    </div>
                    <div className="grid gap-3">
                      <Label htmlFor="regUsername">שם משתמש</Label>
                      <Input id="regUsername" type="text" dir="rtl" value={registerForm.username} onChange={(e) => setRegisterForm(prev => ({ ...prev, username: e.target.value }))} required />
                    </div>
                    <div className="grid gap-3">
                      <Label htmlFor="regEmail">אימייל</Label>
                      <Input id="regEmail" type="email" dir="rtl" value={registerForm.email} onChange={(e) => setRegisterForm(prev => ({ ...prev, email: e.target.value }))} required />
                    </div>
                    <div className="grid gap-3">
                      <Label htmlFor="regPhone">טלפון</Label>
                      <Input id="regPhone" type="tel" dir="rtl" value={registerForm.phone} onChange={(e) => setRegisterForm(prev => ({ ...prev, phone: e.target.value }))} required />
                    </div>
                    <div className="grid gap-3">
                      <Label htmlFor="regPassword">סיסמה</Label>
                      <Input id="regPassword" type="password" dir="rtl" value={registerForm.password} onChange={(e) => setRegisterForm(prev => ({ ...prev, password: e.target.value }))} required />
                    </div>
                    <div className="grid gap-3">
                      <Label htmlFor="confirmPassword">אישור סיסמה</Label>
                      <Input id="confirmPassword" type="password" dir="rtl" value={registerForm.confirmPassword} onChange={(e) => setRegisterForm(prev => ({ ...prev, confirmPassword: e.target.value }))} required />
                    </div>
                    <Button type="submit" className="w-full bg-general-primary hover:bg-general-primary/80" disabled={loading}>
                      {loading ? 'ממשיך...' : 'המשך להגדרת החברה'}
                      <ArrowRight className="mr-2 h-4 w-4" />
                    </Button>
                    <div className="text-center text-sm">
                      כבר יש לך חשבון?{' '}
                      <button type="button" onClick={toggleMode} className="underline underline-offset-4">התחבר</button>
                    </div>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleLogin} className="p-6 md:p-8">
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col items-center text-center">
                      <h1 className="text-2xl font-bold">ברוך שובך</h1>
                      <p className="text-muted-foreground text-balance">התחבר למרכז הבקרה</p>
                    </div>
                    <div className="grid gap-3">
                      <Label htmlFor="email">אימייל</Label>
                      <Input id="email" type="email" dir="rtl" placeholder="m@example.com" value={loginForm.username} onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))} required />
                    </div>
                    <div className="grid gap-3">
                      <div className="flex items-center">
                        <Label htmlFor="password">סיסמה</Label>
                        <a href="#" className="ml-auto text-sm underline-offset-2 hover:underline">שכחת סיסמה?</a>
                      </div>
                      <Input id="password" type="password" dir="rtl" value={loginForm.password} onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))} required />
                    </div>
                    <Button type="submit" className="w-full bg-general-primary hover:bg-general-primary/80" disabled={loading}>
                      {loading ? 'מתחבר...' : 'התחברות'}
                    </Button>
                    <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
                      <span className="bg-card text-muted-foreground relative z-10 px-2">או המשך עם</span>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <Button variant="outline" type="button" className="w-full">
                        <svg xmlns="http://www.w3.org/200/svg" viewBox="0 0 24 24" className="h-4 w-4">
                          <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" fill="currentColor" />
                        </svg>
                        <span className="sr-only">התחבר עם גוגל</span>
                      </Button>
                    </div>
                    <div className="text-center text-sm">
                      אין לך חשבון?{' '}
                      <button type="button" onClick={toggleMode} className="underline underline-offset-4">הירשם</button>
                    </div>
                  </div>
                </form>
              )}
              <div className="bg-muted relative hidden md:block">
                <img src={loginBanner} alt="Image" className="absolute inset-0 h-fit w-fit object-cover dark:brightness-[0.2] dark:grayscale" />
              </div>
            </CardContent>
          </Card>
          <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
            בלחיצה על המשך, אתה מסכים ל־ <a href="#">תנאי השירות</a> ו־ <a href="#">מדיניות הפרטיות</a>.
          </div>
        </div>
      </div>
    </div>
  )
}