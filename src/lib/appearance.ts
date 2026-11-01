import { canvasGradientVariables, getCanvasGradientKey, isCanvasGradient, readCanvasGradient, type CanvasGradient } from "@/lib/canvas-gradient";
import type { ThemeMode } from "@/types/theme-mode";

export const APPEARANCE_STYLES = {
  classic: { labelKey: "appearanceClassic", supportsPalettes: true },
  pro: { labelKey: "appearancePro", supportsPalettes: false },
} as const;
export type AppearanceStyle = keyof typeof APPEARANCE_STYLES;
// Dark primaries are light tints so the dark --primary-foreground stays readable.
export const COLOR_THEMES = {
  blue: { primary: "#2256aa", sidebar: "#cce9ff", darkPrimary: "#8ab4f8", darkSidebar: "#0f1a2b", labelKey: "colorThemeClassicBlue" },
  bloom: { primary: "#2256aa", sidebar: "#e2e2e2", darkPrimary: "#8ab4f8", darkSidebar: "#1c1c1e", labelKey: "colorThemeBloomBlue" },
  ice: { primary: "#3f3f46", sidebar: "#e6f1f6", darkPrimary: "#a5c8d8", darkSidebar: "#0f181c", labelKey: "colorThemeIceBlue" },
  neutral: { primary: "#3f3f46", sidebar: "#f4f4f5", darkPrimary: "#e4e4e7", darkSidebar: "#18181b", labelKey: "colorThemeGraphite" },
  forest: { primary: "#386451", sidebar: "#e7f2eb", darkPrimary: "#8fc5a8", darkSidebar: "#0f1a15", labelKey: "colorThemeForest" },
  bronze: { primary: "#87613f", sidebar: "#f7eee4", darkPrimary: "#d6ad85", darkSidebar: "#1c150f", labelKey: "colorThemeBronze" },
  plum: { primary: "#65516f", sidebar: "#f1e9f4", darkPrimary: "#c4a8d4", darkSidebar: "#19131c", labelKey: "colorThemePlum" },
  monochrome: { primary: "#0a0a0a", sidebar: "#f5f5f5", darkPrimary: "#fafafa", darkSidebar: "#0a0a0a", labelKey: "colorThemeMonochrome" },
  openai: { primary: "#0f766e", sidebar: "#e7f5f2", darkPrimary: "#5eead4", darkSidebar: "#0c1a18", labelKey: "colorThemeOpenAI" },
} as const;
export type ColorTheme = keyof typeof COLOR_THEMES;
export type CanvasElevation = "flat" | "lift";

export interface AppearanceState {
  mode: ThemeMode;
  style: AppearanceStyle;
  palette: ColorTheme;
  resolvedMode: "light" | "dark";
  userId?: number;
  previewPalette: ColorTheme | null;
  canvasGradient: CanvasGradient | null;
  previewCanvasGradient: CanvasGradient | null | undefined;
  canvasElevation: CanvasElevation;
}

type AppearanceStorage = Pick<Storage, "getItem" | "setItem">;
interface NativeTheme {
  light: () => Promise<unknown>;
  dark: () => Promise<unknown>;
  system: () => Promise<unknown>;
}
interface AppearanceEnvironment {
  storage: AppearanceStorage;
  root: HTMLElement;
  media: MediaQueryList;
  nativeTheme?: () => NativeTheme | undefined;
}

export const getUserThemeKey = (id: number) => `user_theme_${id}`;
export const getColorThemeKey = (id: number) => `user_color_theme_${id}`;
export const getStyleKey = (id?: number) => id === undefined ? "appearance_style" : `user_appearance_style_${id}`;
export const getCanvasElevationKey = (id?: number) => id === undefined ? "appearance_canvas_elevation" : `user_canvas_elevation_${id}`;
export const isThemeMode = (value: unknown): value is ThemeMode =>
  value === "light" || value === "dark" || value === "system";
export const isAppearanceStyle = (value: unknown): value is AppearanceStyle =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(APPEARANCE_STYLES, value);
export const isColorTheme = (value: unknown): value is ColorTheme =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(COLOR_THEMES, value);
export const isCanvasElevation = (value: unknown): value is CanvasElevation =>
  value === "flat" || value === "lift";

