import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowRight, Building2, User, Lock, Mail, Phone, MapPin, ArrowLeft } from 'lucide-react'
import { useRouter } from '@tanstack/react-router'

interface Company {
  id: number
  name: string
  owner_full_name: string
  email: string
  phone: string
  address: string
  logo_path?: string
  created_at: string
  updated_at: string
}

export default function ControlCenterPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [companies, setCompanies] = useState<Company[]>([])
  const [hasCompanies, setHasCompanies] = useState(false)
  const router = useRouter()

  // Login form state
  const [loginForm, setLoginForm] = useState({
    companyName: '',
    username: 'admin',
    password: 'admin'
  })

  // Registration form state
  const [registerForm, setRegisterForm] = useState({
    companyName: 'admin',
    ownerName: 'admin',
    email: 'admin@admin.com',
    phone: 'admin',
    address: 'admin',
    username: 'admin',
    password: 'admin',
    confirmPassword: 'admin'
  })

  useEffect(() => {
    checkExistingCompanies()
  }, [])

  const checkExistingCompanies = async () => {
    try {
      const companiesData = await window.electronAPI.db('getAllCompanies')
      setCompanies(companiesData)
      setHasCompanies(companiesData.length > 0)
    } catch (error) {
      console.error('Error checking companies:', error)
      setHasCompanies(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      console.log('Login attempt:', { username: loginForm.username, companyName: loginForm.companyName })
      
      // Find the company
      const company = companies.find(c => c.name === loginForm.companyName)
      if (!company) {
        throw new Error('חברה לא נמצאה')
      }
      console.log('Company found:', company)

      // Authenticate user with username and password
      const user = await window.electronAPI.db('authenticateUser', loginForm.username, loginForm.password)
      console.log('Authentication result:', user)

      if (!user) {
        throw new Error('שם משתמש או סיסמה שגויים')
      }

      // Verify user belongs to this company
      const userInCompany = await window.electronAPI.db('getUserByUsername', loginForm.username, company.id)
      console.log('User in company check:', userInCompany)
      
      if (!userInCompany) {
        throw new Error('המשתמש אינו שייך לחברה זו')
      }

      // Store authentication state (you might want to use a proper auth context)
      sessionStorage.setItem('controlCenterCompany', JSON.stringify(company))
      sessionStorage.setItem('currentUser', JSON.stringify(user))
      console.log('Authentication state stored, navigating to dashboard...')

      // Navigate to control center dashboard
      router.navigate({ to: '/control-center/dashboard' })
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

      if (registerForm.password.length < 5) {
        throw new Error('הסיסמה חייבת להכיל לפחות 6 תווים')
      }

      // Check if company name already exists
      const existingCompany = companies.find(c => c.name === registerForm.companyName)
      if (existingCompany) {
        throw new Error('שם החברה כבר קיים במערכת')
      }

      // Create new company
      const newCompany = await window.electronAPI.db('createCompany', {
        name: registerForm.companyName,
        owner_full_name: registerForm.ownerName,
        email: registerForm.email,
        phone: registerForm.phone,
        address: registerForm.address
      })

      // Create admin user for the company
      const adminUser = await window.electronAPI.db('createUser', {
        username: registerForm.username,
        password: registerForm.password, // In production, this should be hashed
        role: 'admin',
        clinic_id: null, // Company admin doesn't belong to specific clinic
        email: registerForm.email,
        phone: registerForm.phone
      })

      // Store authentication state
      sessionStorage.setItem('controlCenterCompany', JSON.stringify(newCompany))
      sessionStorage.setItem('currentUser', JSON.stringify(adminUser))

      // Navigate to control center dashboard
      router.navigate({ to: '/control-center/dashboard' })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'שגיאה ברישום')
    } finally {
      setLoading(false)
    }
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
            {hasCompanies ? 'התחברו למערכת הניהול' : 'צרו חברה חדשה במערכת'}
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
            {hasCompanies ? (
              // Show login/register tabs if companies exist
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login">התחברות</TabsTrigger>
                  <TabsTrigger value="register">רישום</TabsTrigger>
                </TabsList>

                {/* Login Tab */}
                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2" dir="rtl">
                      <Label htmlFor="companyName">שם החברה</Label>
                      <select
                        dir="rtl"
                        id="companyName"
                        value={loginForm.companyName}
                        onChange={(e) => setLoginForm(prev => ({ ...prev, companyName: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        required
                      >
                        <option value="">בחרו חברה</option>
                        {companies.map(company => (
                          <option key={company.id} value={company.name}>
                            {company.name}
                          </option>
                        ))}
                      </select>
                    </div>

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
                </TabsContent>

                {/* Register Tab */}
                <TabsContent value="register">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4" dir="rtl">
                      <div className="space-y-2" dir="rtl">
                        <Label htmlFor="regCompanyName">שם החברה</Label>
                        <div className="relative">
                          <Building2 className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            dir="rtl"
                            id="regCompanyName"
                            type="text"
                            value={registerForm.companyName}
                            onChange={(e) => setRegisterForm(prev => ({ ...prev, companyName: e.target.value }))}
                            className="pr-10"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2" dir="rtl">
                        <Label htmlFor="ownerName">שם הבעלים</Label>
                        <div className="relative">
                          <User className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            dir="rtl"
                            id="ownerName"
                            type="text"
                            value={registerForm.ownerName}
                            onChange={(e) => setRegisterForm(prev => ({ ...prev, ownerName: e.target.value }))}
                            className="pr-10"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4" dir="rtl">
                      <div className="space-y-2">
                        <Label htmlFor="email">אימייל</Label>
                        <div className="relative">
                          <Mail className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            dir="rtl"
                            id="email"
                            type="email"
                            value={registerForm.email}
                            onChange={(e) => setRegisterForm(prev => ({ ...prev, email: e.target.value }))}
                            className="pr-10"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2" dir="rtl">
                        <Label htmlFor="phone">טלפון</Label>
                        <div className="relative">
                          <Phone className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            dir="rtl"
                            id="phone"
                            type="tel"
                            value={registerForm.phone}
                            onChange={(e) => setRegisterForm(prev => ({ ...prev, phone: e.target.value }))}
                            className="pr-10"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2" dir="rtl">
                      <Label htmlFor="address">כתובת</Label>
                      <div className="relative">
                        <MapPin className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          dir="rtl"
                          id="address"
                          type="text"
                          value={registerForm.address}
                          onChange={(e) => setRegisterForm(prev => ({ ...prev, address: e.target.value }))}
                          className="pr-10"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4" dir="rtl">
                      <div className="space-y-2">
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
                        <div className="relative" dir="rtl">
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
                    </div>

                    <div className="space-y-2" dir="rtl">
                      <Label htmlFor="confirmPassword">אישור סיסמה</Label>
                      <div className="relative" dir="rtl">
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

                    <Button type="submit" className="w-full bg-general-primary hover:bg-general-primary/80" disabled={loading}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                      {loading ? 'יוצר חברה...' : 'צור חברה'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            ) : (
              // Show only registration form if no companies exist
              <div>
                <CardHeader className="px-0 pb-4">
                  <CardTitle className="text-center text-xl">צור חברה ראשונה</CardTitle>
                </CardHeader>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4" dir="rtl">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">שם החברה</Label>
                      <div className="relative">
                        <Building2 className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="companyName"
                          type="text"
                          value={registerForm.companyName}
                          onChange={(e) => setRegisterForm(prev => ({ ...prev, companyName: e.target.value }))}
                          className="pr-10"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ownerName">שם הבעלים</Label>
                      <div className="relative">
                        <User className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="ownerName"
                          type="text"
                          value={registerForm.ownerName}
                          onChange={(e) => setRegisterForm(prev => ({ ...prev, ownerName: e.target.value }))}
                          className="pr-10"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4" dir="rtl">
                    <div className="space-y-2">
                      <Label htmlFor="email">אימייל</Label>
                      <div className="relative">
                        <Mail className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="email"
                          type="email"
                          value={registerForm.email}
                          onChange={(e) => setRegisterForm(prev => ({ ...prev, email: e.target.value }))}
                          className="pr-10"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">טלפון</Label>
                      <div className="relative">
                        <Phone className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="phone"
                          type="tel"
                          value={registerForm.phone}
                          onChange={(e) => setRegisterForm(prev => ({ ...prev, phone: e.target.value }))}
                          className="pr-10"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">כתובת</Label>
                    <div className="relative">
                      <MapPin className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="address"
                        type="text"
                        value={registerForm.address}
                        onChange={(e) => setRegisterForm(prev => ({ ...prev, address: e.target.value }))}
                        className="pr-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4" dir="rtl">
                    <div className="space-y-2">
                      <Label htmlFor="username">שם משתמש</Label>
                      <div className="relative">
                        <User className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="username"
                          type="text"
                          value={registerForm.username}
                          onChange={(e) => setRegisterForm(prev => ({ ...prev, username: e.target.value }))}
                          className="pr-10"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">סיסמה</Label>
                      <div className="relative">
                        <Lock className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="password"
                          type="password"
                          value={registerForm.password}
                          onChange={(e) => setRegisterForm(prev => ({ ...prev, password: e.target.value }))}
                          className="pr-10"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">אישור סיסמה</Label>
                    <div className="relative">
                      <Lock className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={registerForm.confirmPassword}
                        onChange={(e) => setRegisterForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        className="pr-10"
                        required
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full bg-general-primary hover:bg-general-primary/80" disabled={loading}>
                    {loading ? 'יוצר חברה...' : 'צור חברה והתחל'}
                    <ArrowRight className="mr-2 h-4 w-4" />
                  </Button>
                </form>
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