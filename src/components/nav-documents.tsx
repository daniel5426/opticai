"use client"

import React from "react"
import {
  type Icon,
} from "@tabler/icons-react"
import { useLocation } from "@tanstack/react-router"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { GuardedRouterLink } from "@/components/GuardedRouterLink"

export function NavDocuments({
  items,
}: {
  items: {
    name: string
    url: string
    icon: Icon
  }[]
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
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>פרטים</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const isActive = isRouteActive(item.url)
          return (
            <SidebarMenuItem key={item.name}>
              <SidebarMenuButton asChild isActive={!!isActive}>
                <GuardedRouterLink to={item.url}>
                  <item.icon />
                  <span>{item.name}</span>
                </GuardedRouterLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