export function readCanvasElevation(storage: AppearanceStorage, userId?: number): CanvasElevation {
  const value = readAppearanceValue(storage, getCanvasElevationKey(userId));
  return isCanvasElevation(value) ? value : "lift";
}

export function readAppearanceValue(storage: AppearanceStorage, key: string): string | null {
  try { return storage.getItem(key); } catch { return null; }
}

function writeValue(storage: AppearanceStorage, key: string, value: string) {
  // Restricted storage must not prevent appearance changes in the current session.
  try { storage.setItem(key, value); } catch { /* best-effort persistence */ }
}

export function resolveAppearance(storage: AppearanceStorage, userId?: number, savedMode?: unknown) {
  const candidates = [
    savedMode,
    userId === undefined ? null : readAppearanceValue(storage, getUserThemeKey(userId)),
    readAppearanceValue(storage, "vite-ui-theme"),
    readAppearanceValue(storage, "theme"),
  ];
  const mode = candidates.find(isThemeMode) ?? "system";
  const style = readAppearanceValue(storage, getStyleKey(userId));
  const palette = readAppearanceValue(storage, userId === undefined ? "color_theme" : getColorThemeKey(userId));
  return {
    mode,
    style: isAppearanceStyle(style) ? style : "classic",
    palette: isColorTheme(palette) ? palette : "neutral",
  };
}

