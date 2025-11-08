import React from "react"
import { IconCirclePlusFilled, IconMail, type Icon } from "@tabler/icons-react"
import { useLocation } from "@tanstack/react-router"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { GuardedRouterLink } from "@/components/GuardedRouterLink"

export function NavMain({
  items,
  showAddClientButton = true,
}: React.ComponentProps<typeof SidebarGroup> & {
  items: {
    title: string
    url: string;
    icon?: Icon;
  }[];
  showAddClientButton?: boolean;
}) {
  const location = useLocation()
  
  const normalizePath = (path: string) => {
    if (!path || path === "/") return "/"
    return path.replace(/\/+$/, "")
  }
  
  const isRouteActive = (url: string) => {
    const normalizedTarget = normalizePath(url)
    const currentPath = normalizePath(location.pathname)
    
    if (normalizedTarget === "/") {
      return currentPath === "/"
    }
    return currentPath === normalizedTarget || currentPath.startsWith(`${normalizedTarget}/`)
  }
  
  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {showAddClientButton && (
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="לקוח חדש"
              className="border border-black bg-card min-w-8"
            >
              <GuardedRouterLink to="/clients/new">
                <IconCirclePlusFilled />
                <span>לקוח חדש</span>
              </GuardedRouterLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          )}
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => {
            const isActive = isRouteActive(item.url)
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild tooltip={item.title} isActive={!!isActive}>
                  <GuardedRouterLink to={item.url}>
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                  </GuardedRouterLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
