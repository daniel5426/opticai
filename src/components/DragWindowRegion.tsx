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
  removeEventListener: (
    type: "geometrychange",
    listener: EventListener,
  ) => void;
}

function getWindowControlsOverlay() {
  return (
    navigator as Navigator & { windowControlsOverlay?: WindowControlsOverlay }
  ).windowControlsOverlay;
}

function getFallbackWindowControlsSide(): WindowControlsSide {
  return navigator.userAgent.includes("Windows") ? "right" : "left";
}

function getWindowControlsSide(): WindowControlsSide {
  const overlay = getWindowControlsOverlay();
  if (!overlay) return getFallbackWindowControlsSide();

  const rect = overlay.getTitlebarAreaRect();
  const viewportWidth = window.innerWidth;

  if (rect.x > 0) return "left";
  if (rect.x + rect.width < viewportWidth - 1) return "right";

  return getFallbackWindowControlsSide();
}

function useWindowControlsSide(): WindowControlsSide {
  const [controlsSide, setControlsSide] = useState<WindowControlsSide>(() =>
    typeof navigator === "undefined" ? "left" : getWindowControlsSide(),
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
    <div className="draglayer flex h-full items-center bg-transparent px-3 pt-[6px]">
      <img
        src={prysmLogo}
        alt="Prysm Logo"
        className="h-6 w-9 object-contain select-none"
        draggable={false}
      />
      <span className="text-sidebar-foreground pt-[2px] text-[17px] font-semibold select-none">
        Prysm
      </span>
    </div>
  );
}

export default function DragWindowRegion({ title }: DragWindowRegionProps) {
  const location = useLocation();
  const controlsSide = useWindowControlsSide();

  const hiddenSearchRoutes = [
    "/control-center",
    "/user-selection",
    "/auth/callback",
    "/oauth/callback",
  ];
  const shouldShowSearch = !hiddenSearchRoutes.some((route) =>
    location.pathname.startsWith(route),
  );

  return (
    <div className="bg-secondary border-sidebar-border">
      <div
        dir="ltr"
        className="bg-secondary relative flex h-8 w-screen items-center"
        style={
          {
            paddingLeft: "env(titlebar-area-x, 0px)",
            paddingRight:
              "calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw))",
            WebkitAppRegion: "drag",
          } as React.CSSProperties
        }
      >
        {controlsSide === "right" && <BrandMark />}
        <div className="draglayer bg-secondary flex flex-1 items-center gap-2 px-1">
          {title && (
            <div className="text-sidebar-foreground/70 flex items-center px-2 text-[16px] font-medium whitespace-nowrap select-none">
              {title}
            </div>
          )}
        </div>
        {shouldShowSearch && (
          <div
            className="pointer-events-auto absolute left-1/2 z-10 -translate-x-1/2 transform"
            style={
              {
                pointerEvents: "auto",
                WebkitAppRegion: "no-drag",
              } as React.CSSProperties
            }
          >
            <GlobalSearch />
          </div>
        )}
        {controlsSide === "left" && <BrandMark />}
      </div>
    </div>
  );
}
