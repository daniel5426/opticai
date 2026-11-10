"use client";

import * as React from "react";
import { type Icon } from "@tabler/icons-react";
import { useSidebarActive } from "@/components/use-sidebar-active";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { GuardedRouterLink } from "@/components/GuardedRouterLink";
import { type SidebarQuickAction } from "@/components/sidebar-quick-actions";

export function NavSecondary({
  items,
  ...props
}: {
  items: {
    title: string;
    icon: Icon;
    url?: string;
    onClick?: () => void;
    quickAction?: SidebarQuickAction;
  }[];
  renderQuickAction?: (action: SidebarQuickAction) => React.ReactNode;
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const { renderQuickAction, ...groupProps } = props;
  const isRouteActive = useSidebarActive(items.map((item) => item.url));

  return (
    <SidebarGroup {...groupProps}>
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
                {item.quickAction && renderQuickAction?.(item.quickAction)}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
