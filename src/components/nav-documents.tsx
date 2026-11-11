"use client";

import React from "react";
import { type Icon } from "@tabler/icons-react";
import { useSidebarActive } from "@/components/use-sidebar-active";

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
  const isRouteActive = useSidebarActive(items.map((item) => item.url));

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
