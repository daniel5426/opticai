import React, { type ReactNode } from "react";
import { ModeToggle } from "@/components/mode-toggle";
import { GlobalSearch } from "@/components/GlobalSearch";
import { RotateCcw } from "lucide-react";
import { useLocation } from "@tanstack/react-router";
import prysmLogo from "@/assets/images/prysm-logo.png";

interface DragWindowRegionProps {
  title?: ReactNode;
}



export default function DragWindowRegion({ title }: DragWindowRegionProps) {
  const location = useLocation();
  
  // Only show search bar when in clinic routes (we'll handle user context in GlobalSearch)
  const clinicRoutes = ['/dashboard', '/clients', '/exams', '/orders', '/appointments', '/settings', '/campaigns', '/files', '/referrals', '/contact-lenses', '/ai-assistant', '/exam-layouts', '/worker-stats', '/second-page'];
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
          <img 
            src={prysmLogo} 
            alt="Prysm Logo" 
            className="h-5 w-9 pl-1 object-contain"
          />
          <span className="text-[16px] font-semibold ml-[-10px] pt-[1px] text-sidebar-foreground select-none">
            Prysm
          </span>
          {title && (
            <div className="flex items-center select-none whitespace-nowrap text-[16px] text-sidebar-foreground/70 font-medium ml-4">
              {title}
            </div>
          )}
        </div>
        {shouldShowSearch && (
          <div className="absolute left-1/2 transform -translate-x-1/2 pointer-events-auto z-10" style={{ pointerEvents: 'auto', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <GlobalSearch />
          </div>
        )}
        <div className="draglayer flex items-center bg-transparent">
          <ModeToggle />
          <RefreshButton />
        </div>
      </div>
    </div>
  );
}

function RefreshButton() {
  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <button
      title="Refresh App"
      type="button"
      className="flex items-center justify-center w-10 h-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
      onClick={handleRefresh}
    >
      <RotateCcw className="h-4 w-4" />
    </button>
  );
}
