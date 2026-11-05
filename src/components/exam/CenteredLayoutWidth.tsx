import { useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useLayoutWidth } from "@/hooks/exam/useLayoutWidth";

export function CenteredLayoutWidth({ layoutWidthPx, sideInsetPx = 0, onChange, children }: {
  layoutWidthPx?: number;
  sideInsetPx?: number;
  onChange: (width: number | undefined) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const container = useRef<HTMLDivElement>(null);
  const { ref, maxWidth } = useLayoutWidth(layoutWidthPx, sideInsetPx);
  const drag = useRef<{ x: number; width: number; max: number; side: number } | null>(null);
  const clamp = (value: number, max: number) => Math.round(Math.max(Math.min(320, max), Math.min(max, value)));
  return (
    <div ref={container} className="w-full">
      <div ref={ref} data-layout-width className="relative mx-auto w-full" style={{ maxWidth }}>
        {children}
        {([-1, 1] as const).map(side => (
          <div
            key={side}
            role="separator"
            aria-orientation="vertical"
            aria-label={t(side === -1 ? "examPreview.resizeLeft" : "examPreview.resizeRight")}
            aria-valuemin={320}
            aria-valuemax={10000}
            aria-valuenow={maxWidth}
            tabIndex={0}
            className="group absolute inset-y-0 z-30 w-4 touch-none cursor-ew-resize select-none rounded focus-visible:outline-none"
            style={side === -1 ? { left: -8 } : { right: -8 }}
            onPointerDown={event => {
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.setPointerCapture(event.pointerId);
              const max = container.current?.clientWidth ?? 320;
              drag.current = { x: event.clientX, width: Math.min(maxWidth ?? max, max), max, side };
            }}
            onPointerMove={event => {
              const bounds = event.currentTarget.getBoundingClientRect();
              const gripTop = Math.max(0, Math.min(bounds.height - 40, event.clientY - bounds.top - 20));
              event.currentTarget.style.setProperty("--layout-grip-y", `${gripTop}px`);
              const start = drag.current;
              if (start) onChange(clamp(start.width + 2 * (event.clientX - start.x) * start.side, start.max));
            }}
            onPointerUp={event => {
              drag.current = null;
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={() => { drag.current = null; }}
            onLostPointerCapture={() => { drag.current = null; }}
            onKeyDown={event => {
              if (!["ArrowLeft", "ArrowRight", "Home"].includes(event.key)) return;
              event.preventDefault();
              const max = container.current?.clientWidth ?? 320;
              onChange(event.key === "Home" ? undefined : clamp(Math.min(maxWidth ?? max, max) + (event.key === "ArrowLeft" ? -side : side) * (event.shiftKey ? 40 : 8), max));
            }}
          >
            <div
              className="pointer-events-none absolute left-1/2 h-10 w-1 -translate-x-1/2 rounded-full bg-primary/60 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-active:opacity-100"
              style={{ top: "var(--layout-grip-y, 16px)" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
