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
import { User, Company, Clinic } from "@/lib/db/schema-interface"
import { useUser } from "@/contexts/UserContext"

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
    }
  ],
})

export function ControlCenterSidebar({ 
  company, 
  currentUser,
  currentClinic,
  ...props 
}: React.ComponentProps<typeof Sidebar> & { 
  company?: Company;
  currentUser?: User;
  currentClinic?: Clinic | null;
}) {
  const { state } = useSidebar()

  const companyHeaderContent = (
    <>
      <IconInnerShadowTop className="!size-5" />
      <span className="text-base font-semibold">{company?.name || "מרכז בקרה"}</span>
    </>
  )

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <ClinicDropdown
                currentClinic={currentClinic}
                clinicName={company?.name}
                logoPath={company?.logo_path}
                isLogoLoaded={true}
              >
                <div className="flex items-center gap-2">
                  {companyHeaderContent}
                </div>
              </ClinicDropdown>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={getControlCenterNavData().navMain} />
        <NavSecondary items={getControlCenterNavData().navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser currentUser={currentUser} showShiftControls={false} />
      </SidebarFooter>
    </Sidebar>
  )
} 