function hexToHsl(hex: string): string {
  const [r, g, b] = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0, saturation = 0;
  if (delta !== 0) {
    saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    hue = max === r ? (g - b) / delta + (g < b ? 6 : 0)
      : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
    hue /= 6;
  }
  return `${Math.round(hue * 360)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
}

/** The only owner of document appearance. React and legacy helpers share this store. */
export function createAppearanceStore(environment: AppearanceEnvironment) {
  const { storage, root, media } = environment;
  const resolveMode = (mode: ThemeMode) => mode === "system" ? (media.matches ? "dark" : "light") : mode;
  let state: AppearanceState = { ...resolveAppearance(storage), resolvedMode: "light", previewPalette: null, canvasGradient: readCanvasGradient(storage), previewCanvasGradient: undefined, canvasElevation: readCanvasElevation(storage) };
  state.resolvedMode = resolveMode(state.mode);
  const listeners = new Set<() => void>();
  let nativeQueue = Promise.resolve();
  let nativeRevision = 0;

  const apply = () => {
    root.dataset.style = state.style;
    root.dataset.palette = state.previewPalette ?? state.palette;
    root.classList.toggle("dark", state.resolvedMode === "dark");
    root.classList.toggle("light", state.resolvedMode === "light");
    root.style.colorScheme = state.resolvedMode;
    const gradient = state.previewCanvasGradient === undefined ? state.canvasGradient : state.previewCanvasGradient;
    root.dataset.canvasGradient = gradient ? "custom" : "default";
    root.dataset.canvasElevation = state.canvasElevation;
    for (const token of ["--canvas-gradient-base", "--canvas-gradient-image"]) root.style.removeProperty(token);
    if (gradient) {
      for (const [token, value] of Object.entries(canvasGradientVariables(gradient))) root.style.setProperty(token, value);
    }
    // Inline Classic accents must never override a complete Pro skin.
    for (const token of ["--primary", "--sidebar", "--muted", "--accent"]) root.style.removeProperty(token);
    if (APPEARANCE_STYLES[state.style].supportsPalettes) {
      const colors = COLOR_THEMES[state.previewPalette ?? state.palette];
      const dark = state.resolvedMode === "dark";
      root.style.setProperty("--primary", hexToHsl(dark ? colors.darkPrimary : colors.primary));
      root.style.setProperty("--sidebar", `hsl(${hexToHsl(dark ? colors.darkSidebar : colors.sidebar)})`);
    }
  };

  const syncNative = () => {
    const revision = ++nativeRevision;
    nativeQueue = nativeQueue.then(async () => {
      if (revision !== nativeRevision) return;
      const native = environment.nativeTheme?.();
      if (native) await native[state.mode]();
    }).catch(error => console.error("Error syncing native appearance:", error));
    return nativeQueue;
  };

  const update = (patch: Partial<AppearanceState>) => {
    const next = { ...state, ...patch };
    next.resolvedMode = resolveMode(next.mode);
    if (Object.keys(next).every(key => next[key as keyof AppearanceState] === state[key as keyof AppearanceState])) return;
    const modeChanged = next.mode !== state.mode;
    state = next;
    apply();
    listeners.forEach(listener => listener());
    if (modeChanged) void syncNative();
  };

  const persistMode = (mode: ThemeMode, id?: number) => {
    writeValue(storage, "theme", mode);
    writeValue(storage, "vite-ui-theme", mode);
    if (id !== undefined) writeValue(storage, getUserThemeKey(id), mode);
  };

  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    initialize: () => { apply(); },
    connect: () => {
      apply();
      void syncNative();
      const onSystemChange = () => { if (state.mode === "system") update({ resolvedMode: resolveMode("system") }); };
      media.addEventListener("change", onSystemChange);
      return () => media.removeEventListener("change", onSystemChange);
    },
    activateUser: (userId?: number, savedMode?: unknown) => {
      if (state.userId === userId) return;
      const preferences = resolveAppearance(storage, userId, savedMode);
      persistMode(preferences.mode, userId);
      writeValue(storage, "appearance_style", preferences.style);
      writeValue(storage, "color_theme", preferences.palette);
      update({ ...preferences, userId, previewPalette: null, canvasGradient: readCanvasGradient(storage, userId), previewCanvasGradient: undefined, canvasElevation: readCanvasElevation(storage, userId) });
    },
    setMode: (mode: ThemeMode, userId = state.userId) => {
      if (!isThemeMode(mode)) return;
      persistMode(mode, userId);
      update({ mode, previewPalette: null });
    },
    setStyle: (style: AppearanceStyle) => {
      if (!isAppearanceStyle(style)) return;
      writeValue(storage, "appearance_style", style);
      if (state.userId !== undefined) writeValue(storage, getStyleKey(state.userId), style);
      update({ style, previewPalette: null });
    },
    setPalette: (palette: ColorTheme, userId = state.userId) => {
      if (!isColorTheme(palette)) return;
      writeValue(storage, "color_theme", palette);
      if (userId !== undefined) writeValue(storage, getColorThemeKey(userId), palette);
      update({ palette, previewPalette: null });
    },
    previewPalette: (palette: ColorTheme | null) => {
      if (!APPEARANCE_STYLES[state.style].supportsPalettes || (palette !== null && !isColorTheme(palette))) return;
      update({ previewPalette: palette });
    },
    setCanvasElevation: (canvasElevation: CanvasElevation) => {
      if (!isCanvasElevation(canvasElevation)) return;
      writeValue(storage, getCanvasElevationKey(), canvasElevation);
      if (state.userId !== undefined) writeValue(storage, getCanvasElevationKey(state.userId), canvasElevation);
      update({ canvasElevation });
    },
    setCanvasGradient: (canvasGradient: CanvasGradient | null) => {
      if (canvasGradient !== null && !isCanvasGradient(canvasGradient)) return;
      const serialized = JSON.stringify(canvasGradient);
      writeValue(storage, getCanvasGradientKey(), serialized);
      if (state.userId !== undefined) writeValue(storage, getCanvasGradientKey(state.userId), serialized);
      update({ canvasGradient, previewCanvasGradient: undefined });
    },
    previewCanvasGradient: (gradient: CanvasGradient | null | undefined) => {
      if (gradient !== undefined && gradient !== null && !isCanvasGradient(gradient)) return;
      update({ previewCanvasGradient: gradient });
    },
    reapply: apply,
  };
}

let browserStore: ReturnType<typeof createAppearanceStore> | undefined;
export function getAppearanceStore() {
  if (!browserStore) {
    browserStore = createAppearanceStore({
      storage: { getItem: key => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value) },
      root: document.documentElement,
      media: window.matchMedia("(prefers-color-scheme: dark)"),
      nativeTheme: () => (window as Window & { themeMode?: NativeTheme }).themeMode,
    });
  }
  return browserStore;
}
