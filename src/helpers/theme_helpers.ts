import { ThemeMode } from "@/types/theme-mode";
import { getSettings } from "@/lib/db/settings-db";

const THEME_KEY = "theme";

export interface ThemePreferences {
  system: ThemeMode;
  local: ThemeMode | null;
}

function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export async function applyThemeColorsFromSettings(providedSettings?: any): Promise<void> {
  try {
    const settings = providedSettings || await getSettings();
    if (!settings) return;

    const root = document.documentElement;
    
    // Only apply custom colors if not in dark mode
    if (root.classList.contains('dark')) {
      root.style.removeProperty('--primary');
      root.style.removeProperty('--secondary');
      return;
    }
    
    if (settings.primary_theme_color) {
      const primaryHsl = hexToHsl(settings.primary_theme_color);
      root.style.setProperty('--primary', primaryHsl);
    }
    
    if (settings.secondary_theme_color) {
      const secondaryHsl = hexToHsl(settings.secondary_theme_color);
      root.style.setProperty('--secondary', secondaryHsl);
    }
  } catch (error) {
    console.error('Error applying theme colors from settings:', error);
  }
}

export async function getCurrentTheme(): Promise<ThemePreferences> {
  const themeMode = (window as any).themeMode;
  if (!themeMode) {
    console.error('themeMode is not available on window object');
    return {
      system: 'system' as ThemeMode,
      local: null,
    };
  }
  
  const currentTheme = await themeMode.current();
  const localTheme = localStorage.getItem(THEME_KEY) as ThemeMode | null;

  return {
    system: currentTheme,
    local: localTheme,
  };
}

export async function getActualThemeState(): Promise<{ electronTheme: ThemeMode; isDark: boolean }> {
  const themeMode = (window as any).themeMode;
  if (!themeMode) {
    console.error('themeMode is not available on window object');
    return {
      electronTheme: 'system' as ThemeMode,
      isDark: document.documentElement.classList.contains('dark'),
    };
  }
  
  const electronTheme = await themeMode.current();
  const isDark = document.documentElement.classList.contains('dark');
  
  return {
    electronTheme,
    isDark,
  };
}

export async function setTheme(newTheme: ThemeMode) {
  const themeMode = (window as any).themeMode;
  if (!themeMode) {
    console.error('themeMode is not available on window object');
    return;
  }

  switch (newTheme) {
    case "dark":
      await themeMode.dark();
      updateDocumentTheme(true);
      break;
    case "light":
      await themeMode.light();
      updateDocumentTheme(false);
      break;
    case "system": {
      const isDarkMode = await themeMode.system();
      updateDocumentTheme(isDarkMode);
      break;
    }
  }

  localStorage.setItem(THEME_KEY, newTheme);
  
  await applyThemeColorsFromSettings();
}

export async function toggleTheme() {
  const themeMode = (window as any).themeMode;
  if (!themeMode) {
    console.error('themeMode is not available on window object');
    return;
  }

  const isDarkMode = await themeMode.toggle();
  const newTheme = isDarkMode ? "dark" : "light";

  updateDocumentTheme(isDarkMode);
  localStorage.setItem(THEME_KEY, newTheme);
  
  await applyThemeColorsFromSettings();
}

export async function syncThemeWithLocal() {
  const themeMode = (window as any).themeMode;
  if (!themeMode) {
    console.error('themeMode is not available on window object');
    return;
  }

  try {
    const { local } = await getCurrentTheme();
    
    if (!local) {
      // No saved theme preference - get current Electron state and save it
      const currentThemeSource = await themeMode.current();
      const themeToSave = currentThemeSource === "system" ? "system" : currentThemeSource;
      localStorage.setItem(THEME_KEY, themeToSave);
      await setTheme(themeToSave);
    } else {
      // Apply saved theme preference
      await setTheme(local);
    }
    
    await applyThemeColorsFromSettings();
  } catch (error) {
    console.error('Error syncing theme with local storage:', error);
  }
}

function updateDocumentTheme(isDark: boolean) {
  document.documentElement.classList.toggle('dark', isDark);
}
