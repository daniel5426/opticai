import React, { useState, useEffect } from "react"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { Settings, User, Clinic } from "@/lib/db/schema-interface"
import { getUsersByClinic, updateUser, deleteUser } from "@/lib/db/users-db"
import { applyCompanyThemeColors, cacheCompanyThemeColors } from "@/helpers/theme_helpers"
import { lookupTables } from "@/lib/db/lookup-db"
import { UserModal } from "@/components/UserModal"
import { useSettings } from "@/hooks/useSettings"
import { useUser } from "@/contexts/UserContext"
import { apiClient } from "@/lib/api-client"
import { supabase } from "@/lib/supabaseClient"
import { ProfileTab } from "@/components/settings/ProfileTab"
import { PreferencesTab } from "@/components/settings/PreferencesTab"
import { NotificationsTab } from "@/components/settings/NotificationsTab"
import { EmailTab } from "@/components/settings/EmailTab"
import { DateRange } from "react-day-picker"
import { ROLE_LEVELS, isRoleAtLeast } from "@/lib/role-levels"

import { UsersTab } from "@/components/settings/UsersTab"
import { FieldDataTab } from "@/components/settings/FieldDataTab"
import { PersonalProfileTab } from "@/components/settings/PersonalProfileTab"
import { AboutTab } from "@/components/settings/AboutTab"
import { WhatsAppTab } from "@/components/settings/WhatsAppTab"
import { Company } from "@/lib/db/schema-interface"

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
  const [lookupData, setLookupData] = useState<{ [key: string]: any[] }>({})
  const [loadingLookup, setLoadingLookup] = useState(false)
  const [company, setCompany] = useState<Company | null>(null)
  const [localCompany, setLocalCompany] = useState<Partial<Company>>({})

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
    added_vacation_dates: [],
    va_format: 'meter',
    sync_subjective_to_final_subjective: false,
    import_order_to_old_refraction_default: false
  })
  const [profileColorUpdateTimeout, setProfileColorUpdateTimeout] = useState<NodeJS.Timeout | null>(null)

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
          added_vacation_dates: currentUser.added_vacation_dates || [],
          va_format: currentUser.va_format || 'meter',
          sync_subjective_to_final_subjective: currentUser.sync_subjective_to_final_subjective || false,
          import_order_to_old_refraction_default: currentUser.import_order_to_old_refraction_default || false
        })
      }
    }


    const loadCompany = async () => {
      try {
        if (currentUser && isRoleAtLeast(currentUser.role_level, ROLE_LEVELS.manager)) {
          let companyId = currentClinic?.company_id
          if (!companyId) {
            const clinicResp = await apiClient.getClinic(currentClinic?.id || 0)
            companyId = clinicResp.data?.company_id
          }
          if (companyId) {
            const resp = await apiClient.getCompany(companyId)
            if (resp.data) {
              setCompany(resp.data)
              setLocalCompany(resp.data)
            }
          }
        }
      } catch (e) {
        console.error('Error loading company:', e)
      }
    }

    loadSettings()
    loadClinic()
    loadUsers()
    loadPersonalProfile()
    loadCompany()

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
    setLocalClinic(updated)
  }

  const handleCompanyChange = (field: string, value: any) => {
    setLocalCompany(prev => ({ ...prev, [field]: value }))
  }

  const handlePersonalProfileChange = (field: keyof User, value: any) => {
    const newProfile = { ...personalProfile, [field]: value }
    setPersonalProfile(newProfile)
    if (field === 'email' && emailError) {
      setEmailError(null)
    }

    // Note: primary_theme_color is now only used for appointment coloring, not for app theme
    // App theme colors come from company settings
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
        const entryPin = typeof localClinic.entry_pin === 'string' ? localClinic.entry_pin.trim() : ''
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
          entry_pin: entryPin || undefined,
        }
      }
      if (company?.id && isRoleAtLeast(currentUser?.role_level, ROLE_LEVELS.manager)) {
        payload.company_id = company.id
        payload.company = {
          whatsapp_access_token: localCompany.whatsapp_access_token,
          whatsapp_phone_number_id: localCompany.whatsapp_phone_number_id,
          whatsapp_verify_token: localCompany.whatsapp_verify_token,
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
          va_format: personalProfile.va_format,
          sync_subjective_to_final_subjective: personalProfile.sync_subjective_to_final_subjective,
          import_order_to_old_refraction_default: personalProfile.import_order_to_old_refraction_default
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
      if (data?.clinic) setLocalClinic({ ...(data.clinic as Clinic), entry_pin: '' })
      if (data?.settings) {
        setLocalSettings(data.settings as Settings)
        updateBaseSettings(data.settings as Settings)
      }
      if (data?.user) {
        const updatedUser = data.user as User

        const normalizeDates = (v: any): string[] => {
          if (Array.isArray(v)) return v as string[]
          if (typeof v === 'string') {
            try {
              const parsed = JSON.parse(v)
              return Array.isArray(parsed) ? (parsed as string[]) : []
            } catch {
              return []
            }
          }
          return []
        }

        const newProfile = {
          full_name: updatedUser.full_name ?? personalProfile.full_name ?? '',
          email: updatedUser.email ?? personalProfile.email ?? '',
          phone: updatedUser.phone ?? personalProfile.phone ?? '',
          profile_picture: updatedUser.profile_picture ?? personalProfile.profile_picture ?? '',
          primary_theme_color: updatedUser.primary_theme_color ?? personalProfile.primary_theme_color ?? '#2256aa',
          secondary_theme_color: updatedUser.secondary_theme_color ?? personalProfile.secondary_theme_color ?? '#cce9ff',
          theme_preference: updatedUser.theme_preference ?? personalProfile.theme_preference ?? 'system',
          system_vacation_dates: updatedUser.system_vacation_dates !== undefined && updatedUser.system_vacation_dates !== null
            ? normalizeDates(updatedUser.system_vacation_dates)
            : (personalProfile.system_vacation_dates as string[] || []),
          added_vacation_dates: updatedUser.added_vacation_dates !== undefined && updatedUser.added_vacation_dates !== null
            ? normalizeDates(updatedUser.added_vacation_dates)
            : (personalProfile.added_vacation_dates as string[] || []),
          va_format: updatedUser.va_format ?? personalProfile.va_format ?? 'meter',
          sync_subjective_to_final_subjective: updatedUser.sync_subjective_to_final_subjective ?? personalProfile.sync_subjective_to_final_subjective ?? false,
          import_order_to_old_refraction_default: updatedUser.import_order_to_old_refraction_default ?? personalProfile.import_order_to_old_refraction_default ?? false
        }

        setPersonalProfile(newProfile)

        const emailChanged = (currentUser?.email || '').trim() !== (updatedUser.email || '').trim()
        await setCurrentUser(updatedUser, true)
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
    if (!isRoleAtLeast(currentUser?.role_level, ROLE_LEVELS.ceo) && user.id !== currentUser?.id) {
      toast.error('אין לך הרשאה לערוך משתמש זה')
      return
    }

    setEditingUser(user)
    setShowUserModal(true)
  }

  const handleUserDelete = async (userId: number) => {
    if (!isRoleAtLeast(currentUser?.role_level, ROLE_LEVELS.ceo)) {
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
      const result = await window.electronAPI.emailTestConnection(currentClinic?.id)
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
          await setCurrentUser(updatedUser, true) // Skip navigation when just updating Google account
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
        await setCurrentUser(updatedUser, true) // Skip navigation when just updating Google account
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

      const storedTokensResponse = await apiClient.getGoogleTokens(currentUser.id)
      let tokens = {
        access_token: storedTokensResponse.data?.access_token,
        refresh_token: storedTokensResponse.data?.refresh_token,
        scope: 'https://www.googleapis.com/auth/calendar',
        token_type: 'Bearer',
        expiry_date: Date.now() + 3600000 // 1 hour from now
      }

      // If tokens are not in database, try to get them from Supabase session
      if (!tokens.access_token || !tokens.refresh_token) {
        console.log('Google tokens not found in database, trying Supabase session...')
        try {
          const { data: sessionData } = await supabase.auth.getSession()
          if (sessionData?.session) {
            // Try to get provider tokens first (these are the actual Google tokens)
            const providerToken = (sessionData.session as any).provider_token
            const providerRefreshToken = (sessionData.session as any).provider_refresh_token

            if (providerToken && providerRefreshToken) {
              console.log('Using Google provider tokens for calendar sync')
              tokens = {
                access_token: providerToken,
                refresh_token: providerRefreshToken,
                scope: 'https://www.googleapis.com/auth/calendar',
                token_type: 'Bearer',
                expiry_date: sessionData.session.expires_at || Date.now() + 3600000
              }
            } else {
              console.log('No provider tokens found, using Supabase tokens as fallback')
              tokens = {
                access_token: sessionData.session.access_token,
                refresh_token: sessionData.session.refresh_token,
                scope: 'https://www.googleapis.com/auth/calendar',
                token_type: 'Bearer',
                expiry_date: sessionData.session.expires_at || Date.now() + 3600000
              }
            }

            // Also update the user's tokens in the database for future use
            try {
              const updatedUser = await updateUser({
                ...currentUser,
                google_access_token: tokens.access_token,
                google_refresh_token: tokens.refresh_token
              })
              if (updatedUser) {
                console.log('Updated user tokens in database')
                await setCurrentUser(updatedUser, true) // Skip navigation when just updating tokens
              }
            } catch (updateError) {
              console.log('Could not update tokens in database:', updateError)
            }
          } else {
            toast.error('לא נמצאו אסימוני Google - התחבר מחדש')
            return
          }
        } catch (sessionError) {
          console.error('Could not get Supabase session:', sessionError)
          toast.error('שגיאה בקבלת אסימוני Google')
          return
        }
      }

      // Validate token format - Google OAuth tokens should start with 'ya29.' or similar
      const isLikelyGoogleToken = tokens.access_token && (
        tokens.access_token.startsWith('ya29.') ||
        tokens.access_token.startsWith('1/') ||
        !tokens.access_token.includes('.') // JWT tokens contain dots
      )

      console.log('🔍 Calendar Sync Debug - Final Tokens Being Used:', {
        has_access_token: !!tokens.access_token,
        has_refresh_token: !!tokens.refresh_token,
        access_token_preview: tokens.access_token ? tokens.access_token.substring(0, 30) + '...' : 'null',
        token_type: tokens.token_type,
        scope: tokens.scope,
        likely_google_token: isLikelyGoogleToken,
        token_format: tokens.access_token ? (tokens.access_token.includes('.') ? 'JWT-like' : 'OAuth-like') : 'none'
      })

      if (!isLikelyGoogleToken && tokens.access_token) {
        console.log('⚠️ Warning: Token does not appear to be a Google OAuth token - using manual Google OAuth flow')
        toast.info('נדרשת הרשאה ליומן Google - מתחיל תהליך הרשאה...')

        // For calendar access, we need real Google OAuth tokens, not Supabase JWT tokens
        // Redirect to manual Google OAuth flow
        try {
          const result = await window.electronAPI.googleOAuthAuthenticate()

          if (result.success === false) {
            toast.error(`שגיאה בחיבור לחשבון Google: ${result.error}`)
            return
          }

          if (result.tokens && result.userInfo) {
            // Update user with proper Google OAuth tokens
            const updatedUser = await updateUser({
              ...currentUser,
              google_access_token: result.tokens.access_token,
              google_refresh_token: result.tokens.refresh_token
            })

            if (updatedUser) {
              await setCurrentUser(updatedUser, true) // Skip navigation when just updating tokens

              // Use the new proper Google tokens
              tokens = {
                access_token: result.tokens.access_token,
                refresh_token: result.tokens.refresh_token,
                scope: 'https://www.googleapis.com/auth/calendar',
                token_type: 'Bearer',
                expiry_date: result.tokens.expiry_date || Date.now() + 3600000
              }

              console.log('✅ Updated to use proper Google OAuth tokens for calendar access')
              toast.success('הרשאות Google Calendar עודכנו בהצלחה!')
            } else {
              toast.error('שגיאה בעדכון אסימוני Google')
              return
            }
          } else {
            toast.error('לא התקבלו נתוני הרשאה מ-Google')
            return
          }
        } catch (error) {
          console.error('Error with manual Google OAuth:', error)
          toast.error('שגיאה בתהליך הרשאה Google')
          return
        }
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

  const handleToggleGoogleAutoSync = async (enabled: boolean) => {
    if (!currentUser?.id) return
    try {
      setGoogleCalendarLoading(true)
      const updatedUser = await updateUser({
        ...currentUser,
        google_calendar_sync_enabled: enabled
      })
      if (updatedUser) {
        await setCurrentUser(updatedUser, true)
        setPersonalProfile(prev => ({
          ...prev,
          google_calendar_sync_enabled: enabled
        }))
        if (enabled) {
          await handleSyncGoogleCalendar()
        }
        const msg = enabled ? 'סנכרון אוטומטי הופעל' : 'סנכרון אוטומטי כובה'
        // eslint-disable-next-line no-console
        console.log(msg)
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Error toggling Google auto sync:', e)
    } finally {
      setGoogleCalendarLoading(false)
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
        <div className="shrink-0 bg-transparent pt-5 pb-2">
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
                <div className="flex-1 overflow-y-auto pr-2 pb-8" style={{ scrollbarWidth: 'none' }}>
                  <TabsContent value="profile" className="space-y-6 mt-0">
                    <ProfileTab
                      localClinic={localClinic}
                      onClinicChange={handleClinicChange}
                    />
                  </TabsContent>

                  <TabsContent value="preferences" className="space-y-6 mt-0">
                    <PreferencesTab
                      localSettings={localSettings}
                      onInputChange={handleInputChange}
                    />
                  </TabsContent>

                  <TabsContent value="notifications" className="space-y-6 mt-0">
                    <NotificationsTab
                      localSettings={localSettings}
                      onInputChange={handleInputChange}
                    />
                  </TabsContent>

                  <TabsContent value="email" className="space-y-6 mt-0">
                    <EmailTab
                      localSettings={localSettings}
                      onInputChange={handleInputChange}
                      onTestConnection={handleTestEmailConnection}
                    />
                  </TabsContent>

                  <TabsContent value="users" className="space-y-6 mt-0">
                    <UsersTab
                      users={users}
                      currentUser={currentUser}
                      usersLoading={usersLoading}
                      onCreateUser={openCreateUserModal}
                      onEditUser={openEditUserModal}
                      onDeleteUser={handleUserDelete}
                    />
                  </TabsContent>

                  <TabsContent value="field-data" className="space-y-6 mt-0">
                    <FieldDataTab
                      currentLookupTable={currentLookupTable}
                      lookupData={lookupData}
                      isLoading={loadingLookup}
                      onSelectTable={selectLookupTable}
                      onRefresh={refreshLookupData}
                    />
                  </TabsContent>

                  {isRoleAtLeast(currentUser?.role_level, ROLE_LEVELS.manager) && (
                    <TabsContent value="whatsapp" className="space-y-6 mt-0">
                      <WhatsAppTab
                        formData={localCompany}
                        onChange={handleCompanyChange}
                      />
                    </TabsContent>
                  )}

                  <TabsContent value="personal-profile" className="space-y-6 mt-0">
                    <PersonalProfileTab
                      personalProfile={personalProfile}
                      currentUser={currentUser}
                      emailError={emailError}
                      googleCalendarLoading={googleCalendarLoading}
                      googleCalendarSyncing={googleCalendarSyncing}
                      onProfileChange={handlePersonalProfileChange}
                      onProfilePictureRemove={() => setPersonalProfile(prev => ({ ...prev, profile_picture: '' }))}
                      onConnectGoogle={handleConnectGoogleAccount}
                      onDisconnectGoogle={handleDisconnectGoogleAccount}
                      onSyncGoogleCalendar={handleSyncGoogleCalendar}
                      onToggleGoogleAutoSync={handleToggleGoogleAutoSync}
                    />
                  </TabsContent>

                  <TabsContent value="about" className="space-y-6 mt-0">
                    <AboutTab />
                  </TabsContent>
                </div>

                {/* Fixed Vertical TabsList on the Right */}
                <div className="shrink-0">
                  <TabsList className="flex flex-col h-fit w-48 p-1">
                    <TabsTrigger value="profile" className="w-full justify-end text-right">פרופיל המרפאה</TabsTrigger>
                    <TabsTrigger value="preferences" className="w-full justify-end text-right">הגדרות המרפאה</TabsTrigger>
                    <TabsTrigger value="notifications" className="w-full justify-end text-right">התראות</TabsTrigger>
                    <TabsTrigger value="email" className="w-full justify-end text-right">הגדרות אימייל</TabsTrigger>
                    <TabsTrigger value="personal-profile" className="w-full justify-end text-right">פרופיל אישי</TabsTrigger>
                    {isRoleAtLeast(currentUser?.role_level, ROLE_LEVELS.manager) && (
                      <TabsTrigger value="users" className="w-full justify-end text-right">ניהול משתמשים</TabsTrigger>
                    )}
                    {isRoleAtLeast(currentUser?.role_level, ROLE_LEVELS.manager) && (
                      <TabsTrigger value="whatsapp" className="w-full justify-end text-right text-green-600 dark:text-green-500">הגדרות WhatsApp</TabsTrigger>
                    )}
                    <TabsTrigger value="field-data" className="w-full justify-end text-right">ניהול נתוני שדות</TabsTrigger>
                    <TabsTrigger value="about" className="w-full justify-end text-right">אודות האפליקציה</TabsTrigger>
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
