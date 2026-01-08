import * as React from "react"
import {
  IconCamera,
  IconChartBar,
  IconDashboard,
  IconDatabase,
  IconFileAi,
  IconFileDescription,
  IconFileWord,
  IconFolder,
  IconHelp,
  IconInnerShadowTop,
  IconListDetails,
  IconReport,
  IconSearch,
  IconSettings,
  IconUsers,
  IconEye,
  IconShoppingCart,
  IconCircleDot,
  IconArrowForward,
  IconCalendar,
  IconRobot,
  IconFiles,
  IconLayoutGrid,
  IconChartLine,
  IconUserCog,
} from "@tabler/icons-react"
import { Link } from "@tanstack/react-router"

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import { ClinicDropdown } from "@/components/clinic-dropdown"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/utils/tailwind"
import { User, Clinic } from "@/lib/db/schema-interface"
import { ROLE_LEVELS, isRoleAtLeast } from "@/lib/role-levels"
import { useUser } from "@/contexts/UserContext"

const getNavData = (currentUser?: User) => ({
  navMain: [
    {
      title: "יומן",
      url: "/dashboard",
      icon: IconDashboard,
    },
    {
      title: "לקוחות",
      url: "/clients",
      icon: IconUsers,
    },
    {
      title: "עוזר חכם",
      url: "/ai-assistant",
      icon: IconRobot,
    },
    {
      title: "יומן נוכחות",
      url: "/worker-stats",
      icon: IconChartLine,
    },
    ...(isRoleAtLeast(currentUser?.role_level, ROLE_LEVELS.manager) ? [{
      title: "קמפיינים",
      url: "/campaigns",
      icon: IconChartBar,
    }] : [])
  ],
  navSecondary: [
    {
      title: "הגדרות",
      url: "/settings",
      icon: IconSettings,
    },
    {
      title: "קבלת עזרה",
      url: "#",
      icon: IconHelp,
    },
    {
      title: "חיפוש",
      url: "#",
      icon: IconSearch,
    },
  ],
  documents: [
    {
      name: "בדיקות",
      url: "/exams",
      icon: IconEye,
    },
    {
      name: "הזמנות",
      url: "/orders",
      icon: IconShoppingCart,
    },
    {
      name: "הפניות",
      url: "/referrals",
      icon: IconArrowForward,
    },
    {
      name: "תורים",
      url: "/appointments",
      icon: IconCalendar,
    },
    {
      name: "מסמכים",
      url: "/files",
      icon: IconFiles,
    },
  ],
})

export function AppSidebar({ 
  clinicName, 
  currentUser,
  logoPath,
  isLogoLoaded,
  currentClinic,
  ...props 
}: React.ComponentProps<typeof Sidebar> & { 
  clinicName?: string;
  currentUser?: User;
  logoPath?: string | null;
  isLogoLoaded?: boolean;
  currentClinic?: Clinic | null;
}) {
  const { state } = useSidebar()
  const hasLogo = logoPath;
  const [isLogoVisible, setIsLogoVisible] = React.useState(false)

  React.useEffect(() => {
    if (state === 'collapsed') {
      setIsLogoVisible(false);
    } else if (state === 'expanded' && isLogoLoaded) {
      const timer = setTimeout(() => {
        setIsLogoVisible(true);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [state, isLogoLoaded])

  const clinicHeaderContent = (
    <>
      {hasLogo && (
        <img 
          src={logoPath} 
          alt="לוגו המרפאה" 
          className={cn(
            "max-h-10 h-auto w-auto rounded object-contain",
            state === 'expanded' && 'transition-opacity duration-300',
            isLogoLoaded && isLogoVisible ? "opacity-100" : "opacity-0"
          )}
        />
      ) }
      <span className="text-base self-center font-semibold whitespace-normal break-words leading-tight text-right max-w-full">{clinicName || ""}</span>
    </>
  )

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu className="ring-0 border-0">
          <SidebarMenuItem className="ring-0 border-0">
          <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5 !h-auto ring-0 border-0 min-h-5 items-start"
            >
              <div>
                <ClinicDropdown
                  currentClinic={currentClinic}
                  clinicName={clinicName}
                  logoPath={logoPath}
                  isLogoLoaded={true}
                >
                  <div className="flex items-start gap-2 w-full max-w-full min-w-0 overflow-hidden ring-0 border-0">
                    {clinicHeaderContent}
                  </div>
                </ClinicDropdown>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={getNavData(currentUser).navMain} />
        <NavDocuments items={getNavData(currentUser).documents} />
        <NavSecondary items={getNavData(currentUser).navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser currentUser={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}
