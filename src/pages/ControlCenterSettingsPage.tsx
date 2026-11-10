import { GoogleCalendarIntegration } from "@/components/settings/GoogleCalendarIntegration";
import { campaignsEnabled } from "@/lib/feature-flags";
import { MessagingTab } from "@/components/settings/MessagingTab";
import { getAppearanceStore } from "@/lib/appearance";
import React, { useState, useEffect } from "react"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { User, Company } from "@/lib/db/schema-interface"
import { getAllUsers, getUsersByCompanyId, updateUser, deleteUser } from "@/lib/db/users-db"
import { cacheCompanyThemeColors, applyCompanyThemeColors } from "@/helpers/theme_helpers"
import { Badge } from "@/components/ui/badge"
import { IconPlus, IconEdit, IconTrash, IconCalendar, IconBrandGoogle, IconCamera, IconX } from "@tabler/icons-react"
import { useUser } from "@/contexts/UserContext"
import { UserModal } from "@/components/UserModal"
import { apiClient } from "@/lib/api-client"
import { ImageInput } from "@/components/ui/image-input"
import { ColorInput } from "@/components/ui/color-input"
import { AboutTab } from "@/components/settings/AboutTab"
import { WhatsAppTab } from "@/components/settings/WhatsAppTab"
import { SubscriptionTab } from "@/components/settings/SubscriptionTab"
import { ROLE_LEVELS, getRoleBadgeVariant, getRoleLabel, isRoleAtLeast } from "@/lib/role-levels"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTranslation } from "react-i18next"
import { useAppLocale } from "@/localization/use-app-locale"

