import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ImageInput } from "@/components/ui/image-input"
import { IconPlus, IconX, IconCalendar, IconBrandGoogle, IconAdjustmentsHorizontal } from "@tabler/icons-react"
import type { DateRange } from "react-day-picker"
import { User } from "@/lib/db/schema-interface"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

const PRESET_COLORS = [
  '#2563eb', // כחול
  '#7c3aed', // סגול
  '#db2777', // ורוד
  '#dc2626', // אדום
  '#ea580c', // כתום
  '#16a34a', // ירוק
  '#0891b2', // טורקיז
  '#4b5563'  // אפור
]

interface PersonalProfileTabProps {
  personalProfile: Partial<User>
  currentUser: User | null
  emailError: string | null
  googleCalendarLoading: boolean
  googleCalendarSyncing: boolean
  onProfileChange: (field: keyof User, value: any) => void
  onProfilePictureRemove: () => void
  onConnectGoogle: () => void
  onDisconnectGoogle: () => void
  onSyncGoogleCalendar: () => void
  onToggleGoogleAutoSync: (enabled: boolean) => void
}

export function PersonalProfileTab({
  personalProfile,
  currentUser,
  emailError,
  googleCalendarLoading,
  googleCalendarSyncing,
  onProfileChange,
  onProfilePictureRemove,
  onConnectGoogle,
  onDisconnectGoogle,
  onSyncGoogleCalendar,
  onToggleGoogleAutoSync
}: PersonalProfileTabProps) {
  const [openSystemVacation, setOpenSystemVacation] = useState(false)
  const [openAddedVacation, setOpenAddedVacation] = useState(false)
  const [systemVacationRange, setSystemVacationRange] = useState<DateRange | undefined>(undefined)
  const [addedVacationRange, setAddedVacationRange] = useState<DateRange | undefined>(undefined)

  const normalizeDates = (value: unknown): string[] => {
    if (Array.isArray(value)) return value as string[]
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed) return []
      try {
        const parsed = JSON.parse(trimmed)
        return Array.isArray(parsed) ? (parsed as string[]) : []
      } catch {
        return []
      }
    }
    return []
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

  const addVacationRange = (type: 'system' | 'added', range: DateRange | undefined, updateProfile: (updates: Partial<User>) => void) => {
    if (!range?.from || !range?.to) return
    const dates = enumerateDates(range.from, range.to)
    if (type === 'system') {
      const existing = new Set(normalizeDates(personalProfile.system_vacation_dates))
      dates.forEach(d => existing.add(d))
      updateProfile({ system_vacation_dates: Array.from(existing).sort() })
      setSystemVacationRange(undefined)
      setOpenSystemVacation(false)
    } else {
      const existing = new Set(normalizeDates(personalProfile.added_vacation_dates))
      dates.forEach(d => existing.add(d))
      updateProfile({ added_vacation_dates: Array.from(existing).sort() })
      setAddedVacationRange(undefined)
      setOpenAddedVacation(false)
    }
  }

  const removeVacationRange = (type: 'system' | 'added', from: string, to: string, updateProfile: (updates: Partial<User>) => void) => {
    const dates = enumerateDates(new Date(from), new Date(to))
    if (type === 'system') {
      const setDates = new Set(normalizeDates(personalProfile.system_vacation_dates))
      dates.forEach(d => setDates.delete(d))
      updateProfile({ system_vacation_dates: Array.from(setDates).sort() })
    } else {
      const setDates = new Set(normalizeDates(personalProfile.added_vacation_dates))
      dates.forEach(d => setDates.delete(d))
      updateProfile({ added_vacation_dates: Array.from(setDates).sort() })
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

  return (
    <div className="space-y-6">
      <Card className="">
        <CardHeader>
          <CardTitle className="text-right">פרטים אישיים</CardTitle>
          <p className="text-sm text-muted-foreground text-right">תמונת פרופיל ופרטי יצירת קשר</p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-8 items-start">
            <div className="flex flex-col items-center space-y-3 min-w-[140px]">
              <ImageInput
                value={personalProfile.profile_picture || ''}
                onChange={(val) => onProfileChange('profile_picture', val)}
                onRemove={onProfilePictureRemove}
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
                    onChange={(e) => onProfileChange('full_name', e.target.value)}
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
                    onChange={(e) => onProfileChange('email', e.target.value)}
                    placeholder="example@email.com"
                    className={`text-right h-9 ${emailError ? 'border-red-500' : ''}`}
                    dir="rtl"
                    disabled={currentUser?.auth_provider === 'google'}
                  />
                  {currentUser?.auth_provider === 'google' && (
                    <p className="text-xs text-muted-foreground text-right mt-1">
                      לא ניתן לשנות אימייל למשתמש המחובר דרך Google
                    </p>
                  )}
                  {emailError && (
                    <div className="text-xs text-red-600 text-right">{emailError}</div>
                  )}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="personal_phone" className="text-right block text-sm">טלפון</Label>
                  <Input
                    id="personal_phone"
                    value={personalProfile.phone || ''}
                    onChange={(e) => onProfileChange('phone', e.target.value)}
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

      <Card className="">
        <CardHeader>
          <CardTitle className="text-right">חופשות</CardTitle>
          <p className="text-sm text-muted-foreground text-right">ניהול ימי חופשה</p>
        </CardHeader>
        <CardContent>
          <div className="relative grid grid-cols-1 md:grid-cols-2 gap-6" dir="rtl">
            <div className="hidden md:block absolute inset-y-2 left-1/2 w-px bg-border" />
            <VacationSection
              label="חופשה מערכתית"
              description="ימי חופשה מוגדרים על ידי המערכת"
              dates={normalizeDates(personalProfile.system_vacation_dates)}
              open={openSystemVacation}
              onOpenChange={setOpenSystemVacation}
              range={systemVacationRange}
              onRangeChange={setSystemVacationRange}
              onAdd={(range) => addVacationRange('system', range, (updates) => {
                Object.entries(updates).forEach(([key, value]) => {
                  if (key === 'system_vacation_dates') onProfileChange(key as keyof User, value)
                })
              })}
              onRemove={(from, to) => removeVacationRange('system', from, to, (updates) => {
                Object.entries(updates).forEach(([key, value]) => {
                  if (key === 'system_vacation_dates') onProfileChange(key as keyof User, value)
                })
              })}
              compressDates={compressDatesToRanges}
            />
            <VacationSection
              label="חופשה נוספת"
              description="ימי חופשה שנוספו"
              dates={normalizeDates(personalProfile.added_vacation_dates)}
              open={openAddedVacation}
              onOpenChange={setOpenAddedVacation}
              range={addedVacationRange}
              onRangeChange={setAddedVacationRange}
              onAdd={(range) => addVacationRange('added', range, (updates) => {
                Object.entries(updates).forEach(([key, value]) => {
                  if (key === 'added_vacation_dates') onProfileChange(key as keyof User, value)
                })
              })}
              onRemove={(from, to) => removeVacationRange('added', from, to, (updates) => {
                Object.entries(updates).forEach(([key, value]) => {
                  if (key === 'added_vacation_dates') onProfileChange(key as keyof User, value)
                })
              })}
              compressDates={compressDatesToRanges}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="">
        <CardHeader>
          <CardTitle className="text-right">צבע אישי</CardTitle>
          <p className="text-sm text-muted-foreground text-right">צבע אישי לסימון התורים שלך ביומן</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4" dir="rtl">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <Label className="text-sm font-medium ml-2 shrink-0">בחר צבע:</Label>
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={cn(
                    "w-8 h-8 rounded-full border-2 transition-all hover:scale-110 active:scale-95 shadow-sm relative",
                    personalProfile.primary_theme_color === color
                      ? "border-primary ring-2 ring-primary/20 ring-offset-2"
                      : "border-transparent hover:border-muted-foreground/30"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => onProfileChange('primary_theme_color', color)}
                  title={color}
                >
                  {personalProfile.primary_theme_color === color && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
                    </div>
                  )}
                </button>
              ))}

              <div className="relative group shrink-0">
                <input
                  type="color"
                  value={personalProfile.primary_theme_color || '#000000'}
                  onChange={(e) => onProfileChange('primary_theme_color', e.target.value)}
                  className="absolute inset-0 opacity-0 w-8 h-8 cursor-pointer p-0 z-10"
                />
                <div
                  className={cn(
                    "w-8 h-8 rounded-full border-2 border-dashed flex items-center justify-center bg-background transition-all group-hover:border-primary group-hover:scale-110 shadow-sm",
                    !PRESET_COLORS.includes(personalProfile.primary_theme_color || '') && personalProfile.primary_theme_color
                      ? "border-primary ring-2 ring-primary/20 ring-offset-2"
                      : "border-muted-foreground/30"
                  )}
                  style={!PRESET_COLORS.includes(personalProfile.primary_theme_color || '') && personalProfile.primary_theme_color ? { backgroundColor: personalProfile.primary_theme_color } : {}}
                >
                  {!PRESET_COLORS.includes(personalProfile.primary_theme_color || '') && personalProfile.primary_theme_color ? (
                    <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
                  ) : (
                    <IconPlus className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0" dir="ltr">
              <Input
                value={personalProfile.primary_theme_color}
                onChange={(e) => onProfileChange('primary_theme_color', e.target.value)}
                className="font-mono text-center shadow-sm h-9 w-28 uppercase"
                placeholder="#000000"
              />
              <div
                className="w-9 h-9 rounded-lg shadow-inner border border-border flex-shrink-0"
                style={{ backgroundColor: personalProfile.primary_theme_color }}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-right mt-4">
            הצבע הזה ישמש לסימון התורים שלך באפליקציה וביומן Google Calendar
          </p>
        </CardContent>
      </Card>

      <Card className="">
        <CardHeader>
          <CardTitle className="text-right flex items-center gap-2 justify-end">
            <IconAdjustmentsHorizontal className="h-5 w-5" />
            העדפות בדיקה
          </CardTitle>
          <p className="text-sm text-muted-foreground text-right">הגדרות תצוגה עבור בדיקות אופטומטריה</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col gap-2 items-end">
              <Label className="text-right text-sm font-medium">שיטת הצגת חדות ראייה (VA)</Label>
              <Select
                value={personalProfile.va_format || "meter"}
                onValueChange={(val) => onProfileChange('va_format', val)}
              >
                <SelectTrigger className="w-[200px] h-9" dir="rtl">
                  <SelectValue placeholder="בחר שיטה" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="meter" className="text-right">Meter (6/6)</SelectItem>
                  <SelectItem value="decimal" className="text-right">Decimal (1.0)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground text-right mt-1">
                בחירה זו תקבע כיצד יוצגו ערכי חדות הראייה בכל טבלאות הבדיקה.
              </p>
            </div>

            <div className="flex flex-col gap-2 items-end border-t pt-4">
              <Label className="text-right text-sm font-medium">שיטת הצגת צילינדר (CYL)</Label>
              <Select
                value={personalProfile.cyl_format || "minus"}
                onValueChange={(val) => onProfileChange('cyl_format', val)}
              >
                <SelectTrigger className="w-[200px] h-9" dir="rtl">
                  <SelectValue placeholder="בחר שיטה" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="minus" className="text-right">Minus Cylinder (-)</SelectItem>
                  <SelectItem value="plus" className="text-right">Plus Cylinder (+)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground text-right mt-1">
                בחירה זו תקבע את פורמט ברירת המחדל של הצילינדר. המערכת תבצע המרה (Transposition) אוטומטית במידת הצורך.
              </p>
            </div>

            <div className="flex flex-col gap-2 items-end border-t pt-4">
              <div className="flex items-center justify-end gap-2">
                <Label htmlFor="sync-subjective" className="text-right text-sm font-medium cursor-pointer">
                  חבר אוטומטית בין בדיקה סובייקטיבית למרשם סופי
                </Label>
                <Switch
                  id="sync-subjective"
                  checked={personalProfile.sync_subjective_to_final_subjective || false}
                  onCheckedChange={(checked) => onProfileChange('sync_subjective_to_final_subjective', checked)}
                />
              </div>
              <p className="text-xs text-muted-foreground text-right w-full">
                כאשר אפשרות זו פעילה, שינויים בבדיקה הסובייקטיבית יעודכנו אוטומטית במרשם הסופי באותו המפגש.
              </p>
            </div>

            <div className="flex flex-col gap-2 items-end border-t pt-4">
              <div className="flex items-center justify-end gap-2">
                <Label htmlFor="import-order-to-old-refraction" className="text-right text-sm font-medium cursor-pointer">
                  ייבא אוטומטית נתוני הזמנה אחרונה למרשם ישן
                </Label>
                <Switch
                  id="import-order-to-old-refraction"
                  checked={personalProfile.import_order_to_old_refraction_default || false}
                  onCheckedChange={(checked) => onProfileChange('import_order_to_old_refraction_default', checked)}
                />
              </div>
              <p className="text-xs text-muted-foreground text-right w-full">
                כאשר אפשרות זו פעילה, בעת פתיחת בדיקה חדשה, נתוני ההזמנה האחרונה של הלקוח ייטענו אוטומטית לתוך כרטיס המרשם הישן.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="">
        <CardHeader>
          <CardTitle className="text-right flex items-center gap-2 justify-end">
            <IconCalendar className="h-5 w-5" />
            חיבור ל-Google Calendar
          </CardTitle>
          <p className="text-sm text-muted-foreground text-right">סנכרן את התורים שלך עם Google Calendar</p>
        </CardHeader>
        <CardContent>
          {currentUser?.google_account_connected ? (
            <GoogleCalendarConnected
              email={currentUser.google_account_email || ''}
              loading={googleCalendarLoading}
              syncing={googleCalendarSyncing}
              onDisconnect={onDisconnectGoogle}
              onSync={onSyncGoogleCalendar}
              autoSyncEnabled={!!currentUser.google_calendar_sync_enabled}
              onToggleAutoSync={onToggleGoogleAutoSync}
            />
          ) : (
            <GoogleCalendarDisconnected
              loading={googleCalendarLoading}
              onConnect={onConnectGoogle}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

interface VacationSectionProps {
  label: string
  description: string
  dates: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  range: DateRange | undefined
  onRangeChange: (range: DateRange | undefined) => void
  onAdd: (range: DateRange | undefined) => void
  onRemove: (from: string, to: string) => void
  compressDates: (dates: string[]) => { from: string; to: string }[]
}

function VacationSection({
  label,
  description,
  dates,
  open,
  onOpenChange,
  range,
  onRangeChange,
  onAdd,
  onRemove,
  compressDates
}: VacationSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <Label className="text-right">{label}</Label>
          <p className="text-xs text-muted-foreground text-right">{description}</p>
        </div>
        <Popover open={open} onOpenChange={onOpenChange}>
          <PopoverTrigger asChild>
            <Button size="icon" variant="outline">
              <IconPlus className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <div className="p-2">
              <Calendar
                mode="range"
                selected={range}
                onSelect={onRangeChange}
                numberOfMonths={2}
                captionLayout="dropdown"
              />
              <div className="flex justify-end gap-2 p-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRangeChange(undefined)}
                >
                  נקה
                </Button>
                <Button
                  size="sm"
                  disabled={!range?.from || !range?.to}
                  onClick={() => onAdd(range)}
                >
                  הוסף
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex flex-wrap gap-2" style={{ scrollbarWidth: 'none' }}>
        {compressDates(dates).map((rg, idx) => (
          <span key={idx} className="relative group">
            <Badge variant="secondary" className="px-2 py-1">
              {rg.from === rg.to ? rg.from : `${rg.from} — ${rg.to}`}
            </Badge>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="absolute -top-1 -right-1 size-4 hidden group-hover:flex bg-red-400"
              onClick={() => onRemove(rg.from, rg.to)}
              title="מחק טווח"
            >
              <IconX className="h-2.5 w-2.5" />
            </Button>
          </span>
        ))}
      </div>
    </div>
  )
}

interface GoogleCalendarConnectedProps {
  email: string
  loading: boolean
  syncing: boolean
  onDisconnect: () => void
  onSync: () => void
  autoSyncEnabled: boolean
  onToggleAutoSync: (enabled: boolean) => void
}

function GoogleCalendarConnected({
  email,
  loading,
  syncing,
  onDisconnect,
  onSync,
  autoSyncEnabled,
  onToggleAutoSync
}: GoogleCalendarConnectedProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={onDisconnect}
              disabled={loading}
              className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
            >
              {loading && (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin ml-2" />
              )}
              נתק חשבון
            </Button>
            <div className="flex items-center gap-2">
              <Switch checked={autoSyncEnabled} onCheckedChange={onToggleAutoSync} />
              <span className="text-sm">סנכרון אוטומטי</span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">מחובר ל-Google Calendar</span>
          </div>
          <div className="text-sm text-green-600 dark:text-green-400 mt-1">
            {email}
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
  )
}

interface GoogleCalendarDisconnectedProps {
  loading: boolean
  onConnect: () => void
}

function GoogleCalendarDisconnected({
  loading,
  onConnect
}: GoogleCalendarDisconnectedProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
        <Button
          onClick={onConnect}
          disabled={loading}
          className="flex items-center gap-2"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <IconBrandGoogle className="h-4 w-4" />
          )}
          {loading ? 'מתחבר...' : 'חבר חשבון Google (עם גישה ליומן)'}
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
  )
}


