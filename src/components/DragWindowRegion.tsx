import {
  closeWindow,
  maximizeWindow,
  minimizeWindow,
} from "@/helpers/window_helpers";
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
      <div className="bg-secondary flex w-screen items-center h-8 relative">
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
          <WindowButtons />
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

function WindowButtons() {
  return (
    <div className="flex">
      <button
        title="Minimize"
        type="button"
        className="flex items-center justify-center w-10 h-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        onClick={minimizeWindow}
      >
        <svg
          aria-hidden="true"
          role="img"
          width="10"
          height="10"
          viewBox="0 0 12 12"
        >
          <rect fill="currentColor" width="10" height="1" x="1" y="6"></rect>
        </svg>
      </button>
      <button
        title="Maximize"
        type="button"
        className="flex items-center justify-center w-10 h-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        onClick={maximizeWindow}
      >
        <svg
          aria-hidden="true"
          role="img"
          width="10"
          height="10"
          viewBox="0 0 12 12"
        >
          <rect
            width="9"
            height="9"
            x="1.5"
            y="1.5"
            fill="none"
            stroke="currentColor"
          ></rect>
        </svg>
      </button>
      <button
        type="button"
        title="Close"
        className="flex items-center justify-center w-10 h-8 text-sidebar-foreground/60 hover:bg-red-500 hover:text-white transition-colors"
        onClick={closeWindow}
      >
        <svg
          aria-hidden="true"
          role="img"
          width="10"
          height="10"
          viewBox="0 0 12 12"
        >
          <polygon
            fill="currentColor"
            fillRule="evenodd"
            points="11 1.576 6.583 6 11 10.424 10.424 11 6 6.583 1.576 11 1 10.424 5.417 6 1 1.576 1.576 1 6 5.417 10.424 1"
          ></polygon>
        </svg>
      </button>
    </div>
  );
}
