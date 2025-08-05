import React, { useState, useEffect } from "react"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { User, Company } from "@/lib/db/schema-interface"
import { getAllUsers, updateUser, deleteUser } from "@/lib/db/users-db"
import { applyThemeColorsFromSettings } from "@/helpers/theme_helpers"
import { Badge } from "@/components/ui/badge"
import { IconPlus, IconEdit, IconTrash, IconCalendar, IconBrandGoogle } from "@tabler/icons-react"
import { useUser } from "@/contexts/UserContext"
import { UserModal } from "@/components/UserModal"
import { apiClient } from "@/lib/api-client"

export default function ControlCenterSettingsPage() {
  const { currentUser, setCurrentUser } = useUser()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  
  const [company, setCompany] = useState<Company | null>(null)
  const [localCompany, setLocalCompany] = useState<Partial<Company>>({
    name: '',
    owner_full_name: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    logo_path: ''
  })

  const [personalProfile, setPersonalProfile] = useState<Partial<User>>({
    username: '',
    email: '',
    phone: '',
    profile_picture: '',
    primary_theme_color: '#3b82f6',
    secondary_theme_color: '#8b5cf6',
    theme_preference: 'system'
  })
  const [profileColorUpdateTimeout, setProfileColorUpdateTimeout] = useState<NodeJS.Timeout | null>(null)

  const [googleCalendarLoading, setGoogleCalendarLoading] = useState(false)
  const [googleCalendarSyncing, setGoogleCalendarSyncing] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        
        // For control center users, get company through clinic
        let companyData = null
        if (currentUser?.clinic_id) {
          const clinicResponse = await apiClient.getClinic(currentUser.clinic_id);
          const clinic = clinicResponse.data;
          if (clinic?.company_id) {
            const companyResponse = await apiClient.getCompany(clinic.company_id);
            companyData = companyResponse.data;
          }
        } else {
          // For global users, get the first company
          const companiesResponse = await apiClient.getCompanies();
          const companies = companiesResponse.data || [];
          companyData = companies.length > 0 ? companies[0] : null;
        }
        if (companyData) {
          setCompany(companyData)
          setLocalCompany({
            name: companyData.name || '',
            owner_full_name: companyData.owner_full_name || '',
            contact_email: companyData.contact_email || '',
            contact_phone: companyData.contact_phone || '',
            address: companyData.address || '',
            logo_path: companyData.logo_path || ''
          })
        }

        const usersData = await getAllUsers()
        setUsers(usersData)

        if (currentUser) {
          setPersonalProfile({
            username: currentUser.username,
            email: currentUser.email || '',
            phone: currentUser.phone || '',
            profile_picture: currentUser.profile_picture || '',
            primary_theme_color: currentUser.primary_theme_color || '#3b82f6',
            secondary_theme_color: currentUser.secondary_theme_color || '#8b5cf6',
            theme_preference: currentUser.theme_preference || 'system'
          })
        }
      } catch (error) {
        console.error('Error loading data:', error)
        toast.error('שגיאה בטעינת הנתונים')
      } finally {
        setLoading(false)
      }
    }

    loadData()
    
    return () => {
      if (profileColorUpdateTimeout) {
        clearTimeout(profileColorUpdateTimeout)
      }
    }
  }, [currentUser])

  const handleCompanyChange = (field: keyof Company, value: string) => {
    const newCompany = { ...localCompany, [field]: value }
    setLocalCompany(newCompany)
  }

  const handlePersonalProfileChange = (field: keyof User, value: string) => {
    const newProfile = { ...personalProfile, [field]: value }
    setPersonalProfile(newProfile)
    
    if (field === 'primary_theme_color' || field === 'secondary_theme_color') {
      if (profileColorUpdateTimeout) {
        clearTimeout(profileColorUpdateTimeout)
      }
      
      const timeout = setTimeout(() => {
        applyThemeColorsFromSettings({
          primary_theme_color: newProfile.primary_theme_color,
          secondary_theme_color: newProfile.secondary_theme_color
        } as any)
      }, 150)
      
      setProfileColorUpdateTimeout(timeout)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setSaveSuccess(false)
      
      if (company?.id) {
        const updatedCompanyResponse = await apiClient.updateCompany(company.id, {
          ...company,
          ...localCompany
        });
        const updatedCompany = updatedCompanyResponse.data;
        
        if (updatedCompany) {
          setCompany(updatedCompany)
          setLocalCompany({
            name: updatedCompany.name || '',
            owner_full_name: updatedCompany.owner_full_name || '',
            contact_email: updatedCompany.contact_email || '',
            contact_phone: updatedCompany.contact_phone || '',
            address: updatedCompany.address || '',
            logo_path: updatedCompany.logo_path || ''
          })
        } else {
          toast.error('שגיאה בשמירת פרטי החברה')
          return
        }
      }
      
      if (currentUser?.id) {
        const updatedUser = await updateUser({
          ...currentUser,
          username: personalProfile.username || currentUser.username,
          email: personalProfile.email,
          phone: personalProfile.phone,
          profile_picture: personalProfile.profile_picture,
          primary_theme_color: personalProfile.primary_theme_color,
          secondary_theme_color: personalProfile.secondary_theme_color,
          theme_preference: personalProfile.theme_preference
        })
        
        if (updatedUser) {
          setPersonalProfile({
            username: updatedUser.username,
            email: updatedUser.email || '',
            phone: updatedUser.phone || '',
            profile_picture: updatedUser.profile_picture || '',
            primary_theme_color: updatedUser.primary_theme_color || '#3b82f6',
            secondary_theme_color: updatedUser.secondary_theme_color || '#8b5cf6',
            theme_preference: updatedUser.theme_preference || 'system'
          })
          
          await setCurrentUser(updatedUser)
        } else {
          toast.error('שגיאה בשמירת הפרופיל האישי')
          return
        }
      }
      
      setSaveSuccess(true)
      setTimeout(() => {
        setSaveSuccess(false)
      }, 2000)
      toast.success('כל ההגדרות נשמרו בהצלחה')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('שגיאה בשמירת ההגדרות')
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        handleCompanyChange('logo_path', result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleProfilePictureUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        handlePersonalProfileChange('profile_picture', result)
      }
      reader.readAsDataURL(file)
    }
  }

  const openCreateUserModal = () => {
    setEditingUser(null)
    setShowUserModal(true)
  }

  const openEditUserModal = (user: User) => {
    if (currentUser?.role !== 'company_ceo' && user.id !== currentUser?.id) {
      toast.error('אין לך הרשאה לערוך משתמש זה')
      return
    }
    
    setEditingUser(user)
    setShowUserModal(true)
  }

  const handleUserDelete = async (userId: number) => {
    if (currentUser?.role !== 'company_ceo') {
      toast.error('אין לך הרשאה למחוק משתמשים')
      return
    }
    
    if (userId === currentUser?.id) {
      toast.error('לא ניתן למחוק את המשתמש הנוכחי')
      return
    }
    
    if (window.confirm('האם אתה בטוח שברצונך למחוק את המשתמש?')) {
      try {
        const success = await deleteUser(userId)
        if (success) {
          setUsers(prev => prev.filter(u => u.id !== userId))
          toast.success('המשתמש נמחק בהצלחה')
        } else {
          toast.error('שגיאה במחיקת המשתמש')
        }
      } catch (error) {
        console.error('Error deleting user:', error)
        toast.error('שגיאה במחיקת המשתמש')
      }
    }
  }

  const handleConnectGoogleAccount = async () => {
    if (!currentUser?.id) return

    try {
      setGoogleCalendarLoading(true)
      toast.info('מתחבר לחשבון Google...')
      
      const result = await window.electronAPI.googleOAuthAuthenticate()
      
      if (result.success === false) {
        toast.error(`שגיאה בחיבור לחשבון Google: ${result.error}`)
        return
      }
      
      if (result.tokens && result.userInfo) {
        const updatedUser = await updateUser({
          ...currentUser,
          google_account_connected: true,
          google_account_email: result.userInfo.email,
          google_access_token: result.tokens.access_token,
          google_refresh_token: result.tokens.refresh_token
        })
        
        if (updatedUser) {
          await setCurrentUser(updatedUser)
          setPersonalProfile(prev => ({
            ...prev,
            google_account_connected: true,
            google_account_email: result.userInfo?.email
          }))
          toast.success('חשבון Google חובר בהצלחה!')
        } else {
          toast.error('שגיאה בשמירת פרטי חשבון Google')
        }
      } else {
        toast.error('לא התקבלו נתוני הרשאה מ-Google')
      }
    } catch (error) {
      console.error('Error connecting Google account:', error)
      toast.error('שגיאה בחיבור חשבון Google')
    } finally {
      setGoogleCalendarLoading(false)
    }
  }

  const handleDisconnectGoogleAccount = async () => {
    if (!currentUser?.id) return

    try {
      setGoogleCalendarLoading(true)
      
      const updatedUser = await updateUser({
        ...currentUser,
        google_account_connected: false,
        google_account_email: undefined,
        google_access_token: undefined,
        google_refresh_token: undefined
      })
      
      if (updatedUser) {
        await setCurrentUser(updatedUser)
        setPersonalProfile(prev => ({
          ...prev,
          google_account_connected: false,
          google_account_email: undefined
        }))
        toast.success('חשבון Google נותק בהצלחה!')
      } else {
        toast.error('שגיאה בניתוק חשבון Google')
      }
    } catch (error) {
      console.error('Error disconnecting Google account:', error)
      toast.error('שגיאה בניתוק חשבון Google')
    } finally {
      setGoogleCalendarLoading(false)
    }
  }

  const handleSyncGoogleCalendar = async () => {
    if (!currentUser?.id || !currentUser.google_account_connected) return

    try {
      setGoogleCalendarSyncing(true)
      toast.info('מסנכרן תורים עם Google Calendar...')
      
      const tokens = {
        access_token: currentUser.google_access_token,
        refresh_token: currentUser.google_refresh_token,
        scope: 'https://www.googleapis.com/auth/calendar',
        token_type: 'Bearer',
        expiry_date: Date.now() + 3600000
      }
      
      const appointmentsResponse = await apiClient.getAppointmentsByUser(currentUser.id)
      const appointments = appointmentsResponse.data || []
      
      const appointmentsWithClients = await Promise.all(
        appointments.map(async (appointment: any) => {
          const clientResponse = await apiClient.getClientById(appointment.client_id)
          const client = clientResponse.data
          return { appointment, client }
        })
      )
      
      const syncResult = await window.electronAPI.googleCalendarSyncAppointments(tokens, appointmentsWithClients)
      
      if (syncResult.success > 0) {
        toast.success(`${syncResult.success} תורים סונכרנו בהצלחה עם Google Calendar!`)
        if (syncResult.failed > 0) {
          toast.warning(`${syncResult.failed} תורים לא הצליחו להיסנכרן`)
        }
      } else {
        toast.error('לא הצליח לסנכרן תורים עם Google Calendar')
      }
    } catch (error) {
      console.error('Error syncing Google Calendar:', error)
      toast.error('שגיאה בסנכרון עם Google Calendar')
    } finally {
      setGoogleCalendarSyncing(false)
    }
  }

  if (loading) {
    return (
      <>
        <SiteHeader title="הגדרות מרכז הבקרה" />
        <div className="flex flex-col items-center justify-center h-full" dir="rtl">
          <div className="text-lg">טוען הגדרות...</div>
        </div>
      </>
    )
  }

  return (
    <>
      <SiteHeader title="הגדרות מרכז הבקרה" />
      <div className="h-[calc(100vh-4rem)] flex flex-col" dir="rtl">
        <div className="flex-shrink-0 bg-transparent pt-5 pb-2">
          <div className="max-w-4xl mx-auto flex justify-between items-start">
            <div className="text-right space-y-2">
              <h1 className="text-2xl font-bold">הגדרות מרכז הבקרה</h1>
              <p className="text-muted-foreground">נהל את פרטי החברה והגדרות המערכת</p>
            </div>
            <div className="flex items-center gap-3 pt-6 pl-1">
              <Button 
                onClick={handleSave} 
                disabled={saving}
                size="lg"
                className="px-8 shadow-md w-[140px] h-10 relative"
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={`transition-opacity duration-150 ${saving ? 'opacity-0' : 'opacity-100'}`}>
                    <span>שמור הכל</span>
                  </div>
                  <div className={`absolute transition-opacity duration-150 ${saving ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  </div>
                </div>
              </Button>
              
              {saveSuccess && (
                <div className="flex items-center text-green-600 animate-fade-in">
                  <svg 
                    className="w-5 h-5" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M5 13l4 4L19 7" 
                    />
                  </svg>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="max-w-[950px] mx-auto h-full">
            <Tabs defaultValue="company-profile" className="h-full flex" orientation="vertical">
              <div className="flex h-full gap-6 p-6">
                <div className="flex-1 overflow-y-auto pr-2 pb-8" style={{scrollbarWidth: 'none'}}>
                  
                  <TabsContent value="company-profile" className="space-y-6 mt-0">
                    <Card className="shadow-md border-none">
                      <CardHeader>
                        <CardTitle className="text-right">פרטים בסיסיים</CardTitle>
                        <p className="text-sm text-muted-foreground text-right">מידע כללי על החברה והבעלים</p>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="company_name" className="text-right block text-sm">שם החברה</Label>
                            <Input
                              id="company_name"
                              value={localCompany.name || ''}
                              onChange={(e) => handleCompanyChange('name', e.target.value)}
                              placeholder="הזן שם החברה"
                              className="text-right h-9"
                              dir="rtl"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="owner_full_name" className="text-right block text-sm">שם הבעלים</Label>
                            <Input
                              id="owner_full_name"
                              value={localCompany.owner_full_name || ''}
                              onChange={(e) => handleCompanyChange('owner_full_name', e.target.value)}
                              placeholder="הזן שם הבעלים"
                              className="text-right h-9"
                              dir="rtl"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="shadow-md border-none">
                      <CardHeader>
                        <CardTitle className="text-right">פרטי קשר וכתובת</CardTitle>
                        <p className="text-sm text-muted-foreground text-right">דרכי יצירת קשר ומיקום החברה</p>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <h3 className="text-sm font-medium text-right text-muted-foreground">פרטי קשר</h3>
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <Label htmlFor="contact_email" className="text-right block text-sm">אימייל</Label>
                                <Input
                                  id="contact_email"
                                  type="email"
                                  value={localCompany.contact_email || ''}
                                  onChange={(e) => handleCompanyChange('contact_email', e.target.value)}
                                  placeholder="company@example.com"
                                  className="text-right h-9"
                                  dir="rtl"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="contact_phone" className="text-right block text-sm">טלפון</Label>
                                <Input
                                  id="contact_phone"
                                  value={localCompany.contact_phone || ''}
                                  onChange={(e) => handleCompanyChange('contact_phone', e.target.value)}
                                  placeholder="050-1234567"
                                  className="text-right h-9"
                                  dir="rtl"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h3 className="text-sm font-medium text-right text-muted-foreground">כתובת</h3>
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <Label htmlFor="address" className="text-right block text-sm">כתובת החברה</Label>
                                <Input
                                  id="address"
                                  value={localCompany.address || ''}
                                  onChange={(e) => handleCompanyChange('address', e.target.value)}
                                  placeholder="רחוב הרצל 123, תל אביב"
                                  className="text-right h-9"
                                  dir="rtl"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="shadow-md border-none">
                      <CardHeader>
                        <CardTitle className="text-right">מיתוג</CardTitle>
                        <p className="text-sm text-muted-foreground text-right">לוגו החברה</p>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-col items-center space-y-3">
                          <div className="relative">
                            {localCompany.logo_path ? (
                              <img 
                                src={localCompany.logo_path} 
                                alt="לוגו החברה" 
                                className="w-24 h-24 rounded-lg object-cover shadow-lg"
                              />
                            ) : (
                              <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center shadow-lg">
                                <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                            <Input
                              id="logo-upload"
                              type="file"
                              accept="image/*"
                              onChange={handleLogoUpload}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                          </div>
                          <div className="text-center">
                            <Label className="text-sm font-medium">לוגו החברה</Label>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="mt-2 text-xs shadow-sm"
                              onClick={() => document.getElementById('logo-upload')?.click()}
                            >
                              שנה תמונה
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="personal-profile" className="space-y-6 mt-0">
                    <Card className="shadow-md border-none">
                      <CardHeader>
                        <CardTitle className="text-right">פרטים אישיים</CardTitle>
                        <p className="text-sm text-muted-foreground text-right">תמונת פרופיל ופרטי יצירת קשר</p>
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-8 items-start">
                          <div className="flex flex-col items-center space-y-3 min-w-[140px]">
                            <div className="relative">
                              {personalProfile.profile_picture ? (
                                <img 
                                  src={personalProfile.profile_picture} 
                                  alt="תמונת פרופיל" 
                                  className="w-24 h-24 rounded-full object-cover shadow-lg"
                                />
                              ) : (
                                <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center shadow-lg">
                                  <span className="text-2xl font-semibold text-muted-foreground">
                                    {personalProfile.username?.charAt(0)?.toUpperCase() || 'U'}
                                  </span>
                                </div>
                              )}
                              <Input
                                id="profile-picture-upload"
                                type="file"
                                accept="image/*"
                                onChange={handleProfilePictureUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              />
                            </div>
                            <div className="text-center">
                              <Label className="text-sm font-medium">תמונת פרופיל</Label>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="mt-2 text-xs shadow-sm"
                                onClick={() => document.getElementById('profile-picture-upload')?.click()}
                              >
                                שנה תמונה
                              </Button>
                            </div>
                          </div>
                          
                          <div className="flex-1 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="personal_username" className="text-right block text-sm">שם משתמש</Label>
                                <Input
                                  id="personal_username"
                                  value={personalProfile.username || ''}
                                  onChange={(e) => handlePersonalProfileChange('username', e.target.value)}
                                  placeholder="הזן שם משתמש"
                                  className="text-right h-9"
                                  dir="rtl"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="personal_email" className="text-right block text-sm">אימייל</Label>
                                <Input
                                  id="personal_email"
                                  type="email"
                                  value={personalProfile.email || ''}
                                  onChange={(e) => handlePersonalProfileChange('email', e.target.value)}
                                  placeholder="example@email.com"
                                  className="text-right h-9"
                                  dir="rtl"
                                />
                              </div>
                              <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="personal_phone" className="text-right block text-sm">טלפון</Label>
                                <Input
                                  id="personal_phone"
                                  value={personalProfile.phone || ''}
                                  onChange={(e) => handlePersonalProfileChange('phone', e.target.value)}
                                  placeholder="050-1234567"
                                  className="text-right h-9"
                                  dir="rtl"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="shadow-md border-none">
                      <CardHeader>
                        <CardTitle className="text-right">צבעי המערכת האישיים</CardTitle>
                        <p className="text-sm text-muted-foreground text-right">התאם את צבעי המערכת לפי הטעם האישי שלך</p>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-6">
                          <div className="space-y-2">
                            <Label className="text-right block text-sm font-medium">צבע ראשי</Label>
                            <div className="flex items-center gap-4">
                              <Input
                                type="color"
                                value={personalProfile.primary_theme_color || '#3b82f6'}
                                onChange={(e) => handlePersonalProfileChange('primary_theme_color', e.target.value)}
                                className="w-16 h-12 p-1 rounded shadow-sm"
                              />
                              <div className="flex-1">
                                <Input
                                  value={personalProfile.primary_theme_color || '#3b82f6'}
                                  onChange={(e) => handlePersonalProfileChange('primary_theme_color', e.target.value)}
                                  className="font-mono text-center shadow-sm h-9"
                                  dir="ltr"
                                />
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-right block text-sm font-medium">צבע משני</Label>
                            <div className="flex items-center gap-4">
                              <Input
                                type="color"
                                value={personalProfile.secondary_theme_color || '#8b5cf6'}
                                onChange={(e) => handlePersonalProfileChange('secondary_theme_color', e.target.value)}
                                className="w-16 h-12 p-1 rounded shadow-sm"
                              />
                              <div className="flex-1">
                                <Input
                                  value={personalProfile.secondary_theme_color || '#8b5cf6'}
                                  onChange={(e) => handlePersonalProfileChange('secondary_theme_color', e.target.value)}
                                  className="font-mono text-center shadow-sm h-9"
                                  dir="ltr"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="shadow-md border-none">
                      <CardHeader>
                        <CardTitle className="text-right flex items-center gap-2 justify-end">
                          <IconCalendar className="h-5 w-5" />
                          חיבור ל-Google Calendar
                        </CardTitle>
                        <p className="text-sm text-muted-foreground text-right">סנכרן את התורים שלך עם Google Calendar</p>
                      </CardHeader>
                      <CardContent>
                        {currentUser?.google_account_connected ? (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                              <div className="flex items-center gap-3">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleDisconnectGoogleAccount}
                                  disabled={googleCalendarLoading}
                                  className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                                >
                                  {googleCalendarLoading ? (
                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin ml-2" />
                                  ) : null}
                                  נתק חשבון
                                </Button>
                                <Button
                                  onClick={handleSyncGoogleCalendar}
                                  disabled={googleCalendarSyncing || googleCalendarLoading}
                                  className="flex items-center gap-2"
                                >
                                  {googleCalendarSyncing ? (
                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <IconCalendar className="h-4 w-4" />
                                  )}
                                  {googleCalendarSyncing ? 'מסנכרן...' : 'סנכרן עכשיו'}
                                </Button>
                              </div>
                              
                              <div className="text-right">
                                <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  <span className="font-medium">מחובר ל-Google Calendar</span>
                                </div>
                                <div className="text-sm text-green-600 dark:text-green-400 mt-1">
                                  {currentUser.google_account_email}
                                </div>
                              </div>
                            </div>
                            
                            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2 text-right">מידע על הסנכרון</h4>
                              <ul className="text-xs text-blue-700 dark:text-blue-300 text-right space-y-1" dir="rtl">
                                <li>• התורים מהעמוד הראשי יסונכרנו עם Google Calendar שלך</li>
                                <li>• שינויים בתורים יתעדכנו באופן אוטומטי ב-Google Calendar</li>
                                <li>• ניתן לסנכרן באופן ידני או לקבוע סנכרון אוטומטי</li>
                              </ul>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                              <Button
                                onClick={handleConnectGoogleAccount}
                                disabled={googleCalendarLoading}
                                className="flex items-center gap-2"
                              >
                                {googleCalendarLoading ? (
                                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <IconBrandGoogle className="h-4 w-4" />
                                )}
                                {googleCalendarLoading ? 'מתחבר...' : 'חבר חשבון Google'}
                              </Button>
                              
                              <div className="text-right">
                                <div className="font-medium text-gray-700 dark:text-gray-300">לא מחובר ל-Google Calendar</div>
                                <div className="text-sm text-muted-foreground mt-1">
                                  חבר את חשבון Google שלך כדי לסנכרן תורים
                                </div>
                              </div>
                            </div>
                            
                            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2 text-right">יתרונות החיבור ל-Google Calendar</h4>
                              <ul className="text-xs text-blue-700 dark:text-blue-300 text-right space-y-1" dir="rtl">
                                <li>• סנכרון אוטומטי של כל התורים שלך</li>
                                <li>• גישה לתורים מכל מכשיר דרך Google Calendar</li>
                                <li>• התראות ותזכורות מ-Google על תורים קרובים</li>
                                <li>• אפשרות לשתף את לוח הזמנים עם חברי צוות</li>
                              </ul>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="users" className="space-y-6 mt-0">
                    <Card className="shadow-md border-none">
                      <CardHeader>
                        <div className="flex justify-between">
                          <Button 
                            onClick={openCreateUserModal} 
                            size="icon"
                            className="mr-4 bg-default text-default-foreground hover:bg-accent/90"
                            title="הוסף משתמש חדש"
                          >
                            <IconPlus className="h-4 w-4" />
                          </Button>
                          <div></div>
                          <div className="text-right ">
                            <CardTitle className="text-right">ניהול משתמשים</CardTitle>
                            <p className="text-sm text-muted-foreground text-right">הוסף, ערוך ומחק משתמשים במערכת</p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {usersLoading ? (
                          <div className="flex justify-center py-8">
                            <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {users.length === 0 ? (
                              <div className="text-center py-8 text-muted-foreground">
                                אין משתמשים במערכת
                              </div>
                            ) : (
                              users.map((user) => (
                                <div key={user.id} className={`flex items-center justify-between p-4 border rounded-lg ${
                                  user.id === currentUser?.id ? 'border-primary/50 border-2' : ''
                                }`}>
                                  <div className="flex items-center gap-2">
                                    {user.id !== currentUser?.id && (
                                      <Button 
                                        variant="outline" 
                                        size="icon"
                                        onClick={() => handleUserDelete(user.id!)}
                                        className="text-red-600 hover:text-red-700 h-8 w-8"
                                      >
                                        <IconTrash className="h-4 w-4" />
                                      </Button>
                                    )}
                                    <Button 
                                      variant="outline" 
                                      size="icon"
                                      onClick={() => openEditUserModal(user)}
                                      className="h-8 w-8"
                                    >
                                      <IconEdit className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  <div className="text-right flex-1">
                                    <div className="flex items-center gap-2 justify-end">
                                      <Badge variant={
                                        user.role === 'company_ceo' ? 'default' : 
                                        user.role === 'clinic_manager' ? 'secondary' : 
                                        'outline'
                                      }>
                                        {user.role === 'company_ceo' ? 'מנהל חברה' : 
                                         user.role === 'clinic_manager' ? 'מנהל סניף' : 
                                         'צופה'}
                                      </Badge>
                                      <h3 className="font-medium">{user.username}</h3>
                                    </div>
                                    <div className="text-sm text-muted-foreground mt-1">
                                      {user.email && <span>אימייל: {user.email}</span>}
                                      {user.email && user.phone && <span> • </span>}
                                      {user.phone && <span>טלפון: {user.phone}</span>}
                                      {!user.email && !user.phone && <span>אין פרטי יצירת קשר</span>}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {user.password ? 'מוגן בסיסמה' : 'ללא סיסמה'}
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </div>

                <div className="flex-shrink-0">
                  <TabsList className="flex flex-col h-fit w-48 p-1">
                    <TabsTrigger value="company-profile" className="w-full justify-end text-right">פרופיל החברה</TabsTrigger>
                    <TabsTrigger value="personal-profile" className="w-full justify-end text-right">פרופיל אישי</TabsTrigger>
                    {currentUser?.role === 'company_ceo' && (
                      <TabsTrigger value="users" className="w-full justify-end text-right">ניהול משתמשים</TabsTrigger>
                    )}
                  </TabsList>
                </div>
              </div>
            </Tabs>
          </div>
        </div>
      </div>

      <UserModal
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
        editingUser={editingUser}
        currentUser={currentUser}
        onUserSaved={(newUser) => {
          setUsers(prev => [...prev, newUser])
        }}
        onUserUpdated={(updatedUser) => {
          setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u))
        }}
      />
    </>
  )
} 