export default function ControlCenterSettingsPage() {
  const { t } = useTranslation()
  const { direction } = useAppLocale()
  const { currentUser, setCurrentUser } = useUser()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  
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
    logo_path: '',
    primary_theme_color: '#3f3f46',
    secondary_theme_color: '#f4f4f5',
    default_currency: 'ILS'
  })

  const [personalProfile, setPersonalProfile] = useState<Partial<User>>({
    full_name: '',
    email: '',
    phone: '',
    profile_picture: '',
    primary_theme_color: '#3f3f46',
    secondary_theme_color: '#f4f4f5',
    theme_preference: 'system'
  })
  const [profileColorUpdateTimeout, setProfileColorUpdateTimeout] = useState<NodeJS.Timeout | null>(null)


  useEffect(() => {
    const loadData = async () => {
      try {
        const firstLoad = company === null
        if (firstLoad) setLoading(true)
        
        let companyData = null
        const storedCompany = localStorage.getItem('controlCenterCompany')
        if (storedCompany) {
          try {
            const parsed = JSON.parse(storedCompany)
            if (parsed?.id) {
              companyData = parsed
            }
          } catch {}
        }
        
        // For control center users, get company through clinic if not from storage
        if (currentUser?.clinic_id) {
          if (!companyData) {
            const clinicResponse = await apiClient.getClinic(currentUser.clinic_id);
            const clinic = clinicResponse.data;
            if (clinic?.company_id) {
              const companyResponse = await apiClient.getCompany(clinic.company_id);
              companyData = companyResponse.data;
            }
          }
        } else {
          if (!companyData) {
            const companiesResponse = await apiClient.getCompanies();
            const companies = companiesResponse.data || [];
            companyData = companies.length > 0 ? companies[0] : null;
          }
        }
        if (companyData) {
          setCompany(companyData)
          setLocalCompany({
            name: companyData.name || '',
            owner_full_name: companyData.owner_full_name || '',
            contact_email: companyData.contact_email || '',
            contact_phone: companyData.contact_phone || '',
            address: companyData.address || '',
            logo_path: companyData.logo_path || '',
            primary_theme_color: companyData.primary_theme_color || '#3f3f46',
            secondary_theme_color: companyData.secondary_theme_color || '#f4f4f5',
            default_currency: companyData.default_currency || 'ILS',
            whatsapp_access_token: companyData.whatsapp_access_token || '',
            whatsapp_phone_number_id: companyData.whatsapp_phone_number_id || '',
            whatsapp_verify_token: companyData.whatsapp_verify_token || ''
          })
          localStorage.setItem('controlCenterCompany', JSON.stringify(companyData))
        }

        let usersData: User[] = []
        if (company?.id) {
          usersData = await getUsersByCompanyId(company.id)
        } else {
          usersData = await getAllUsers()
        }
        setUsers(usersData)

        if (currentUser) {
          setPersonalProfile({
            full_name: currentUser.full_name || '',
            email: currentUser.email || '',
            phone: currentUser.phone || '',
            profile_picture: currentUser.profile_picture || '',
            primary_theme_color: currentUser.primary_theme_color || '#3f3f46',
            secondary_theme_color: currentUser.secondary_theme_color || '#f4f4f5',
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
    if (field === 'email' && emailError) setEmailError(null)
    
    // Note: primary_theme_color is now only used for appointment coloring, not for app theme
    // App theme colors come from company settings
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setSaveSuccess(false)
      setEmailError(null)
      
      // Unified save (company+user) -- reuse save-all to keep flow consistent
      const payload: any = {}
      if (company?.id) {
        payload.company_id = company.id
        payload.company = {
          name: localCompany.name || undefined,
          owner_full_name: localCompany.owner_full_name || undefined,
          contact_email: localCompany.contact_email || undefined,
          contact_phone: localCompany.contact_phone || undefined,
          address: localCompany.address || undefined,
          logo_path: (localCompany.logo_path === '' ? null : localCompany.logo_path) as any,
          primary_theme_color: localCompany.primary_theme_color || undefined,
          secondary_theme_color: localCompany.secondary_theme_color || undefined,
          default_currency: localCompany.default_currency || 'ILS',
          whatsapp_access_token: localCompany.whatsapp_access_token || undefined,
          whatsapp_phone_number_id: localCompany.whatsapp_phone_number_id || undefined,
          whatsapp_verify_token: localCompany.whatsapp_verify_token || undefined,
        }
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
          theme_preference: getAppearanceStore().getSnapshot().mode,
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
      if (data?.company) {
        setCompany(data.company as Company)
        setLocalCompany({
          name: data.company.name || '',
          owner_full_name: data.company.owner_full_name || '',
          contact_email: data.company.contact_email || '',
          contact_phone: data.company.contact_phone || '',
          address: data.company.address || '',
          logo_path: data.company.logo_path || '',
          primary_theme_color: data.company.primary_theme_color || '#3f3f46',
          secondary_theme_color: data.company.secondary_theme_color || '#f4f4f5',
          default_currency: data.company.default_currency || 'ILS',
          whatsapp_access_token: data.company.whatsapp_access_token || '',
          whatsapp_phone_number_id: data.company.whatsapp_phone_number_id || '',
          whatsapp_verify_token: data.company.whatsapp_verify_token || ''
        })
        localStorage.setItem('controlCenterCompany', JSON.stringify(data.company))
        // Cache and apply new company theme colors
        cacheCompanyThemeColors(data.company)
        applyCompanyThemeColors(data.company)
        try { window.dispatchEvent(new CustomEvent('companyUpdated', { detail: data.company })) } catch {}
      }
      if (data?.user) {
        const updatedUser = data.user as User
        setPersonalProfile({
          full_name: updatedUser.full_name || '',
          email: updatedUser.email || '',
          phone: updatedUser.phone || '',
          profile_picture: updatedUser.profile_picture || '',
          primary_theme_color: updatedUser.primary_theme_color || '#3f3f46',
          secondary_theme_color: updatedUser.secondary_theme_color || '#f4f4f5',
          theme_preference: updatedUser.theme_preference || 'system'
        })
        await setCurrentUser(updatedUser, true) // Skip navigation when just updating profile
        localStorage.setItem('currentUser', JSON.stringify(updatedUser))
        // Reflect change in users list immediately
        setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u))
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

  // Image uploads are handled via ImageInput component

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
        <div className="shrink-0 bg-transparent pt-5 pb-2">
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
                    <Card className="shadow-md border-none" dir={direction}>
                      <CardHeader>
                        <CardTitle className="text-start">{t("currencySettings")}</CardTitle>
                        <p className="text-sm text-muted-foreground text-start">
                          {t("currencySettingsDescription")}
                        </p>
                      </CardHeader>
                      <CardContent>
                        <div className="max-w-sm space-y-2">
                          <Label htmlFor="company-default-currency" className="text-start block">
                            {t("defaultCurrency")}
                          </Label>
                          <Select
                            dir={direction}
                            value={localCompany.default_currency || "ILS"}
                            onValueChange={(value) => handleCompanyChange("default_currency", value)}
                          >
                            <SelectTrigger id="company-default-currency" className="text-start">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent align={direction === "rtl" ? "end" : "start"}>
                              <SelectItem value="ILS">{t("israeliShekel")}</SelectItem>
                              <SelectItem value="USD">{t("usDollar")}</SelectItem>
                              <SelectItem value="EUR">{t("euro")}</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-muted-foreground text-start text-xs">
                            {t("currencyChangeNotice")}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="shadow-md border-none">
                      <CardHeader>
                        <CardTitle className="text-right">פרטים בסיסיים</CardTitle>
                        <p className="text-sm text-muted-foreground text-right">מידע כללי על החברה והבעלים</p>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-6 items-center">
                          <div className="flex items-center justify-center">
                            <div className="flex flex-col items-center space-y-2">
                              <ImageInput
                                value={localCompany.logo_path || ''}
                                onChange={(val) => handleCompanyChange('logo_path', val)}
                                onRemove={() => handleCompanyChange('logo_path', '')}
                                size={112}
                                shape="circle"
                                fit="contain"
                                alt="לוגו החברה"
                              />
                              <Label className="text-sm text-center">לוגו החברה</Label>
                            </div>
                          </div>
                          <div className="space-y-4 col-span-2">
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
                        <CardTitle className="text-right">צבעי המערכת</CardTitle>
                        <p className="text-sm text-muted-foreground text-right">התאם את צבעי המערכת עבור כל משתמשי החברה</p>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-6">
                          <div className="space-y-2">
                            <Label className="text-right block text-sm font-medium">צבע ראשי</Label>
                            <div className="flex items-center gap-4">
                              <ColorInput
                                value={localCompany.primary_theme_color || '#3f3f46'}
                                onChange={(e) => {
                                  handleCompanyChange('primary_theme_color', e.target.value);
                                  // Apply preview immediately
                                  if (profileColorUpdateTimeout) clearTimeout(profileColorUpdateTimeout);
                                  const timeout = setTimeout(() => {
                                    const root = document.documentElement;
                                    if (!root.classList.contains('dark')) {
                                      const r = parseInt(e.target.value.slice(1, 3), 16) / 255;
                                      const g = parseInt(e.target.value.slice(3, 5), 16) / 255;
                                      const b = parseInt(e.target.value.slice(5, 7), 16) / 255;
                                      const max = Math.max(r, g, b);
                                      const min = Math.min(r, g, b);
                                      let h = 0, s = 0;
                                      const l = (max + min) / 2;
                                      if (max !== min) {
                                        const d = max - min;
                                        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                                        switch (max) {
                                          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                                          case g: h = (b - r) / d + 2; break;
                                          case b: h = (r - g) / d + 4; break;
                                        }
                                        h /= 6;
                                      }
                                      root.style.setProperty('--primary', `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`);
                                    }
                                  }, 150);
                                  setProfileColorUpdateTimeout(timeout);
                                }}
                                fallbackColor="#3f3f46"
                              />
                              <div className="flex-1">
                                <Input
                                  value={localCompany.primary_theme_color || '#3f3f46'}
                                  onChange={(e) => {
                                    handleCompanyChange('primary_theme_color', e.target.value);
                                    // Apply preview immediately
                                    if (profileColorUpdateTimeout) clearTimeout(profileColorUpdateTimeout);
                                    const timeout = setTimeout(() => {
                                      const root = document.documentElement;
                                      if (!root.classList.contains('dark') && /^#[0-9A-F]{6}$/i.test(e.target.value)) {
                                        const r = parseInt(e.target.value.slice(1, 3), 16) / 255;
                                        const g = parseInt(e.target.value.slice(3, 5), 16) / 255;
                                        const b = parseInt(e.target.value.slice(5, 7), 16) / 255;
                                        const max = Math.max(r, g, b);
                                        const min = Math.min(r, g, b);
                                        let h = 0, s = 0;
                                        const l = (max + min) / 2;
                                        if (max !== min) {
                                          const d = max - min;
                                          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                                          switch (max) {
                                            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                                            case g: h = (b - r) / d + 2; break;
                                            case b: h = (r - g) / d + 4; break;
                                          }
                                          h /= 6;
                                        }
                                        root.style.setProperty('--primary', `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`);
                                      }
                                    }, 150);
                                    setProfileColorUpdateTimeout(timeout);
                                  }}
                                  className="font-mono text-center shadow-sm h-9"
                                  dir="ltr"
                                />
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-right block text-sm font-medium">צבע משני</Label>
                            <div className="flex items-center gap-4">
                              <ColorInput
                                value={localCompany.secondary_theme_color || '#f4f4f5'}
                                onChange={(e) => {
                                  handleCompanyChange('secondary_theme_color', e.target.value);
                                  // Apply preview immediately
                                  if (profileColorUpdateTimeout) clearTimeout(profileColorUpdateTimeout);
                                  const timeout = setTimeout(() => {
                                    const root = document.documentElement;
                                    if (!root.classList.contains('dark')) {
                                      const r = parseInt(e.target.value.slice(1, 3), 16) / 255;
                                      const g = parseInt(e.target.value.slice(3, 5), 16) / 255;
                                      const b = parseInt(e.target.value.slice(5, 7), 16) / 255;
                                      const max = Math.max(r, g, b);
                                      const min = Math.min(r, g, b);
                                      let h = 0, s = 0;
                                      const l = (max + min) / 2;
                                      if (max !== min) {
                                        const d = max - min;
                                        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                                        switch (max) {
                                          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                                          case g: h = (b - r) / d + 2; break;
                                          case b: h = (r - g) / d + 4; break;
                                        }
                                        h /= 6;
                                      }
                                      root.style.setProperty('--secondary', `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`);
                                    }
                                  }, 150);
                                  setProfileColorUpdateTimeout(timeout);
                                }}
                                fallbackColor="#f4f4f5"
                              />
                              <div className="flex-1">
                                <Input
                                  value={localCompany.secondary_theme_color || '#f4f4f5'}
                                  onChange={(e) => {
                                    handleCompanyChange('secondary_theme_color', e.target.value);
                                    // Apply preview immediately
                                    if (profileColorUpdateTimeout) clearTimeout(profileColorUpdateTimeout);
                                    const timeout = setTimeout(() => {
                                      const root = document.documentElement;
                                      if (!root.classList.contains('dark') && /^#[0-9A-F]{6}$/i.test(e.target.value)) {
                                        const r = parseInt(e.target.value.slice(1, 3), 16) / 255;
                                        const g = parseInt(e.target.value.slice(3, 5), 16) / 255;
                                        const b = parseInt(e.target.value.slice(5, 7), 16) / 255;
                                        const max = Math.max(r, g, b);
                                        const min = Math.min(r, g, b);
                                        let h = 0, s = 0;
                                        const l = (max + min) / 2;
                                        if (max !== min) {
                                          const d = max - min;
                                          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                                          switch (max) {
                                            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                                            case g: h = (b - r) / d + 2; break;
                                            case b: h = (r - g) / d + 4; break;
                                          }
                                          h /= 6;
                                        }
                                        root.style.setProperty('--secondary', `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`);
                                      }
                                    }, 150);
                                    setProfileColorUpdateTimeout(timeout);
                                  }}
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

                  <TabsContent value="personal-profile" className="space-y-6 mt-0">
                    <Card className="shadow-md border-none">
                      <CardHeader>
                        <CardTitle className="text-right">פרטים אישיים</CardTitle>
                        <p className="text-sm text-muted-foreground text-right">תמונת פרופיל ופרטי יצירת קשר</p>
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-8 items-start">
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

                    <Card className="shadow-md border-none">
                      <CardHeader>
                        <CardTitle className="text-right">צבע אישי</CardTitle>
                        <p className="text-sm text-muted-foreground text-right">צבע אישי לסימון התורים שלך ביומן</p>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <Label className="text-right block text-sm font-medium">צבע לתורים ביומן</Label>
                          <div className="flex items-center gap-4">
                            <ColorInput
                              value={personalProfile.primary_theme_color}
                              onChange={(e) => handlePersonalProfileChange('primary_theme_color', e.target.value)}
                              fallbackColor="#3f3f46"
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
                          <p className="text-xs text-muted-foreground text-right mt-2">
                            הצבע הזה ישמש לסימון התורים שלך באפליקציה וביומן Google Calendar
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <GoogleCalendarIntegration />
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
                                      <Badge variant={getRoleBadgeVariant(user.role_level)}>
                                        {getRoleLabel(user.role_level)}
                                      </Badge>
                                      <h3 className="font-medium">{user.full_name || user.username}</h3>
                                    </div>
                                    <div className="text-sm text-muted-foreground mt-1">
                                      {user.email && <span>אימייל: {user.email}</span>}
                                      {user.email && user.phone && <span> • </span>}
                                      {user.phone && <span>טלפון: {user.phone}</span>}
                                      {!user.email && !user.phone && <span>אין פרטי יצירת קשר</span>}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {user.has_password ? 'מוגן בסיסמה' : 'ללא סיסמה'}
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

                  <TabsContent value="about" className="space-y-6 mt-0">
                    <AboutTab />
                  </TabsContent>

                  {campaignsEnabled && <TabsContent value="messaging" className="space-y-6 mt-0"><MessagingTab company /></TabsContent>}
                  <TabsContent value="subscription" className="space-y-6 mt-0">
                    <SubscriptionTab />
                  </TabsContent>

                  <TabsContent value="whatsapp" className="space-y-6 mt-0">
                    <WhatsAppTab 
                      formData={localCompany}
                      onChange={handleCompanyChange}
                    />
                  </TabsContent>
                </div>

                <div className="shrink-0">
                  <TabsList className="flex flex-col h-fit w-48 p-1">
                    <TabsTrigger value="company-profile" className="w-full justify-end text-right">פרופיל החברה</TabsTrigger>
                    <TabsTrigger value="whatsapp" className="w-full justify-end text-right text-green-600 dark:text-green-500">הגדרות WhatsApp</TabsTrigger>
                    <TabsTrigger value="personal-profile" className="w-full justify-end text-right">פרופיל אישי</TabsTrigger>
                    {isRoleAtLeast(currentUser?.role_level, ROLE_LEVELS.ceo) && (
                      <TabsTrigger value="users" className="w-full justify-end text-right">ניהול משתמשים</TabsTrigger>
                    )}
                    {isRoleAtLeast(currentUser?.role_level, ROLE_LEVELS.ceo) && (
                      <TabsTrigger value="subscription" className="w-full justify-end text-right">תוכנית ומנוי</TabsTrigger>
                    )}
                    {campaignsEnabled && <TabsTrigger value="messaging" className="w-full justify-start text-start">{t("campaign.usageTitle")}</TabsTrigger>}
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
        companyId={company?.id}
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
