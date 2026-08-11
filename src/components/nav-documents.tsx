"use client";

import React from "react";
import { type Icon } from "@tabler/icons-react";
import { useLocation } from "@tanstack/react-router";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { GuardedRouterLink } from "@/components/GuardedRouterLink";
import { type SidebarQuickAction } from "@/components/sidebar-quick-actions";
import { useTranslation } from "react-i18next";

export function NavDocuments({
  items,
  renderQuickAction,
}: {
  items: {
    name: string;
    url: string;
    icon: Icon;
    quickAction?: SidebarQuickAction;
  }[];
  renderQuickAction?: (action: SidebarQuickAction) => React.ReactNode;
}) {
  const { t } = useTranslation();
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
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>{t("documents")}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const isActive = isRouteActive(item.url);
          return (
            <SidebarMenuItem key={item.name}>
              <SidebarMenuButton asChild isActive={!!isActive}>
                <GuardedRouterLink to={item.url}>
                  <item.icon />
                  <span>{item.name}</span>
                </GuardedRouterLink>
              </SidebarMenuButton>
              {item.quickAction && renderQuickAction?.(item.quickAction)}
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
