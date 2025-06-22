import React from "react"
import {
  IconCreditCard,
  IconDotsVertical,
  IconLogout,
  IconNotification,
  IconUserCircle,
  IconSettings,
} from "@tabler/icons-react"
import { Link } from "@tanstack/react-router"

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
import { User } from "@/lib/db/schema"
import { useUser } from "@/contexts/UserContext"

export function NavUser({
  currentUser,
}: {
  currentUser?: User
}) {
  const { isMobile } = useSidebar()
  const { logout } = useUser()
  const [showProfileModal, setShowProfileModal] = React.useState(false)

  if (!currentUser) {
    return null
  }

  const handleLogout = () => {
    logout()
  }

  const openProfileModal = () => {
    setShowProfileModal(true)
  }

  const userInitials = currentUser.username.charAt(0).toUpperCase()
  const roleName = currentUser.role === 'admin' ? 'מנהל' :
    currentUser.role === 'worker' ? 'עובד' : 'צופה'

  return (
    <>
      <SidebarMenu dir="rtl">
        <SidebarMenuItem dir="rtl">
          <DropdownMenu dir="rtl">
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <Avatar className="h-8 w-8 rounded-lg grayscale">
                  <AvatarFallback className="rounded-lg ">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-right text-sm leading-tight" dir="rtl">
                  <span className="truncate font-medium">{currentUser.username}</span>
                </div>
                <IconDotsVertical className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              side={isMobile ? "bottom" : "left"}
              align="start"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-right text-sm" dir="rtl">
                <Avatar className="h-8 w-8 rounded-lg grayscale">
                        <AvatarFallback className="rounded-lg ">
                          {userInitials}
                        </AvatarFallback>
                      </Avatar>

                  <div className="grid flex-1  text-sm">
                    <div className="flex items-center justify-start gap-2">
                      <span className="truncate font-medium">{currentUser.username}</span>
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
              <DropdownMenuGroup>
                <DropdownMenuItem 
                  className="flex justify-between items-center" 
                  dir="rtl"
                  onClick={openProfileModal}
                >
                  <span>פרופיל אישי</span>
                  <IconUserCircle className="mr-2" />
                </DropdownMenuItem>
                <DropdownMenuItem className="flex justify-between items-center" dir="rtl" asChild>
                  <Link to="/settings">
                    <span>הגדרות</span>
                    <IconSettings className="mr-2" />
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="flex justify-between items-center text-red-600 hover:text-red-700"
                onClick={handleLogout}
                dir="rtl"
              >
                <span>התנתק</span>
                <IconLogout className="mr-2" />
              </DropdownMenuItem>
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
          <div className="space-y-4 pb-4" dir="rtl">
            <div className="flex items-center gap-4 rounded-lg">
              <Avatar className="h-16 w-16 rounded-lg">
                <AvatarFallback className="rounded-lg text-lg font-semibold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-right">
                <h3 className="font-semibold text-lg">{currentUser.username}</h3>
                <Badge variant={
                  currentUser.role === 'admin' ? 'default' : 
                  currentUser.role === 'worker' ? 'secondary' : 
                  'outline'
                } className="mt-1">
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
                  {currentUser.password ? 'מוגן בסיסמה' : 'ללא סיסמה'}
                </span>
              </div>
            </div>
            
          </div>
        </CustomModal>
      )}
    </>
  )
}
