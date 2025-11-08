"use client"

import * as React from "react"
import { type Icon } from "@tabler/icons-react"
import { useLocation } from "@tanstack/react-router"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { GuardedRouterLink } from "@/components/GuardedRouterLink"

export function NavSecondary({
  items,
  ...props
}: {
  items: {
    title: string
    url: string
    icon: Icon
  }[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
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
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive = isRouteActive(item.url)
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild isActive={!!isActive}>
                  <GuardedRouterLink to={item.url}>
                    <item.icon />
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
