import React, { useEffect, useState, type ReactNode } from "react";
import { GlobalSearch } from "@/components/GlobalSearch";
import { useLocation } from "@tanstack/react-router";
import prysmLogo from "@/assets/images/prysm-logo.png";

interface DragWindowRegionProps {
  title?: ReactNode;
}

type WindowControlsSide = "left" | "right";

interface WindowControlsOverlay {
  getTitlebarAreaRect: () => DOMRect;
  addEventListener: (type: "geometrychange", listener: EventListener) => void;
  removeEventListener: (type: "geometrychange", listener: EventListener) => void;
}

function getWindowControlsOverlay() {
  return (navigator as Navigator & { windowControlsOverlay?: WindowControlsOverlay }).windowControlsOverlay;
}

function getWindowControlsSide(): WindowControlsSide {
  const overlay = getWindowControlsOverlay();
  if (!overlay) return "left";

  const rect = overlay.getTitlebarAreaRect();
  const viewportWidth = window.innerWidth;

  if (rect.x > 0) return "left";
  if (rect.x + rect.width < viewportWidth - 1) return "right";

  return "left";
}

function useWindowControlsSide(): WindowControlsSide {
  const [controlsSide, setControlsSide] = useState<WindowControlsSide>(() =>
    typeof navigator === "undefined" ? "left" : getWindowControlsSide()
  );

  useEffect(() => {
    const updateControlsSide = () => setControlsSide(getWindowControlsSide());
    const overlay = getWindowControlsOverlay();

    updateControlsSide();
    overlay?.addEventListener("geometrychange", updateControlsSide);
    window.addEventListener("resize", updateControlsSide);

    return () => {
      overlay?.removeEventListener("geometrychange", updateControlsSide);
      window.removeEventListener("resize", updateControlsSide);
    };
  }, []);

  return controlsSide;
}

function BrandMark() {
  return (
    <div className="draglayer flex h-full items-center gap-2 bg-transparent px-3 pt-[6px]">
      <span className="select-none pt-[2px] text-[17px] font-semibold text-sidebar-foreground">
        Prysm
      </span>
      <img
        src={prysmLogo}
        alt="Prysm Logo"
        className="h-6 w-9 select-none object-contain"
        draggable={false}
      />
    </div>
  );
}

export default function DragWindowRegion({ title }: DragWindowRegionProps) {
  const location = useLocation();
  const controlsSide = useWindowControlsSide();
  
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
          paddingLeft: "env(titlebar-area-x, 0px)",
          paddingRight:
            "calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw))",
        }}
      >
        {controlsSide === "right" && <BrandMark />}
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
        {controlsSide === "left" && <BrandMark />}
      </div>
    </div>
  );
}
