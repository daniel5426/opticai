import React from "react"
import {
  IconDotsVertical,
  IconLogout,
  IconUserCircle,
  IconSettings,
  IconClock,
  IconPlayerPlay,
  IconPlayerStop,
  IconX,
} from "@tabler/icons-react"
import { useLocation } from "@tanstack/react-router"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { CustomModal } from "@/components/ui/custom-modal"
import { User, WorkShift } from "@/lib/db/schema-interface"
import { ROLE_LEVELS, getRoleBadgeVariant, getRoleLabel, isRoleAtLeast } from "@/lib/role-levels"
import { useUser } from "@/contexts/UserContext"
import { 
  createWorkShift, 
  getActiveWorkShiftByUserId, 
  updateWorkShift 
} from "@/lib/db/work-shifts-db"
import { toast } from "sonner"
import { GuardedRouterLink } from "@/components/GuardedRouterLink"
import {
  ColorTheme,
  getColorTheme,
  previewColorTheme,
  setColorTheme,
} from "@/helpers/theme_helpers"
import { useTranslation } from "react-i18next"
import { getActiveLocale, getDirection, normalizeLocale } from "@/localization/locale"

const colorThemes: Array<{
  value: ColorTheme
  labelKey: string
}> = [
  { value: "blue", labelKey: "colorThemeClassicBlue" },
  { value: "ice", labelKey: "colorThemeIceBlue" },
  { value: "neutral", labelKey: "colorThemeGraphite" },
  { value: "forest", labelKey: "colorThemeForest" },
  { value: "bronze", labelKey: "colorThemeBronze" },
  { value: "plum", labelKey: "colorThemePlum" },
  { value: "monochrome", labelKey: "colorThemeMonochrome" },
  { value: "openai", labelKey: "colorThemeOpenAI" },
]

