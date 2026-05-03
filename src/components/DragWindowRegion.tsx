import React, { type ReactNode } from "react";
import { GlobalSearch } from "@/components/GlobalSearch";
import { useLocation } from "@tanstack/react-router";
import prysmLogo from "@/assets/images/prysm-logo.png";

interface DragWindowRegionProps {
  title?: ReactNode;
}

export default function DragWindowRegion({ title }: DragWindowRegionProps) {
  const location = useLocation();
  
  // Only show search bar when in clinic routes (we'll handle user context in GlobalSearch)
  const clinicRoutes = ['/dashboard', '/clients', '/exams', '/orders', '/appointments', '/settings', '/campaigns', '/files', '/referrals', '/ai-assistant', '/exam-layouts', '/worker-stats', '/second-page'];
  const shouldShowSearch = clinicRoutes.some(route =>
    location.pathname.startsWith(route)
  );
  
  return (
    <div className="bg-secondary border-sidebar-border">
      <div
        className="bg-secondary flex w-screen items-center h-8 relative"
        style={{
          paddingRight:
            "calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw))",
        }}
      >
        <div className="draglayer flex-1 bg-secondary px-1 flex items-center gap-2">
          {title && (
            <div className="flex items-center select-none whitespace-nowrap text-[16px] text-sidebar-foreground/70 font-medium px-2">
              {title}
            </div>
          )}
        </div>
        {shouldShowSearch && (
          <div className="absolute left-1/2 transform -translate-x-1/2 pointer-events-auto z-10" style={{ pointerEvents: 'auto', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <GlobalSearch />
          </div>
        )}
        <div className="draglayer flex h-full pt-[6px] items-center bg-transparent px-3">
          <span className="select-none text-[17px] pt-[2px] font-semibold text-sidebar-foreground">
            Prysm
          </span>
          <img
            src={prysmLogo}
            alt="Prysm Logo"
            className="h-6 w-9 select-none object-contain"
            draggable={false}
          />

        </div>
      </div>
    </div>
  );
}
