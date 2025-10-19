import React from "react"
import { IconCirclePlusFilled, IconMail, type Icon } from "@tabler/icons-react"
import { Link } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

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
  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {showAddClientButton && (
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="לקוח חדש"
              className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground min-w-8 duration-200 ease-linear"
            >
              <Link to="/clients/new">
                <IconCirclePlusFilled />
                <span>לקוח חדש</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          )}
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild tooltip={item.title}>
                <Link to={item.url}>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
