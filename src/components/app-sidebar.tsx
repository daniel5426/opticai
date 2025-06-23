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
} from "@/components/ui/sidebar"
import { cn } from "@/utils/tailwind"
import { User } from "@/lib/db/schema"

const data = {
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
    }
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "/settings",
      icon: IconSettings,
    },
    {
      title: "Get Help",
      url: "#",
      icon: IconHelp,
    },
    {
      title: "Search",
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
  ],
}

export function AppSidebar({ 
  clinicName, 
  currentUser, 
  ...props 
}: React.ComponentProps<typeof Sidebar> & { 
  clinicName?: string;
  currentUser?: User;
}) {
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
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold">{clinicName || "אופטיקל קליניק"}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavDocuments items={data.documents} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser currentUser={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}
