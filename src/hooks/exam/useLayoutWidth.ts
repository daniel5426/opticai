import { useLayoutEffect, useRef, useState } from "react";

/** Resolve old gap-based layouts once; later container changes consume the gaps. */
export function useLayoutWidth(layoutWidthPx?: number, sideInsetPx = 0, identity?: string | number | null) {
  const ref = useRef<HTMLDivElement>(null);
  const [legacy, setLegacy] = useState<{ identity: typeof identity; inset: number; width: number }>();
  useLayoutEffect(() => {
    if (layoutWidthPx || !sideInsetPx || !ref.current) return;
    const available = ref.current.parentElement?.clientWidth ?? 0;
    if (available) setLegacy({ identity, inset: sideInsetPx, width: Math.max(320, available - sideInsetPx * 2) });
  }, [layoutWidthPx, sideInsetPx, identity]);
  return {
    ref,
    maxWidth: layoutWidthPx || (legacy?.identity === identity && legacy?.inset === sideInsetPx ? legacy.width : undefined),
  };
}
