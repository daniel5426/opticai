import * as React from "react";

import {
  type AnalyticsPreset,
  type AnalyticsRange,
  normalizeAnalyticsRange,
} from "@/lib/analytics";

const VALID_PRESETS = new Set<AnalyticsPreset>(["7d", "30d", "90d", "365d", "custom"]);

function readRange(defaultPreset: Exclude<AnalyticsPreset, "custom">): AnalyticsRange {
  const params = new URLSearchParams(window.location.search);
  const rawPreset = params.get("range") as AnalyticsPreset | null;
  const preset = rawPreset && VALID_PRESETS.has(rawPreset) ? rawPreset : defaultPreset;
  return normalizeAnalyticsRange(preset, params.get("from"), params.get("to"), defaultPreset);
}

export function useAnalyticsRange(defaultPreset: Exclude<AnalyticsPreset, "custom"> = "30d") {
  const [range, setRangeState] = React.useState<AnalyticsRange>(() => readRange(defaultPreset));

  React.useEffect(() => {
    const onPopState = () => setRangeState(readRange(defaultPreset));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [defaultPreset]);

  const setRange = React.useCallback((next: AnalyticsRange) => {
    const params = new URLSearchParams(window.location.search);
    params.set("range", next.preset);
    if (next.preset === "custom") {
      params.set("from", next.startDate);
      params.set("to", next.endDate);
    } else {
      params.delete("from");
      params.delete("to");
    }
    const query = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    setRangeState(next);
  }, []);

  return { range, setRange };
}