export function NavUser({
  currentUser,
  showShiftControls = true,
}: {
  currentUser?: User
  showShiftControls?: boolean
}) {
  const { i18n, t } = useTranslation()
  const locale = normalizeLocale(i18n.resolvedLanguage ?? i18n.language) ?? getActiveLocale()
  const direction = getDirection(locale)
  const { isMobile } = useSidebar()
  const { currentClinic, logoutUser, logoutClinic } = useUser()
  const location = useLocation()
  const [showProfileModal, setShowProfileModal] = React.useState(false)
  const [currentTime, setCurrentTime] = React.useState(new Date())
  const [activeShift, setActiveShift] = React.useState<WorkShift | null>(null)
  const [isStartingShift, setIsStartingShift] = React.useState(false)
  const [colorTheme, setColorThemeState] = React.useState<ColorTheme>(() =>
    getColorTheme(currentUser?.id),
  )

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  React.useEffect(() => {
    const loadActiveShift = async () => {
      if (!currentUser?.id) return
      try {
        const shift = await getActiveWorkShiftByUserId(currentUser.id)
        setActiveShift(shift || null)
      } catch (error) {
        console.error('Error loading active shift:', error)
      }
    }

    loadActiveShift()
  }, [currentUser?.id])

  if (!currentUser) {
    return null
  }

  const handleLogoutUser = () => {
    logoutUser()
  }

  const handleLogoutClinic = async () => {
    try {
      console.log('NavUser: Starting clinic logout')
      await logoutClinic()
      // AuthService will handle navigation automatically
      console.log('NavUser: Clinic logout completed')
    } catch (error) {
      console.error('NavUser: Error during clinic logout:', error)
    }
  }

  const openProfileModal = () => {
    setShowProfileModal(true)
  }

  const handleColorThemeChange = (theme: ColorTheme) => {
    setColorTheme(theme, currentUser?.id)
    setColorThemeState(theme)
  }

  const handleStartShift = async () => {
    if (!currentUser?.id) return
    
    setIsStartingShift(true)
    try {
      const now = new Date()
      const timeString = now.toTimeString().slice(0, 8)
      const dateString = now.toISOString().split('T')[0]
      
      const newShift = await createWorkShift({
        user_id: currentUser.id,
        start_time: timeString,
        date: dateString,
        status: 'active'
      })
      
      if (newShift) {
        setActiveShift(newShift)
        toast.success('משמרת התחילה')
      } else {
        toast.error('שגיאה בתחילת המשמרת')
      }
    } catch (error) {
      console.error('Error starting shift:', error)
      toast.error('שגיאה בתחילת המשמרת')
    } finally {
      setIsStartingShift(false)
    }
  }

  const handleEndShift = async () => {
    if (!activeShift?.id) return
    
    try {
      const now = new Date()
      const endTime = now.toTimeString().slice(0, 8)
      
      const startTime = new Date(`2000-01-01 ${activeShift.start_time}`)
      const endTimeDate = new Date(`2000-01-01 ${endTime}`)
      let durationMinutes = (endTimeDate.getTime() - startTime.getTime()) / (1000 * 60)
      
      if (durationMinutes < 0) {
        durationMinutes += 24 * 60
      }
      
      const updatedShift = await updateWorkShift({
        ...activeShift,
        end_time: endTime,
        duration_minutes: Math.round(durationMinutes),
        status: 'completed'
      })
      
      if (updatedShift) {
        setActiveShift(null)
        toast.success(`משמרת הסתיימה (${Math.round(durationMinutes)} דקות)`)
      } else {
        toast.error('שגיאה בסיום המשמרת')
      }
    } catch (error) {
      console.error('Error ending shift:', error)
      toast.error('שגיאה בסיום המשמרת')
    }
  }

  const handleCancelShift = async () => {
    if (!activeShift?.id) return
    
    try {
      const cancelledShift = await updateWorkShift({
        ...activeShift,
        status: 'cancelled'
      })
      
      if (cancelledShift) {
        setActiveShift(null)
        toast.success('המשמרת בוטלה')
      } else {
        toast.error('שגיאה בביטול המשמרת')
      }
    } catch (error) {
      console.error('Error cancelling shift:', error)
      toast.error('שגיאה בביטול המשמרת')
    }
  }

  const displayName = currentUser.full_name?.trim() || currentUser.username
  const userInitials = displayName.charAt(0).toUpperCase()
  const roleName = getRoleLabel(currentUser.role_level)
  const isControlCenterRoute = location.pathname.startsWith("/control-center")
  const showClinicLogoutOptions =
    !isRoleAtLeast(currentUser.role_level, ROLE_LEVELS.ceo) ||
    (!!currentClinic && !isControlCenterRoute)

  return (
    <>
      <SidebarMenu dir={direction}>
        <SidebarMenuItem dir={direction}>
          <DropdownMenu dir={direction}>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <Avatar className="h-8 w-8 rounded-lg ">
                  {currentUser.profile_picture ? (
                    <AvatarImage src={currentUser.profile_picture} alt={displayName} />
                  ) : null}
                  <AvatarFallback className="rounded-lg ">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-start text-sm leading-tight" dir={direction}>
                  <span className="truncate font-medium">{displayName}</span>
                </div>
                <IconDotsVertical className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) pb-2 min-w-56 rounded-lg mb-4"
              side={isMobile ? "bottom" : direction === "rtl" ? "left" : "right"}
              align="start"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-start text-sm" dir={direction}>
                <Avatar className="h-8 w-8 rounded-lg">
                        {currentUser.profile_picture ? (
                          <AvatarImage src={currentUser.profile_picture} alt={displayName} />
                        ) : null}
                        <AvatarFallback className="rounded-lg ">
                          {userInitials}
                        </AvatarFallback>
                      </Avatar>

                  <div className="grid flex-1  text-sm">
                    <div className="flex items-center justify-start gap-2">
                      <span className="truncate font-medium">{displayName}</span>
                    </div>
                    {currentUser.email && (
                      <span className="text-muted-foreground truncate text-xs">
                        {currentUser.email}
                      </span>
                    )}
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              
              {/* Current Time and Shift Controls */}
              {showShiftControls && (
                <div className="px-1 py-2 space-y-2">
                  {activeShift ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm" dir={direction}>
                        <div className="flex items-center">
                          <span className="font-mono">{currentTime.toLocaleTimeString('he-IL')}</span>
                          <div className="w-2"></div>
                          <IconClock className="h-4 w-4" />
                        </div>
                      </div>
                      <div className="text-xs text-green-600 text-start" dir={direction}>
                        משמרת פעילה מ-{activeShift.start_time}
                      </div>
                      <div className="flex gap-1 justify-end" dir={direction}>
                        <button
                          onClick={handleCancelShift}
                          className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                          title="בטל משמרת"
                        >
                          <IconX className="h-3 w-3" />
                          בטל
                        </button>
                        <button
                          onClick={handleEndShift}
                          className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-red-100 hover:bg-red-200 text-red-700"
                          title="סיים משמרת"
                        >
                          <IconPlayerStop className="h-3 w-3" />
                          סיים
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-sm" dir={direction}>
                      <div className="flex items-center">
                        <span className="font-mono">{currentTime.toLocaleTimeString('he-IL')}</span>
                        <div className="w-2"></div>
                        <IconClock className="h-4 w-4" />
                      </div>
                      <button
                        onClick={handleStartShift}
                        disabled={isStartingShift}
                        className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-green-100 hover:bg-green-200 text-green-700 disabled:opacity-50"
                        dir={direction}
                      >
                        {isStartingShift ? (
                          <>
                            <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                            מתחיל...
                          </>
                        ) : (
                          <>
                            <IconPlayerPlay className="h-3 w-3" />
                            התחל משמרת
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
              <DropdownMenuSeparator />

              <DropdownMenuSub>
                <DropdownMenuSubTrigger>{t("colorAppearance")}</DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  className="w-40"
                  onPointerLeave={() => previewColorTheme(getColorTheme(currentUser?.id))}
                >
                  {colorThemes.map(({ value, labelKey }) => (
                    <DropdownMenuItem
                      key={value}
                      onPointerEnter={() => previewColorTheme(value)}
                      onFocus={() => previewColorTheme(value)}
                      onClick={() => handleColorThemeChange(value)}
                      className={`justify-start ${
                        colorTheme === value
                          ? "bg-accent text-accent-foreground"
                          : ""
                      }`}
                    >
                      {t(labelKey)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              
              <DropdownMenuGroup>
                <DropdownMenuItem 
                  className="flex justify-between items-center" 
                  dir={direction}
                  onClick={openProfileModal}
                >
                  <span>פרופיל אישי</span>
                  <IconUserCircle className="mr-2" />
                </DropdownMenuItem>
                <DropdownMenuItem className="flex justify-between items-center" dir={direction} asChild>
                  <GuardedRouterLink to="/settings">
                    <span>הגדרות</span>
                    <IconSettings className="mr-2" />
                  </GuardedRouterLink>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {showClinicLogoutOptions ? (
                  <>
                    <DropdownMenuItem
                      className="flex justify-between items-center"
                      onClick={handleLogoutUser}
                      dir={direction}
                    >
                      <span>התנתקות משתמש</span>
                      <IconLogout className="mr-2" />
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="flex justify-between items-center text-red-600 hover:text-red-700"
                      onClick={handleLogoutClinic}
                      dir={direction}
                    >
                      <span>התנתקות מרפאה</span>
                      <IconLogout className="mr-2" />
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem
                    className="flex justify-between items-center text-red-600 hover:text-red-700"
                    onClick={handleLogoutClinic}
                    dir={direction}
                  >
                    <span>התנתקות</span>
                    <IconLogout className="mr-2" />
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      {/* Profile Modal */}
      {currentUser && (
        <CustomModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          title="פרטי משתמש"
          subtitle="מידע אישי ופרטי התחברות"
          className="max-w-xs"
        >
          <div className="space-y-4 pb-4" dir={direction}>
            <div className="flex items-center gap-4 rounded-lg">
              <Avatar className="h-16 w-16 rounded-lg">
                {currentUser.profile_picture ? (
                  <AvatarImage src={currentUser.profile_picture} alt={currentUser.username} />
                ) : null}
                <AvatarFallback className="rounded-lg text-lg font-semibold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-start">
                 <h3 className="font-semibold text-lg">{displayName}</h3>
                <Badge variant={getRoleBadgeVariant(currentUser.role_level)} className="mt-1">
                  {roleName}
                </Badge>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <span className="text-muted-foreground">שם משתמש:</span>
                <span className="col-span-2 font-medium">{currentUser.username}</span>
              </div>
              
              {currentUser.email && (
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <span className="text-muted-foreground">אימייל:</span>
                  <span className="col-span-2">{currentUser.email}</span>
                </div>
              )}
              
              {currentUser.phone && (
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <span className="text-muted-foreground">טלפון:</span>
                  <span className="col-span-2">{currentUser.phone}</span>
                </div>
              )}
              
              <div className="grid grid-cols-3 gap-2 text-sm">
                <span className="text-muted-foreground">תפקיד:</span>
                <span className="col-span-2">{roleName}</span>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-sm">
                <span className="text-muted-foreground">סיסמה:</span>
                <span className="col-span-2">
                  {currentUser.has_password ? 'מוגן בסיסמה' : 'ללא סיסמה'}
                </span>
              </div>
            </div>
            
          </div>
        </CustomModal>
      )}
    </>
  )
}
