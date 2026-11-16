import type React from "react";

// Tab runs down the eyes: right AX goes to the left eye, skipping REFLEX and the PDs, and left AX to the combined PD.
const NEXT: Record<string, string> = { "r-ax": "l-sph", "l-ax": "c-pd_far" };
const BACK: Record<string, string> = { "l-sph": "r-ax", "c-pd_far": "l-ax" };

export function handleRetinoscopyTabStops(event: React.KeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return;
  const from = (event.target as HTMLElement).dataset?.tabStop ?? "";
  const target = (event.shiftKey ? BACK : NEXT)[from];
  const next = target ? event.currentTarget.querySelector<HTMLInputElement>(`[data-tab-stop="${target}"]`) : null;
  if (!next || next.disabled) return;
  event.preventDefault();
  next.focus();
  if (next.value) next.select();
}
