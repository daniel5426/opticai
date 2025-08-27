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

  const hasLogo = company?.logo_path
  const companyHeaderContent = (
    <>
      {hasLogo && (
        <img
          src={company?.logo_path || undefined}
          alt="לוגו החברה"
          className="max-h-10 h-auto w-auto rounded object-contain"
        />
      ) }
      <span className="text-base ring-0 border-0 font-semibold whitespace-normal break-words leading-tight text-right max-w-full">{company?.name || "מרכז בקרה"}</span>
    </>
  )

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5 !h-auto min-h-5 items-start"
            >
              <div>
                <ClinicDropdown
                  currentClinic={currentClinic}
                  clinicName={company?.name}
                  logoPath={company?.logo_path}
                  isLogoLoaded={true}
                >
                  <div className="flex items-start gap-2 w-full max-w-full min-w-0 overflow-hidden ring-0 border-0">
                    {companyHeaderContent}
                  </div>
                </ClinicDropdown>
              </div>
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