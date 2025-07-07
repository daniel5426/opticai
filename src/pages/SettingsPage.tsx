import React, { useState, useEffect } from "react"
import { Link } from "@tanstack/react-router"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { Settings, User } from "@/lib/db/schema"
import { getSettings, updateSettings } from "@/lib/db/settings-db"
import { getAllUsers, createUser, updateUser, deleteUser } from "@/lib/db/users-db"
import { applyThemeColorsFromSettings } from "@/helpers/theme_helpers"
import { CustomModal } from "@/components/ui/custom-modal"
import { Badge } from "@/components/ui/badge"
import { IconPlus, IconEdit, IconTrash, IconLayoutGrid } from "@tabler/icons-react"
import { useSettings } from "@/hooks/useSettings"
import { useUser } from "@/contexts/UserContext"
import { getUserById } from "@/lib/db/users-db"
import { ServerConnectionSettings } from "@/components/ServerConnectionSettings"
import { getEmailProviderConfig } from "@/lib/email/email-providers"
import { LookupTableManager } from "@/components/LookupTableManager"
import { lookupTables } from "@/lib/db/lookup-db"

export default function SettingsPage() {
  const { settings, updateSettings: updateBaseSettings } = useSettings()
  const { currentUser, setCurrentUser } = useUser()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [colorUpdateTimeout, setColorUpdateTimeout] = useState<NodeJS.Timeout | null>(null)
  
  // User management state
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    phone: '',
    hasPassword: false,
    password: '',
    role: 'worker' as 'admin' | 'worker' | 'viewer'
  })
  
  // Field data management state
  const [currentLookupTable, setCurrentLookupTable] = useState<string | null>(null)
  const [lookupData, setLookupData] = useState<{[key: string]: any[]}>({})
  const [loadingLookup, setLoadingLookup] = useState(false)

  const loadLookupData = async (tableName: string) => {
    const tableKey = tableName as keyof typeof lookupTables
    if (!lookupTables[tableKey]) return
    
    try {
      setLoadingLookup(true)
      const data = await lookupTables[tableKey].getAll()
      setLookupData(prev => ({ ...prev, [tableName]: data }))
    } catch (error) {
      console.error(`Error loading ${tableName} data:`, error)
      toast.error(`שגיאה בטעינת נתוני ${lookupTables[tableKey].displayName}`)
    } finally {
      setLoadingLookup(false)
    }
  }

  const refreshLookupData = () => {
    if (currentLookupTable) {
      loadLookupData(currentLookupTable)
    }
  }

  const selectLookupTable = (tableName: string) => {
    setCurrentLookupTable(tableName)
    if (!lookupData[tableName]) {
      loadLookupData(tableName)
    }
  }

  const [localSettings, setLocalSettings] = useState<Settings>({
    clinic_name: '',
    clinic_position: '',
    clinic_email: '',
    clinic_phone: '',
    clinic_address: '',
    clinic_city: '',
    clinic_postal_code: '',
    clinic_directions: '',
    clinic_website: '',
    manager_name: '',
    license_number: '',
    clinic_logo_path: '',
    work_start_time: '08:00',
    work_end_time: '18:00',
    appointment_duration: 30,
    send_email_before_appointment: false,
    email_days_before: 1,
    email_time: '10:00',
    working_days: '["sunday","monday","tuesday","wednesday","thursday"]',
    break_start_time: '',
    break_end_time: '',
    max_appointments_per_day: 20
  })

  // Personal profile state
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

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true)
        if (settings) {
          setLocalSettings(settings)
        }
      } catch (error) {
        console.error('Error loading settings:', error)
        toast.error('שגיאה בטעינת ההגדרות')
      } finally {
        setLoading(false)
      }
    }

    const loadUsers = async () => {
      try {
        setUsersLoading(true)
        const usersData = await getAllUsers()
        setUsers(usersData)
      } catch (error) {
        console.error('Error loading users:', error)
        toast.error('שגיאה בטעינת המשתמשים')
      } finally {
        setUsersLoading(false)
      }
    }

    const loadPersonalProfile = () => {
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
    }

    loadSettings()
    loadUsers()
    loadPersonalProfile()
    
    return () => {
      if (colorUpdateTimeout) {
        clearTimeout(colorUpdateTimeout)
      }
      if (profileColorUpdateTimeout) {
        clearTimeout(profileColorUpdateTimeout)
      }
    }
  }, [settings, currentUser])

  const handleInputChange = (field: keyof Settings, value: string | number | boolean) => {
    const newSettings = { ...localSettings, [field]: value }
    setLocalSettings(newSettings)
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
        } as Settings)
      }, 150)
      
      setProfileColorUpdateTimeout(timeout)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setSaveSuccess(false)
      
      // Save clinic settings
      const updatedSettings = await updateSettings(localSettings)
      if (!updatedSettings) {
        toast.error('שגיאה בשמירת הגדרות המרפאה')
        return
      }
      
      // Save personal profile if current user exists
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
          
          // Update the current user in context (theme will be applied automatically)
          await setCurrentUser(updatedUser)
        } else {
          toast.error('שגיאה בשמירת הפרופיל האישי')
          return
        }
      }
      
      setLocalSettings(updatedSettings)
      updateBaseSettings(updatedSettings)
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
        handleInputChange('clinic_logo_path', result)
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

  // User management handlers
  const openCreateUserModal = () => {
    setEditingUser(null)
    setUserForm({
      username: '',
      email: '',
      phone: '',
      hasPassword: false,
      password: '',
      role: 'worker'
    })
    setShowUserModal(true)
  }

  const openEditUserModal = (user: User) => {
    if (currentUser?.role !== 'admin' && user.id !== currentUser?.id) {
      toast.error('אין לך הרשאה לערוך משתמש זה')
      return
    }
    
    setEditingUser(user)
    setUserForm({
      username: user.username,
      email: user.email || '',
      phone: user.phone || '',
      hasPassword: !!user.password,
      password: '',
      role: user.role
    })
    setShowUserModal(true)
  }

  const handleUserFormChange = (field: string, value: any) => {
    setUserForm(prev => ({ ...prev, [field]: value }))
  }

  const handleUserSave = async () => {
    try {
      if (!userForm.username.trim()) {
        toast.error('שם המשתמש הוא שדה חובה')
        return
      }

      const userData = {
        username: userForm.username.trim(),
        email: userForm.email.trim() || undefined,
        phone: userForm.phone.trim() || undefined,
        password: userForm.hasPassword ? userForm.password.trim() || undefined : undefined,
        role: userForm.role,
        is_active: true
      }

      if (editingUser) {
        const updatedUser = await updateUser({ ...userData, id: editingUser.id })
        if (updatedUser) {
          setUsers(prev => prev.map(u => u.id === editingUser.id ? updatedUser : u))
          toast.success('המשתמש עודכן בהצלחה')
          setShowUserModal(false)
        } else {
          toast.error('שגיאה בעדכון המשתמש')
        }
      } else {
        const newUser = await createUser(userData)
        if (newUser) {
          setUsers(prev => [...prev, newUser])
          toast.success('המשתמש נוצר בהצלחה')
          setShowUserModal(false)
        } else {
          toast.error('שגיאה ביצירת המשתמש')
        }
      }
    } catch (error) {
      console.error('Error saving user:', error)
      toast.error('שגיאה בשמירת המשתמש')
    }
  }

  const handleUserDelete = async (userId: number) => {
    if (currentUser?.role !== 'admin') {
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

  const handleTestEmailConnection = async () => {
    try {
      toast.info('בודק חיבור אימייל...')
      const result = await window.electronAPI.emailTestConnection()
      if (result) {
        toast.success('חיבור האימייל תקין!')
      } else {
        toast.error('שגיאה בחיבור האימייל. בדוק את ההגדרות.')
      }
    } catch (error) {
      console.error('Error testing email connection:', error)
      toast.error('שגיאה בבדיקת חיבור האימייל')
    }
  }

  if (loading) {
    return (
      <>
        <SiteHeader title="הגדרות" />
        <div className="flex flex-col items-center justify-center h-full" dir="rtl">
          <div className="text-lg">טוען הגדרות...</div>
        </div>
      </>
    )
  }

  return (
    <>
      <SiteHeader title="הגדרות" />
        <div className="" style={{scrollbarWidth: 'none'}} dir="rtl">
          <div className="max-w-4xl mx-auto p-6 pb-20 space-y-6">
            
            {/* Header */}
            <div className="flex justify-between items-start mb-8">
              <div className="text-right space-y-2">
                <h1 className="text-2xl font-bold">הגדרות המרפאה</h1>
                <p className="text-muted-foreground">נהל את פרטי המרפאה והגדרות המערכת</p>
              </div>
                              <div className="flex items-center gap-3">
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

            <Tabs defaultValue="personal-profile" className="w-full" orientation="vertical">
              <div className="flex gap-6">
                {/* Vertical Tabs on the Right */}
                <div className="flex-1">
                  <TabsContent value="profile" className="space-y-6 mt-0">
                    {/* Profile Header with Basic Info */}
                    <Card className="shadow-md border-none">
                      <CardHeader>
                        <CardTitle className="text-right">פרטים בסיסיים</CardTitle>
                        <p className="text-sm text-muted-foreground text-right">מידע כללי על המרפאה והמנהל</p>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="clinic_name" className="text-right block text-sm">שם המרפאה</Label>
                            <Input
                              id="clinic_name"
                              value={localSettings.clinic_name || ''}
                              onChange={(e) => handleInputChange('clinic_name', e.target.value)}
                              placeholder="הזן שם המרפאה"
                              className="text-right  h-9"
                              dir="rtl"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="manager_name" className="text-right block text-sm">שם המנהל</Label>
                            <Input
                              id="manager_name"
                              value={localSettings.manager_name || ''}
                              onChange={(e) => handleInputChange('manager_name', e.target.value)}
                              placeholder="הזן שם המנהל"
                              className="text-right  h-9"
                              dir="rtl"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="clinic_website" className="text-right block text-sm">אתר אינטרנט</Label>
                            <Input
                              id="clinic_website"
                              value={localSettings.clinic_website || ''}
                              onChange={(e) => handleInputChange('clinic_website', e.target.value)}
                              placeholder="https://www.clinic.com"
                              className="text-right  h-9"
                              dir="rtl"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="clinic_position" className="text-right block text-sm">מיקום נוסף</Label>
                            <Input
                              id="clinic_position"
                              value={localSettings.clinic_position || ''}
                              onChange={(e) => handleInputChange('clinic_position', e.target.value)}
                              placeholder="קומה, חדר וכו'"
                              className="text-right  h-9"
                              dir="rtl"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Contact Information & Address */}
                    <Card className="shadow-md border-none">
                      <CardHeader>
                        <CardTitle className="text-right">פרטי קשר וכתובת</CardTitle>
                        <p className="text-sm text-muted-foreground text-right">דרכי יצירת קשר ומיקום המרפאה</p>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          {/* Contact Info - First Column */}
                          <div className="space-y-4">
                            <h3 className="text-sm font-medium text-right text-muted-foreground">פרטי קשר</h3>
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <Label htmlFor="clinic_email" className="text-right block text-sm">אימייל</Label>
                                <Input
                                  id="clinic_email"
                                  type="email"
                                  value={localSettings.clinic_email || ''}
                                  onChange={(e) => handleInputChange('clinic_email', e.target.value)}
                                  placeholder="clinic@example.com"
                                  className="text-right  h-9"
                                  dir="rtl"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="clinic_phone" className="text-right block text-sm">טלפון</Label>
                                <Input
                                  id="clinic_phone"
                                  value={localSettings.clinic_phone || ''}
                                  onChange={(e) => handleInputChange('clinic_phone', e.target.value)}
                                  placeholder="050-1234567"
                                  className="text-right  h-9"
                                  dir="rtl"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Address - Second Column */}
                          <div className="space-y-4">
                            <h3 className="text-sm font-medium text-right text-muted-foreground">כתובת</h3>
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <Label htmlFor="clinic_address" className="text-right block text-sm">רחוב ומספר</Label>
                                <Input
                                  id="clinic_address"
                                  value={localSettings.clinic_address || ''}
                                  onChange={(e) => handleInputChange('clinic_address', e.target.value)}
                                  placeholder="רחוב הרצל 123"
                                  className="text-right  h-9"
                                  dir="rtl"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="clinic_city" className="text-right block text-sm">עיר</Label>
                                <Input
                                  id="clinic_city"
                                  value={localSettings.clinic_city || ''}
                                  onChange={(e) => handleInputChange('clinic_city', e.target.value)}
                                  placeholder="תל אביב"
                                  className="text-right  h-9"
                                  dir="rtl"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Additional Info - Third Column */}
                          <div className="space-y-4">
                            <h3 className="text-sm font-medium text-right text-muted-foreground">נוסף</h3>
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <Label htmlFor="clinic_postal_code" className="text-right block text-sm">מיקוד</Label>
                                <Input
                                  id="clinic_postal_code"
                                  value={localSettings.clinic_postal_code || ''}
                                  onChange={(e) => handleInputChange('clinic_postal_code', e.target.value)}
                                  placeholder="12345"
                                  className="text-right  h-9"
                                  dir="rtl"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="clinic_directions" className="text-right block text-sm">הוראות הגעה</Label>
                                <Input
                                  id="clinic_directions"
                                  value={localSettings.clinic_directions || ''}
                                  onChange={(e) => handleInputChange('clinic_directions', e.target.value)}
                                  placeholder="ליד הפארק, קומה 2"
                                  className="text-right  h-9"
                                  dir="rtl"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="customization" className="space-y-6 mt-0">
                    {/* Layout Management */}
                    <Card className="shadow-md border-none">
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <Link to="/exam-layouts">
                            <Button variant="outline" className="flex items-center gap-2">
                              <IconLayoutGrid className="h-4 w-4" />
                              נהל פריסות בדיקה
                            </Button>
                          </Link>
                          <div className="text-right">
                            <h3 className="font-medium">פריסות בדיקה</h3>
                            <p className="text-sm text-muted-foreground">יצירה ועריכה של פריסות בדיקה מותאמות אישית</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Branding & Appearance */}
                    <Card className="shadow-md border-none">
                      <CardHeader>
                        <CardTitle className="text-right">מיתוג</CardTitle>
                        <p className="text-sm text-muted-foreground text-right">לוגו המרפאה</p>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-col items-center space-y-3">
                          <div className="relative">
                            {localSettings.clinic_logo_path ? (
                              <img 
                                src={localSettings.clinic_logo_path} 
                                alt="לוגו המרפאה" 
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
                            <Label className="text-sm font-medium">לוגו המרפאה</Label>
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

                  <TabsContent value="preferences" className="space-y-6 mt-0">
                    {/* Work Hours */}
                    <Card className="shadow-md border-none">
                      <CardHeader>
                        <CardTitle className="text-right">שעות עבודה</CardTitle>
                        <p className="text-sm text-muted-foreground text-right">הגדר שעות פעילות והפסקות</p>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="work_start_time" className="text-right block">התחלה</Label>
                            <Input
                              id="work_start_time"
                              type="time"
                              value={localSettings.work_start_time || '08:00'}
                              onChange={(e) => handleInputChange('work_start_time', e.target.value)}
                              className="text-center "
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="work_end_time" className="text-right block">סיום</Label>
                            <Input
                              id="work_end_time"
                              type="time"
                              value={localSettings.work_end_time || '18:00'}
                              onChange={(e) => handleInputChange('work_end_time', e.target.value)}
                              className="text-center "
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="break_start_time" className="text-right block">הפסקה מ</Label>
                            <Input
                              id="break_start_time"
                              type="time"
                              value={localSettings.break_start_time || ''}
                              onChange={(e) => handleInputChange('break_start_time', e.target.value)}
                              className="text-center "
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="break_end_time" className="text-right block">הפסקה עד</Label>
                            <Input
                              id="break_end_time"
                              type="time"
                              value={localSettings.break_end_time || ''}
                              onChange={(e) => handleInputChange('break_end_time', e.target.value)}
                              className="text-center "
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Appointments */}
                    <Card className="shadow-md border-none">
                      <CardHeader>
                        <CardTitle className="text-right">תורים</CardTitle>
                        <p className="text-sm text-muted-foreground text-right">הגדרות זמנים ומגבלות תורים</p>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2" dir="rtl">
                            <Label htmlFor="appointment_duration" className="text-right block">משך תור (דקות)</Label>
                            <Select dir="rtl"
                              value={String(localSettings.appointment_duration || 30)}
                              onValueChange={(value) => handleInputChange('appointment_duration', Number(value))}
                            >
                              <SelectTrigger className="text-right " dir="rtl">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="15">15 דקות</SelectItem>
                                <SelectItem value="30">30 דקות</SelectItem>
                                <SelectItem value="45">45 דקות</SelectItem>
                                <SelectItem value="60">60 דקות</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="max_appointments" className="text-right block">מקסימום תורים ליום</Label>
                            <Input
                              id="max_appointments"
                              type="number"
                              value={localSettings.max_appointments_per_day || 20}
                              onChange={(e) => handleInputChange('max_appointments_per_day', Number(e.target.value))}
                              min="1"
                              max="50"
                              className="text-right "
                              dir="rtl"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="notifications" className="space-y-6 mt-0">
                    {/* Email Notifications */}
                    <Card className="shadow-md border-none">
                      <CardHeader>
                        <CardTitle className="text-right">התראות אימייל</CardTitle>
                        <p className="text-sm text-muted-foreground text-right">הגדרות שליחת הזכרות ללקוחות</p>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-3 rounded-lg shadow-sm bg-muted/20">
                          <Switch
                            id="send_email_reminder"
                            checked={localSettings.send_email_before_appointment || false}
                            onCheckedChange={(checked) => handleInputChange('send_email_before_appointment', checked)}
                          />
                          <div className="text-right">
                            <Label htmlFor="send_email_reminder" dir="rtl" className="font-medium text-right">הזכרות באימייל</Label>
                            <p className="text-sm text-muted-foreground">שלח הזכרה ללקוחות לפני התור</p>
                          </div>
                        </div>
                        
                        {localSettings.send_email_before_appointment ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg shadow-sm">
                              <div className="space-y-2">
                                <Label htmlFor="email_days_before" className="text-right block">כמה ימים מראש</Label>
                                <Select
                                  value={String(localSettings.email_days_before || 1)}
                                  onValueChange={(value) => handleInputChange('email_days_before', Number(value))}
                                >
                                  <SelectTrigger className="text-right " dir="rtl">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="1">יום אחד</SelectItem>
                                    <SelectItem value="2">יומיים</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="email_time" className="text-right block">שעת שליחה</Label>
                                <Input
                                  id="email_time"
                                  type="time"
                                  value={localSettings.email_time || '10:00'}
                                  onChange={(e) => handleInputChange('email_time', e.target.value)}
                                  className="text-center "
                                />
                              </div>
                            </div>
                            
                            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2 text-right">הגדרת אימייל</h4>
                              <p className="text-xs text-blue-700 dark:text-blue-300 text-right" dir="rtl">
                                הגדר את פרטי שרת האימייל בלשונית ההגדרות למטה כדי לשלוח תזכורות ללקוחות.
                              </p>
                            </div>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="email" className="space-y-6 mt-0" dir="rtl">
                    {/* Email Configuration */}
                    <Card className="shadow-md border-none">
                      <CardHeader>
                        <CardTitle className="text-right">הגדרות שרת אימייל</CardTitle>
                        <p className="text-sm text-muted-foreground text-right">הגדר את פרטי שרת האימייל לשליחת תזכורות ללקוחות</p>
                      </CardHeader>
                      <CardContent className="space-y-6" dir="rtl">
                        {/* Email Provider Selection */}
                        <div className="space-y-2">
                          <Label htmlFor="email_provider" className="text-sm font-medium text-right block">
                            ספק אימייל
                          </Label>
                          <Select
                            dir="rtl"
                            value={localSettings.email_provider || "gmail"}
                            onValueChange={(value) => {
                              handleInputChange('email_provider', value);
                              if (value !== 'custom') {
                                const provider = getEmailProviderConfig(value);
                                if (provider) {
                                  handleInputChange('email_smtp_host', provider.host);
                                  handleInputChange('email_smtp_port', provider.port);
                                  handleInputChange('email_smtp_secure', provider.secure);
                                }
                              }
                            }}
                          >
                            <SelectTrigger className="text-right h-9" dir="rtl">
                              <SelectValue placeholder="בחר ספק אימייל" />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                              <SelectItem value="gmail">Gmail</SelectItem>
                              <SelectItem value="outlook">Outlook / Hotmail</SelectItem>
                              <SelectItem value="yahoo">Yahoo Mail</SelectItem>
                              <SelectItem value="custom">הגדרה מותאמת אישית</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Authentication Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="email_username" className="text-sm font-medium text-right block">
                              כתובת אימייל
                            </Label>
                            <Input
                              id="email_username"
                              type="email"
                              value={localSettings.email_username || ""}
                              onChange={(e) => handleInputChange('email_username', e.target.value)}
                              className="text-right h-9"
                              placeholder="clinic@example.com"
                              dir="rtl"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="email_password" className="text-sm font-medium text-right block">
                              סיסמה
                            </Label>
                            <Input
                              id="email_password"
                              type="password"
                              value={localSettings.email_password || ""}
                              onChange={(e) => handleInputChange('email_password', e.target.value)}
                              className="text-right h-9"
                              placeholder="••••••••"
                              dir="rtl"
                            />
                          </div>
                        </div>

                        {/* Optional From Name */}
                        <div className="space-y-2">
                          <Label htmlFor="email_from_name" className="text-sm font-medium text-right block">
                            שם השולח (אופציונלי)
                          </Label>
                          <Input
                            id="email_from_name"
                            value={localSettings.email_from_name || ""}
                            onChange={(e) => handleInputChange('email_from_name', e.target.value)}
                            className="text-right h-9"
                            placeholder="מרפאת העיניים שלנו"
                            dir="rtl"
                          />
                        </div>

                        {/* Custom SMTP Settings */}
                        {localSettings.email_provider === 'custom' && (
                          <>
                            <Separator className="my-4" />
                            <div className="space-y-4">
                              <h4 className="text-sm font-medium text-right">הגדרות SMTP מותאמות</h4>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="email_smtp_host" className="text-sm font-medium text-right block">
                                    שרת SMTP
                                  </Label>
                                  <Input
                                    id="email_smtp_host"
                                    value={localSettings.email_smtp_host || ""}
                                    onChange={(e) => handleInputChange('email_smtp_host', e.target.value)}
                                    className="text-right h-9"
                                    placeholder="smtp.example.com"
                                    dir="rtl"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="email_smtp_port" className="text-sm font-medium text-right block">
                                    פורט
                                  </Label>
                                  <Input
                                    id="email_smtp_port"
                                    type="number"
                                    value={localSettings.email_smtp_port || 587}
                                    onChange={(e) => handleInputChange('email_smtp_port', parseInt(e.target.value))}
                                    className="text-center h-9"
                                    dir="ltr"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label className="text-sm font-medium text-right block mb-2">אבטחה</Label>
                                  <div className="flex items-center justify-between rounded-lg h-9 px-3 border bg-background">
                                    <Switch
                                      id="email_smtp_secure"
                                      checked={localSettings.email_smtp_secure || false}
                                      onCheckedChange={(checked) => handleInputChange('email_smtp_secure', checked)}
                                    />
                                    <Label htmlFor="email_smtp_secure" className="text-sm cursor-pointer">
                                      SSL/TLS
                                    </Label>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </>
                        )}

                        {/* Email Provider Instructions */}
                        {localSettings.email_provider && (
                          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2 text-right">
                              הוראות עבור {getEmailProviderConfig(localSettings.email_provider)?.displayName}
                            </h4>
                            <p className="text-xs text-blue-700 dark:text-blue-300 text-right" dir="rtl">
                              {getEmailProviderConfig(localSettings.email_provider)?.instructions}
                            </p>
                          </div>
                        )}

                        {/* Test Email Connection */}
                        <div className="flex justify-start pt-4">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleTestEmailConnection}
                            disabled={!localSettings.email_username || !localSettings.email_password}
                            className="px-6"
                          >
                            בדוק חיבור אימייל
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="users" className="space-y-6 mt-0">
                    {/* Users Management */}
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
                                        user.role === 'admin' ? 'default' : 
                                        user.role === 'worker' ? 'secondary' : 
                                        'outline'
                                      }>
                                        {user.role === 'admin' ? 'מנהל' : 
                                         user.role === 'worker' ? 'עובד' : 
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

                  <TabsContent value="server" className="space-y-6 mt-0">
                    <ServerConnectionSettings />
                  </TabsContent>
                  
                  <TabsContent value="field-data" className="space-y-6 mt-0">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Left side - Table selection */}
                      <Card className="shadow-md border-none h-fit max-h-[900px]">
                        <CardHeader>
                          <CardTitle className="text-right">בחר טבלת נתונים</CardTitle>
                          <p className="text-sm text-muted-foreground text-right">
                            בחר טבלה לעריכה וניהול הנתונים
                          </p>
                        </CardHeader>
                        <CardContent className="overflow-y-auto" style={{scrollbarWidth: 'none'}}>
                          <div className="space-y-1">
                            {Object.entries(lookupTables).map(([key, table]) => (
                              <div
                                key={key}
                                className={`px-3 rounded text-sm cursor-pointer text-right transition-colors ${
                                  currentLookupTable === key 
                                    ? 'bg-primary text-primary-foreground' 
                                    : 'hover:bg-muted/50'
                                }`}
                                onClick={() => selectLookupTable(key)}
                              >
                                {table.displayName}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Right side - Table management */}
                      <div className="lg:col-span-2">
                        {currentLookupTable ? (
                          <LookupTableManager
                            tableName={currentLookupTable}
                            displayName={lookupTables[currentLookupTable as keyof typeof lookupTables].displayName}
                            items={lookupData[currentLookupTable] || []}
                            onRefresh={refreshLookupData}
                            onCreate={lookupTables[currentLookupTable as keyof typeof lookupTables].create}
                            onUpdate={lookupTables[currentLookupTable as keyof typeof lookupTables].update}
                            onDelete={lookupTables[currentLookupTable as keyof typeof lookupTables].delete}
                          />
                        ) : (
                          <Card className="shadow-md border-none">
                            <CardContent className="flex items-center justify-center h-64">
                              <div className="text-center text-muted-foreground">
                                <p className="text-lg mb-2">בחר טבלת נתונים לעריכה</p>
                                <p className="text-sm">בחר טבלה מהרשימה מימין כדי להתחיל לערוך</p>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="personal-profile" className="space-y-6 mt-0">
                    {/* Personal Profile Header */}
                    {/* Profile Picture & Basic Info */}
                    <Card className="shadow-md border-none">
                      <CardHeader>
                        <CardTitle className="text-right">פרטים אישיים</CardTitle>
                        <p className="text-sm text-muted-foreground text-right">תמונת פרופיל ופרטי יצירת קשר</p>
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-8 items-start">
                          {/* Profile Picture - Left Side */}
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
                          
                          {/* Personal Info - Right Side */}
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

                    {/* Personal Theme Colors */}
                    <Card className="shadow-md border-none">
                      <CardHeader>
                        <CardTitle className="text-right">צבעי המערכת האישיים</CardTitle>
                        <p className="text-sm text-muted-foreground text-right">התאם את צבעי המערכת לפי הטעם האישי שלך</p>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-6">
                          {/* Primary Color */}
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
                          
                          {/* Secondary Color */}
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
                  </TabsContent>
                </div>

                {/* Vertical TabsList on the Right */}
                <TabsList className="flex flex-col h-fit w-48 p-1">
                  <TabsTrigger value="profile" className="w-full justify-end text-right">פרופיל המרפאה</TabsTrigger>
                  <TabsTrigger value="customization" className="w-full justify-end text-right">התאמה אישית</TabsTrigger>
                  <TabsTrigger value="preferences" className="w-full justify-end text-right">ניהול זמן</TabsTrigger>
                  <TabsTrigger value="notifications" className="w-full justify-end text-right">התראות</TabsTrigger>
                  <TabsTrigger value="email" className="w-full justify-end text-right">הגדרות אימייל</TabsTrigger>
                  <TabsTrigger value="server" className="w-full justify-end text-right">חיבור לשרת</TabsTrigger>
                  <TabsTrigger value="personal-profile" className="w-full justify-end text-right">פרופיל אישי</TabsTrigger>
                  {currentUser?.role === 'admin' && (
                    <TabsTrigger value="users" className="w-full justify-end text-right">ניהול משתמשים</TabsTrigger>
                  )}
                  <TabsTrigger value="field-data" className="w-full justify-end text-right">ניהול נתוני שדות</TabsTrigger>
                </TabsList>
              </div>
            </Tabs>


          </div>
        </div>

        {/* User Modal */}
        <CustomModal
          isOpen={showUserModal}
          onClose={() => setShowUserModal(false)}
          title={editingUser ? 'ערוך משתמש' : 'הוסף משתמש חדש'}
          className="max-w-lg"
        >
          <div className="space-y-4" dir="rtl">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-right block">שם משתמש *</Label>
                <Input
                  id="username"
                  value={userForm.username}
                  onChange={(e) => handleUserFormChange('username', e.target.value)}
                  placeholder="הזן שם משתמש"
                  className="text-right"
                  dir="rtl"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-right block">אימייל</Label>
                <Input
                  id="email"
                  type="email"
                  value={userForm.email}
                  onChange={(e) => handleUserFormChange('email', e.target.value)}
                  placeholder="example@email.com"
                  className="text-right"
                  dir="rtl"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role" className="text-right block">תפקיד *</Label>
                  {currentUser?.role === 'admin' ? (
                    <Select
                      value={userForm.role}
                      onValueChange={(value) => handleUserFormChange('role', value)}
                      dir="rtl"
                    >
                      <SelectTrigger className="text-right" dir="rtl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">מנהל</SelectItem>
                        <SelectItem value="worker">עובד</SelectItem>
                        <SelectItem value="viewer">צופה</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="px-3 py-2 bg-muted rounded-md text-right">
                      {userForm.role === 'admin' ? 'מנהל' : 
                       userForm.role === 'worker' ? 'עובד' : 'צופה'}
                      <span className="text-xs text-muted-foreground mr-2">(לא ניתן לשינוי)</span>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-right block">טלפון</Label>
                  <Input
                    id="phone"
                    value={userForm.phone}
                    onChange={(e) => handleUserFormChange('phone', e.target.value)}
                    placeholder="050-1234567"
                    className="text-right"
                    dir="rtl"
                  />
                </div>
              </div>
              <div className="space-y-1">
              <Label htmlFor="hasPassword" className="font-medium">הגדר סיסמה</Label>
              <div className="flex items-center justify-between rounded-lg">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">אם לא תוגדר סיסמה, המשתמש יוכל להתחבר ללא סיסמה</p>
                </div>
                <Switch
                  dir="ltr"
                  className=""
                  id="hasPassword"
                  checked={userForm.hasPassword}
                  onCheckedChange={(checked) => handleUserFormChange('hasPassword', checked)}
                />
              </div>
              </div>
              
              {userForm.hasPassword && (
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-right block">סיסמה</Label>
                  <Input
                    id="password"
                    type="password"
                    value={userForm.password}
                    onChange={(e) => handleUserFormChange('password', e.target.value)}
                    placeholder="הזן סיסמה"
                    className="text-right"
                    dir="rtl"
                  />
                </div>
              )}
            </div>
            
            <div className="flex justify-start gap-2 pt-4">
              <Button onClick={handleUserSave}>
                {editingUser ? 'עדכן משתמש' : 'צור משתמש'}
              </Button>
              <Button variant="outline" onClick={() => setShowUserModal(false)}>
                ביטול
              </Button>
            </div>
          </div>
        </CustomModal>
      </>
    )
} 