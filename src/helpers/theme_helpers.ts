/// <reference path="../types/electron.d.ts" />
import { ThemeMode } from "../types/theme-mode";

const THEME_KEY = "theme";

export interface ThemePreferences {
  system: ThemeMode;
  local: ThemeMode | null;
}

export async function getCurrentTheme(): Promise<ThemePreferences> {
  if (!window.themeMode) {
    console.error('themeMode is not available on window object');
    return {
      system: 'system' as ThemeMode,
      local: null,
    };
  }
  
  const currentTheme = await window.themeMode.current() as ThemeMode;
  const localTheme = localStorage.getItem(THEME_KEY) as ThemeMode | null;

  return {
    system: currentTheme,
    local: localTheme,
  };
}

export async function setTheme(newTheme: ThemeMode) {
  if (!window.themeMode) {
    console.error('themeMode is not available on window object');
    return;
  }

  switch (newTheme) {
    case "dark":
      await window.themeMode.dark();
      updateDocumentTheme(true);
      break;
    case "light":
      await window.themeMode.light();
      updateDocumentTheme(false);
      break;
    case "system": {
      const isDarkMode = await window.themeMode.system();
      updateDocumentTheme(isDarkMode);
      break;
    }
  }

  localStorage.setItem(THEME_KEY, newTheme);
}

export async function toggleTheme() {
  if (!window.themeMode) {
    console.error('themeMode is not available on window object');
    return;
  }

  const isDarkMode = await window.themeMode.toggle();
  const newTheme = isDarkMode ? "dark" : "light";

  updateDocumentTheme(isDarkMode);
  localStorage.setItem(THEME_KEY, newTheme);
}

export async function syncThemeWithLocal() {
  const { local } = await getCurrentTheme();
  if (!local) {
    setTheme("system");
    return;
  }

  await setTheme(local);
}

function updateDocumentTheme(isDarkMode: boolean) {
  if (!isDarkMode) {
    document.documentElement.classList.remove("dark");
  } else {
    document.documentElement.classList.add("dark");
  }
}
