import * as React from "react"
import {
  IconDashboard,
  IconUsers,
  IconBuilding,
  IconSettings,
  IconHelp,
  IconSearch,
  IconInnerShadowTop,
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
import { User, Company } from "@/lib/db/schema"

const getControlCenterNavData = () => ({
  navMain: [
    {
      title: "לוח בקרה",
      url: "/control-center/dashboard",
      icon: IconDashboard,
    },
    {
      title: "משתמשים",
      url: "/control-center/users",
      icon: IconUsers,
    },
    {
      title: "מרפאות",
      url: "/control-center/clinics",
      icon: IconBuilding,
    },
  ],
  navSecondary: [
    {
      title: "הגדרות",
      url: "/control-center/settings",
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
})

export function ControlCenterSidebar({ 
  company, 
  currentUser,
  ...props 
}: React.ComponentProps<typeof Sidebar> & { 
  company?: Company;
  currentUser?: User;
}) {
  const { state } = useSidebar()

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link to="/control-center/dashboard">
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold">{company?.name || "מרכז בקרה"}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={getControlCenterNavData().navMain} />
        <NavSecondary items={getControlCenterNavData().navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser currentUser={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
} 