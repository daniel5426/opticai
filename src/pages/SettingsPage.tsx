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
import { Settings, User, Clinic } from "@/lib/db/schema-interface"
import { getSettings, updateSettings } from "@/lib/db/settings-db"
import { getAllUsers, getUsersByClinic, createUser, updateUser, deleteUser } from "@/lib/db/users-db"
import { applyThemeColorsFromSettings } from "@/helpers/theme_helpers"
import { CustomModal } from "@/components/ui/custom-modal"
import { Badge } from "@/components/ui/badge"
import { IconPlus, IconEdit, IconTrash, IconLayoutGrid, IconBrandGoogle, IconCalendar, IconX } from "@tabler/icons-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { DateRange } from "react-day-picker"
import { useSettings } from "@/hooks/useSettings"
import { useUser } from "@/contexts/UserContext"
import { getUserById } from "@/lib/db/users-db"
import { getEmailProviderConfig } from "@/lib/email/email-providers"
import { LookupTableManager } from "@/components/LookupTableManager"
import { lookupTables } from "@/lib/db/lookup-db"
import { UserModal } from "@/components/UserModal"
import { apiClient } from "@/lib/api-client"
import { supabase } from "@/lib/supabaseClient"
import { ImageInput } from "@/components/ui/image-input"

export default function SettingsPage() {
  const { settings, updateSettings: updateBaseSettings } = useSettings()
  const { currentUser, currentClinic, setCurrentUser } = useUser()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [colorUpdateTimeout, setColorUpdateTimeout] = useState<NodeJS.Timeout | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  
  // User management state
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  
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

  const [localClinic, setLocalClinic] = useState<Partial<Clinic>>({})

  // Personal profile state
  const [personalProfile, setPersonalProfile] = useState<Partial<User>>({
    full_name: '',
    email: '',
    phone: '',
    profile_picture: '',
    primary_theme_color: '#2256aa',
    secondary_theme_color: '#cce9ff',
    theme_preference: 'system',//8b5cf6, 3b82f6
    system_vacation_dates: [],
    added_vacation_dates: []
  })
  const [profileColorUpdateTimeout, setProfileColorUpdateTimeout] = useState<NodeJS.Timeout | null>(null)
  const [openSystemVacation, setOpenSystemVacation] = useState(false)
  const [openAddedVacation, setOpenAddedVacation] = useState(false)
  const [systemVacationRange, setSystemVacationRange] = useState<DateRange | undefined>(undefined)
  const [addedVacationRange, setAddedVacationRange] = useState<DateRange | undefined>(undefined)

  // Google Calendar state
  const [googleCalendarLoading, setGoogleCalendarLoading] = useState(false)
  const [googleCalendarSyncing, setGoogleCalendarSyncing] = useState(false)

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
    const loadClinic = async () => {
      try {
        if (currentClinic?.id) {
          const resp = await apiClient.getClinic(currentClinic.id)
          if (resp.data) setLocalClinic(resp.data as Clinic)
        }
      } catch (e) {
        console.error('Error loading clinic:', e)
      }
    }

    const loadUsers = async () => {
      try {
        setUsersLoading(true)
        if (currentClinic?.id) {
          // Other users can only see users in their clinic
          const usersData = await getUsersByClinic(currentClinic.id)
          setUsers(usersData)
        } else {
          setUsers([])
        }
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
          full_name: currentUser.full_name || '',
          email: currentUser.email || '',
          phone: currentUser.phone || '',
          profile_picture: currentUser.profile_picture || '',
          primary_theme_color: currentUser.primary_theme_color || '#2256aa',
          secondary_theme_color: currentUser.secondary_theme_color || '#cce9ff',
          theme_preference: currentUser.theme_preference || 'system',
          system_vacation_dates: currentUser.system_vacation_dates || [],
          added_vacation_dates: currentUser.added_vacation_dates || []
        })
      }
    }

    loadSettings()
    loadClinic()
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

  const handleClinicChange = (field: keyof Clinic, value: any) => {
    const updated = { ...localClinic, [field]: value }
    console.log(updated)
    setLocalClinic(updated)
  }

  const handlePersonalProfileChange = (field: keyof User, value: string) => {
    const newProfile = { ...personalProfile, [field]: value }
    setPersonalProfile(newProfile)
    if (field === 'email' && emailError) {
      setEmailError(null)
    }
    
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

  const formatDate = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const enumerateDates = (from: Date, to: Date) => {
    const start = new Date(from.getFullYear(), from.getMonth(), from.getDate())
    const end = new Date(to.getFullYear(), to.getMonth(), to.getDate())
    const list: string[] = []
    let cur = start
    while (cur <= end) {
      list.push(formatDate(cur))
      cur = new Date(cur)
      cur.setDate(cur.getDate() + 1)
    }
    return list
  }

  const addVacationRange = (type: 'system' | 'added', range: DateRange | undefined) => {
    if (!range?.from || !range?.to) return
    const dates = enumerateDates(range.from, range.to)
    if (type === 'system') {
      const existing = new Set(personalProfile.system_vacation_dates || [])
      dates.forEach(d => existing.add(d))
      setPersonalProfile(prev => ({ ...prev, system_vacation_dates: Array.from(existing).sort() }))
      setSystemVacationRange(undefined)
      setOpenSystemVacation(false)
    } else {
      const existing = new Set(personalProfile.added_vacation_dates || [])
      dates.forEach(d => existing.add(d))
      setPersonalProfile(prev => ({ ...prev, added_vacation_dates: Array.from(existing).sort() }))
      setAddedVacationRange(undefined)
      setOpenAddedVacation(false)
    }
  }

  const compressDatesToRanges = (dates: string[]) => {
    const sorted = [...dates].sort()
    const ranges: { from: string; to: string }[] = []
    for (let i = 0; i < sorted.length; i++) {
      const start = sorted[i]
      let end = start
      while (i + 1 < sorted.length) {
        const cur = new Date(sorted[i])
        const next = new Date(sorted[i + 1])
        cur.setDate(cur.getDate() + 1)
        if (formatDate(cur) === formatDate(next)) {
          i++
          end = sorted[i]
        } else {
          break
        }
      }
      ranges.push({ from: start, to: end })
    }
    return ranges
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setSaveSuccess(false)
      setEmailError(null)

      // Unified save API call
      const payload: any = {
        clinic_id: currentClinic?.id,
        settings_id: localSettings.id,
      }
      // Map clinic fields to backend ClinicUpdate names
      if (currentClinic?.id) {
        payload.clinic = {
          clinic_position: localClinic.clinic_position || undefined,
          email: localClinic.email || undefined,
          phone_number: localClinic.phone_number || undefined,
          clinic_name: localClinic.clinic_name || undefined,
          clinic_address: localClinic.clinic_address || undefined,
          clinic_city: localClinic.clinic_city || undefined,
          clinic_postal_code: localClinic.clinic_postal_code || undefined,
          clinic_directions: localClinic.clinic_directions || undefined,
          clinic_website: localClinic.clinic_website || undefined,
          manager_name: localClinic.manager_name || undefined,
          license_number: localClinic.license_number || undefined,
        }
      }
      payload.settings = {
        ...localSettings,
        clinic_id: localSettings.clinic_id || currentClinic?.id,
      }
      if (currentUser?.id) {
        payload.user_id = currentUser.id
        payload.user = {
          full_name: personalProfile.full_name || currentUser.full_name,
          email: personalProfile.email,
          phone: personalProfile.phone,
          profile_picture: personalProfile.profile_picture,
          primary_theme_color: personalProfile.primary_theme_color,
          secondary_theme_color: personalProfile.secondary_theme_color,
          theme_preference: personalProfile.theme_preference,
          system_vacation_dates: personalProfile.system_vacation_dates,
          added_vacation_dates: personalProfile.added_vacation_dates,
        }
      }

      const unifiedResp = await apiClient.saveAll(payload)
      if (unifiedResp.error) {
        if (String(unifiedResp.error).includes('EMAIL_ALREADY_REGISTERED')) {
          setEmailError('האימייל הזה כבר נמצא בשימוש')
          toast.error('האימייל הזה כבר נמצא בשימוש במערכת')
          return
        }
        toast.error('שגיאה בשמירת ההגדרות')
        return
      }
      const data = unifiedResp.data as any
      if (data?.clinic) setLocalClinic(data.clinic as Clinic)
      if (data?.settings) {
        setLocalSettings(data.settings as Settings)
        updateBaseSettings(data.settings as Settings)
      }
      if (data?.user) {
        const updatedUser = data.user as User
        setPersonalProfile({
          full_name: updatedUser.full_name || '',
          email: updatedUser.email || '',
          phone: updatedUser.phone || '',
          profile_picture: updatedUser.profile_picture || '',
          primary_theme_color: updatedUser.primary_theme_color || '#2256aa',
          secondary_theme_color: updatedUser.secondary_theme_color || '#cce9ff',
          theme_preference: updatedUser.theme_preference || 'system',
          system_vacation_dates: updatedUser.system_vacation_dates || [],
          added_vacation_dates: updatedUser.added_vacation_dates || []
        })
        const emailChanged = (currentUser?.email || '').trim() !== (updatedUser.email || '').trim()
        await setCurrentUser(updatedUser)
        // Reflect changes immediately in users list (if present)
        setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u))
        if (emailChanged) {
          try {
            const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
            if (refreshError) {
              console.warn('Supabase refreshSession failed after email change:', refreshError)
              toast.warning('האימייל עודכן. אם יש בעיות גישה, נא להתחבר מחדש')
            } else if (refreshed?.session?.access_token) {
              // Token auto-used by apiClient on next requests
              toast.success('האימייל עודכן בהצלחה והחיבור נשמר')
            }
          } catch (e) {
            console.error('Error refreshing session after email change:', e)
            toast.warning('האימייל עודכן. אם יש בעיות גישה, נא להתחבר מחדש')
          }
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



  // Image upload handled via ImageInput component

  // User management handlers
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

  // Google Calendar handlers
  const handleConnectGoogleAccount = async () => {
    if (!currentUser?.id) return

    try {
      setGoogleCalendarLoading(true)
      toast.info('מתחבר לחשבון Google...')
      
      // Use real Google OAuth flow
      const result = await window.electronAPI.googleOAuthAuthenticate()
      
      if (result.success === false) {
        toast.error(`שגיאה בחיבור לחשבון Google: ${result.error}`)
        return
      }
      
      if (result.tokens && result.userInfo) {
        // Update user with Google account info
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
      
      // Update user to remove Google account info
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
      
      // Prepare Google tokens
      const tokens = {
        access_token: currentUser.google_access_token,
        refresh_token: currentUser.google_refresh_token,
        scope: 'https://www.googleapis.com/auth/calendar',
        token_type: 'Bearer',
        expiry_date: Date.now() + 3600000 // 1 hour from now
      }
      
      // Get user's appointments from database
      const appointmentsResponse = await apiClient.getAppointmentsByUser(currentUser.id)
      const appointments = appointmentsResponse.data || []
      
      // Prepare appointments with client data for sync
      const appointmentsWithClients = await Promise.all(
        appointments.map(async (appointment: any) => {
          const clientResponse = await apiClient.getClientById(appointment.client_id)
          const client = clientResponse.data
          return { appointment, client }
        })
      )
      
      // Sync appointments to Google Calendar
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
      <div className="h-[calc(100vh-4rem)] flex flex-col" dir="rtl">
        {/* Fixed Header */}
        <div className="flex-shrink-0 bg-transparent pt-5 pb-2">
          <div className="max-w-4xl mx-auto flex justify-between items-start">
            <div className="text-right space-y-2">
              <h1 className="text-2xl font-bold">הגדרות המרפאה</h1>
              <p className="text-muted-foreground">נהל את פרטי המרפאה והגדרות המערכת</p>
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

        {/* Main Content with Tabs */}
        <div className="flex-1 overflow-hidden">
          <div className="max-w-[950px] mx-auto h-full">
            <Tabs defaultValue="personal-profile" className="h-full flex" orientation="vertical">
              <div className="flex h-full gap-6 p-6">
                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto pr-2 pb-8" style={{scrollbarWidth: 'none'}}>
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
                          <Label htmlFor="clinic_name" className="text-right block text-sm">שם המרפאה למסמכים</Label>
                          <Input
                            id="clinic_name"
                            value={localClinic.clinic_name || ''}
                            onChange={(e) => handleClinicChange('clinic_name', e.target.value)}
                              placeholder="הזן שם המרפאה"
                              className="text-right  h-9"
                              dir="rtl"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="manager_name" className="text-right block text-sm">שם המנהל</Label>
                          <Input
                            id="manager_name"
                            value={localClinic.manager_name || ''}
                            onChange={(e) => handleClinicChange('manager_name', e.target.value)}
                              placeholder="הזן שם המנהל"
                              className="text-right  h-9"
                              dir="rtl"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="clinic_website" className="text-right block text-sm">אתר אינטרנט</Label>
                          <Input
                            id="clinic_website"
                            value={localClinic.clinic_website || ''}
                            onChange={(e) => handleClinicChange('clinic_website', e.target.value)}
                              placeholder="https://www.clinic.com"
                              className="text-right  h-9"
                              dir="rtl"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="clinic_position" className="text-right block text-sm">מיקום נוסף</Label>
                          <Input
                            id="clinic_position"
                            value={localClinic.clinic_position || ''}
                            onChange={(e) => handleClinicChange('clinic_position', e.target.value)}
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
                                  value={localClinic.email || ''}
                                  onChange={(e) => handleClinicChange('email', e.target.value)}
                                  placeholder="clinic@example.com"
                                  className="text-right  h-9"
                                  dir="rtl"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="clinic_phone" className="text-right block text-sm">טלפון</Label>
                                <Input
                                  id="clinic_phone"
                                  value={localClinic.phone_number || ''}
                                  onChange={(e) => handleClinicChange('phone_number', e.target.value)}
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
                                  value={localClinic.clinic_address || ''}
                                  onChange={(e) => handleClinicChange('clinic_address', e.target.value)}
                                  placeholder="רחוב הרצל 123"
                                  className="text-right  h-9"
                                  dir="rtl"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="clinic_city" className="text-right block text-sm">עיר</Label>
                                <Input
                                  id="clinic_city"
                                  value={localClinic.clinic_city || ''}
                                  onChange={(e) => handleClinicChange('clinic_city', e.target.value)}
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
                                  value={localClinic.clinic_postal_code || ''}
                                  onChange={(e) => handleClinicChange('clinic_postal_code', e.target.value)}
                                  placeholder="12345"
                                  className="text-right  h-9"
                                  dir="rtl"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="clinic_directions" className="text-right block text-sm">הוראות הגעה</Label>
                                <Input
                                  id="clinic_directions"
                                  value={localClinic.clinic_directions || ''}
                                  onChange={(e) => handleClinicChange('clinic_directions', e.target.value)}
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

                  {/* Removed customization tab */}

                  <TabsContent value="preferences" className="space-y-6 mt-0">
                    {/* Layout Management moved here */}
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
                                        user.role === 'company_ceo' ? 'default' : 
                                        user.role === 'clinic_manager' ? 'secondary' : 
                                        user.role === 'clinic_worker' ? 'outline' :
                                        'outline'
                                      }>
                                        {user.role === 'company_ceo' ? 'מנכ"ל החברה' : 
                                         user.role === 'clinic_manager' ? 'מנהל מרפאה' : 
                                         user.role === 'clinic_worker' ? 'עובד מרפאה' : 
                                         'צופה מרפאה'}
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
                            <ImageInput
                              value={personalProfile.profile_picture || ''}
                              onChange={(val) => handlePersonalProfileChange('profile_picture', val)}
                              onRemove={() => setPersonalProfile(prev => ({ ...prev, profile_picture: '' }))}
                              size={96}
                              shape="circle"
                              alt="תמונת פרופיל"
                            />
                            <div className="text-center">
                              <Label className="text-sm font-medium">תמונת פרופיל</Label>
                            </div>
                          </div>
                          
                          {/* Personal Info - Right Side */}
                          <div className="flex-1 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="personal_full_name" className="text-right block text-sm">שם מלא</Label>
                                <Input
                                  id="personal_full_name"
                                  value={personalProfile.full_name || ''}
                                  onChange={(e) => handlePersonalProfileChange('full_name', e.target.value)}
                                  placeholder="הזן שם מלא"
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
                                  className={`text-right h-9 ${emailError ? 'border-red-500' : ''}`}
                                  dir="rtl"
                                />
                                {emailError && (
                                  <div className="text-xs text-red-600 text-right">{emailError}</div>
                                )}
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

                  {/* Vacation Card */}
                  <Card className="shadow-md border-none">
                    <CardHeader>
                      <CardTitle className="text-right">חופשות</CardTitle>
                      <p className="text-sm text-muted-foreground text-right">ניהול ימי חופשה</p>
                    </CardHeader>
                    <CardContent>
                      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-6" dir="rtl">
                        <div className="hidden md:block absolute inset-y-2 left-1/2 w-px bg-border" />
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col gap-1">
                              <Label className="text-right">חופשה מערכתית</Label>
                              <p className="text-xs text-muted-foreground text-right">ימי חופשה מוגדרים על ידי המערכת</p>
                            </div>
                            <Popover open={openSystemVacation} onOpenChange={setOpenSystemVacation}>
                              <PopoverTrigger asChild>
                                <Button size="icon" variant="outline">
                                  <IconPlus className="h-4 w-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="end">
                                <div className="p-2">
                                  <Calendar
                                    mode="range"
                                    selected={systemVacationRange}
                                    onSelect={(r) => setSystemVacationRange(r)}
                                    numberOfMonths={2}
                                    captionLayout="dropdown"
                                  />
                                  <div className="flex justify-end gap-2 p-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setSystemVacationRange(undefined)
                                      }}
                                    >
                                      נקה
                                    </Button>
                                    <Button
                                      size="sm"
                                      disabled={!systemVacationRange?.from || !systemVacationRange?.to}
                                      onClick={() => addVacationRange('system', systemVacationRange)}
                                    >
                                      הוסף
                                    </Button>
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="flex flex-wrap gap-2" style={{scrollbarWidth: 'none'}}>
                            {compressDatesToRanges(personalProfile.system_vacation_dates || []).map((rg, idx) => (
                              <span key={idx} className="relative group/range">
                                <Badge variant="secondary" className="px-2 py-1">
                                  {rg.from === rg.to ? rg.from : `${rg.from} — ${rg.to}`}
                                </Badge>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="absolute -top-1 -right-1 size-4 hidden group-hover/range:flex bg-red-400"
                                  onClick={() => {
                                    const dates = enumerateDates(new Date(rg.from), new Date(rg.to))
                                    const setDates = new Set(personalProfile.system_vacation_dates || [])
                                    dates.forEach(d => setDates.delete(d))
                                    setPersonalProfile(prev => ({ ...prev, system_vacation_dates: Array.from(setDates).sort() }))
                                  }}
                                  title="מחק טווח"
                                >
                                  <IconX className="h-2.5 w-2.5" />
                                </Button>
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col gap-1">
                              <Label className="text-right">חופשה נוספת</Label>
                              <p className="text-xs text-muted-foreground text-right">ימי חופשה שנוספו</p>
                            </div>
                            <Popover open={openAddedVacation} onOpenChange={setOpenAddedVacation}>
                              <PopoverTrigger asChild>
                                <Button size="icon" variant="outline">
                                  <IconPlus className="h-4 w-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="end">
                                <div className="p-2">
                                  <Calendar
                                    mode="range"
                                    selected={addedVacationRange}
                                    onSelect={(r) => setAddedVacationRange(r)}
                                    numberOfMonths={2}
                                    captionLayout="dropdown"
                                  />
                                  <div className="flex justify-end gap-2 p-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setAddedVacationRange(undefined)
                                      }}
                                    >
                                      נקה
                                    </Button>
                                    <Button
                                      size="sm"
                                      disabled={!addedVacationRange?.from || !addedVacationRange?.to}
                                      onClick={() => addVacationRange('added', addedVacationRange)}
                                    >
                                      הוסף
                                    </Button>
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="flex flex-wrap gap-2" style={{scrollbarWidth: 'none'}}>
                            {compressDatesToRanges(personalProfile.added_vacation_dates || []).map((rg, idx) => (
                              <span key={idx} className="relative group">
                                <Badge variant="secondary" className="px-2 py-1">
                                  {rg.from === rg.to ? rg.from : `${rg.from} — ${rg.to}`}
                                </Badge>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="absolute -top-1 -right-1 size-4 hidden group-hover:flex bg-red-400"
                                  onClick={() => {
                                    const dates = enumerateDates(new Date(rg.from), new Date(rg.to))
                                    const setDates = new Set(personalProfile.added_vacation_dates || [])
                                    dates.forEach(d => setDates.delete(d))
                                    setPersonalProfile(prev => ({ ...prev, added_vacation_dates: Array.from(setDates).sort() }))
                                  }}
                                  title="מחק טווח"
                                >
                                  <IconX className="h-1 w-1" />
                                </Button>
                              </span>
                            ))}
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
                                value={personalProfile.primary_theme_color}
                                onChange={(e) => handlePersonalProfileChange('primary_theme_color', e.target.value)}
                                className="w-16 h-12 p-1 rounded shadow-sm"
                              />
                              <div className="flex-1">
                                <Input
                                  value={personalProfile.primary_theme_color}
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
                                value={personalProfile.secondary_theme_color}
                                onChange={(e) => handlePersonalProfileChange('secondary_theme_color', e.target.value)}
                                className="w-16 h-12 p-1 rounded shadow-sm"
                              />
                              <div className="flex-1">
                                <Input
                                  value={personalProfile.secondary_theme_color}
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

                    {/* Google Calendar Integration */}
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
                            {/* Connected State */}
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
                            
                            {/* Sync Information */}
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
                            {/* Disconnected State */}
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
                            
                            {/* Benefits Information */}
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
                </div>

                {/* Fixed Vertical TabsList on the Right */}
                <div className="flex-shrink-0">
                  <TabsList className="flex flex-col h-fit w-48 p-1">
                    <TabsTrigger value="profile" className="w-full justify-end text-right">פרופיל המרפאה</TabsTrigger>
                    <TabsTrigger value="preferences" className="w-full justify-end text-right">הגדרות המרפאה</TabsTrigger>
                    <TabsTrigger value="notifications" className="w-full justify-end text-right">התראות</TabsTrigger>
                    <TabsTrigger value="email" className="w-full justify-end text-right">הגדרות אימייל</TabsTrigger>
                    <TabsTrigger value="personal-profile" className="w-full justify-end text-right">פרופיל אישי</TabsTrigger>
                    {currentUser?.role === 'company_ceo' && (
                      <TabsTrigger value="users" className="w-full justify-end text-right">ניהול משתמשים</TabsTrigger>
                    )}
                    <TabsTrigger value="field-data" className="w-full justify-end text-right">ניהול נתוני שדות</TabsTrigger>
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
        defaultClinicId={currentClinic?.id}
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