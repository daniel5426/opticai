import {
  closeWindow,
  maximizeWindow,
  minimizeWindow,
} from "@/helpers/window_helpers";
import React, { type ReactNode } from "react";
import { ModeToggle } from "@/components/mode-toggle";

interface DragWindowRegionProps {
  title?: ReactNode;
}

export default function DragWindowRegion({ title }: DragWindowRegionProps) {
  return (
    <div className="bg-secondary border-sidebar-border">
      <div className="flex w-screen items-center h-8">
        <div className="draglayer flex-1 bg-secondary px-3">
          {title && (
            <div className="flex items-center select-none whitespace-nowrap text-sm text-sidebar-foreground/70 font-medium">
              {title}
            </div>
          )}
        </div>
        <div className="flex items-center">
          <ModeToggle />
          <WindowButtons />
        </div>
      </div>
    </div>
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
        className="flex items-center justify-center w-10 h-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-red-500 hover:text-white transition-colors"
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
