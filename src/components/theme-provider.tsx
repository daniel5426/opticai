import React, { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { getAppearanceStore } from "@/lib/appearance";

function useAppearanceState() {
  const store = getAppearanceStore();
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return useMemo(() => ({
    ...state,
    theme: state.mode,
    setTheme: store.setMode,
    setStyle: store.setStyle,
    setPalette: store.setPalette,
    previewPalette: store.previewPalette,
    setCanvasElevation: store.setCanvasElevation,
    setCanvasGradient: store.setCanvasGradient,
    previewCanvasGradient: store.previewCanvasGradient,
  }), [state, store]);
}

const ThemeProviderContext = createContext<ReturnType<typeof useAppearanceState> | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const store = getAppearanceStore();
  const value = useAppearanceState();
  useEffect(() => store.connect(), [store]);
  return <ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeProviderContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
}
