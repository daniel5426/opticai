import { Triangle } from "lucide-react";
import { cn } from "@/utils/tailwind";

export const PRISM_DELTA_SUFFIXES = new Set(["Δ", "△", "∆"]);
export const PRISM_DELTA_ICON_SIZE = 13;

export const isPrismDeltaSuffix = (suffix?: string | null) =>
  Boolean(suffix && PRISM_DELTA_SUFFIXES.has(suffix));

export function PrismDeltaIcon({ className }: { className?: string }) {
  return (
    <Triangle
      size={PRISM_DELTA_ICON_SIZE}
      strokeWidth={2}
      className={cn("text-muted-foreground shrink-0", className)}
      aria-hidden
    />
  );
}
