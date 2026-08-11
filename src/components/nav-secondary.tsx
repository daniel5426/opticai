"use client";

import * as React from "react";
import { type Icon } from "@tabler/icons-react";
import { useLocation } from "@tanstack/react-router";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { GuardedRouterLink } from "@/components/GuardedRouterLink";

export function NavSecondary({
  items,
  ...props
}: {
  items: {
    title: string;
    icon: Icon;
    url?: string;
    onClick?: () => void;
  }[];
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const location = useLocation();

  const normalizePath = (path: string) => {
    if (!path || path === "/") return "/";
    return path.replace(/\/+$/, "");
  };

  const isRouteActive = (url: string) => {
    const normalizedTarget = normalizePath(url);
    const currentPath = normalizePath(location.pathname);

    if (normalizedTarget === "/") {
      return currentPath === "/";
    }
    return (
      currentPath === normalizedTarget ||
      currentPath.startsWith(`${normalizedTarget}/`)
    );
  };

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive = item.url ? isRouteActive(item.url) : false;
            const isExternal = item.url ? /^https?:\/\//.test(item.url) : false;
            const openExternal = async (
              event: React.MouseEvent<HTMLAnchorElement>,
            ) => {
              event.preventDefault();
              if (!item.url) return;
              if (window.electronAPI?.openUrlInChrome) {
                await window.electronAPI.openUrlInChrome(item.url);
                return;
              }
              window.open(item.url, "_blank", "noopener,noreferrer");
            };
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild isActive={!!isActive}>
                  {item.onClick ? (
                    <button type="button" onClick={item.onClick}>
                      <item.icon />
                      <span>{item.title}</span>
                    </button>
                  ) : isExternal ? (
                    <a href={item.url} onClick={openExternal}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  ) : (
                    <GuardedRouterLink to={item.url!}>
                      <item.icon />
                      <span>{item.title}</span>
                    </GuardedRouterLink>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
