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
} from "@tabler/icons-react"
import { Link } from "@tanstack/react-router"

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
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
import { User } from "@/lib/db/schema"

const getNavData = (currentUser?: User) => ({
  navMain: [
    {
      title: "דשבורד",
      url: "/",
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
    ...(currentUser?.role === 'admin' ? [{
      title: "יומן נוכחות",
      url: "/worker-stats",
      icon: IconChartLine,
    }, {
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
      name: "עדשות מגע",
      url: "/contact-lenses",
      icon: IconCircleDot,
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
      name: "קבצים",
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
  ...props 
}: React.ComponentProps<typeof Sidebar> & { 
  clinicName?: string;
  currentUser?: User;
  logoPath?: string | null;
  isLogoLoaded?: boolean;
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

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link to="/">
                {hasLogo ? (
                  <img 
                    src={logoPath} 
                    alt="לוגו המרפאה" 
                    className={cn(
                      "!size-8 rounded object-cover",
                      state === 'expanded' && 'transition-opacity duration-300',
                      isLogoLoaded && isLogoVisible ? "opacity-100" : "opacity-0"
                    )}
                  />
                ) : (
                  <IconInnerShadowTop className="!size-5" />
                )}
                <span className="text-base font-semibold">{clinicName || ""}</span>
              </Link>
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
