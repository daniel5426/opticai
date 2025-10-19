import { ThemeMode } from "@/types/theme-mode";
import { getSettings } from "@/lib/db/settings-db";
import { updateUser, getUserById } from "@/lib/db/users-db";
import { Company } from "@/lib/db/schema-interface";

const THEME_KEY = "theme";
const USER_THEME_PREFIX = "user_theme_";
const COMPANY_THEME_CACHE_KEY = "company_theme_colors";

// Helper function to wait for themeMode to be available
async function waitForThemeMode(maxWaitMs: number = 1000): Promise<boolean> {
  const startTime = Date.now();
  while (!((window as any).themeMode)) {
    if (Date.now() - startTime > maxWaitMs) {
      console.warn('themeMode not available after waiting - using fallback theme');
      return false;
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  return true;
}

// Check if themeMode is immediately available (synchronous)
function isThemeModeAvailable(): boolean {
  return !!((window as any).themeMode);
}

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

// Cache company theme colors in localStorage
export function cacheCompanyThemeColors(company: Company | null): void {
  if (!company) {
    localStorage.removeItem(COMPANY_THEME_CACHE_KEY);
    return;
  }
  
  const cache = {
    primary: company.primary_theme_color || '#2256aa',
    secondary: company.secondary_theme_color || '#cce9ff'
  };
  localStorage.setItem(COMPANY_THEME_CACHE_KEY, JSON.stringify(cache));
}

// Get cached company theme colors
export function getCompanyThemeColors(): { primary: string; secondary: string } | null {
  try {
    const cached = localStorage.getItem(COMPANY_THEME_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.error('Error reading company theme colors cache:', error);
  }
  return null;
}

// Apply company theme colors synchronously (no async database calls)
export function applyCompanyThemeColors(company?: Company | null): void {
  const root = document.documentElement;
  
  // Don't apply custom colors in dark mode
  if (root.classList.contains('dark')) {
    root.style.removeProperty('--primary');
    root.style.removeProperty('--secondary');
    return;
  }

  let colors = null;
  
  // If company provided directly, use it
  if (company?.primary_theme_color || company?.secondary_theme_color) {
    colors = {
      primary: company.primary_theme_color || '#2256aa',
      secondary: company.secondary_theme_color || '#cce9ff'
    };
  } else {
    // Otherwise get from cache
    colors = getCompanyThemeColors();
  }

  if (colors) {
    try {
      if (colors.primary) {
        const primaryHsl = hexToHsl(colors.primary);
        root.style.setProperty('--primary', primaryHsl);
      }
      
      if (colors.secondary) {
        const secondaryHsl = hexToHsl(colors.secondary);
        root.style.setProperty('--secondary', secondaryHsl);
      }
    } catch (error) {
      console.error('Error applying company theme colors:', error);
    }
  }
}

// Legacy function - now just calls applyCompanyThemeColors
export async function applyThemeColorsFromSettings(providedSettings?: any, userId?: number): Promise<void> {
  // Simply apply company colors from cache (synchronous)
  applyCompanyThemeColors();
}

// Legacy function - now just calls applyCompanyThemeColors
export function applyThemeColorsFromUserData(user?: any): void {
  // Simply apply company colors from cache (synchronous)
  applyCompanyThemeColors();
}

export async function getCurrentTheme(): Promise<ThemePreferences> {
  // Wait for themeMode to be available
  const isAvailable = await waitForThemeMode();
  if (!isAvailable) {
    return {
      system: 'system' as ThemeMode,
      local: null,
    };
  }
  
  const themeMode = (window as any).themeMode;
  const currentTheme = await themeMode.current();
  const localTheme = localStorage.getItem(THEME_KEY) as ThemeMode | null;

  return {
    system: currentTheme,
    local: localTheme,
  };
}

export async function getActualThemeState(): Promise<{ electronTheme: ThemeMode; isDark: boolean }> {
  // Wait for themeMode to be available
  const isAvailable = await waitForThemeMode();
  if (!isAvailable) {
    return {
      electronTheme: 'system' as ThemeMode,
      isDark: document.documentElement.classList.contains('dark'),
    };
  }
  
  const themeMode = (window as any).themeMode;
  const electronTheme = await themeMode.current();
  const isDark = document.documentElement.classList.contains('dark');
  
  return {
    electronTheme,
    isDark,
  };
}

export async function setTheme(newTheme: ThemeMode, userId?: number, savePreference: boolean = true) {
  // Wait for themeMode to be available
  const isAvailable = await waitForThemeMode();
  if (!isAvailable) {
    return;
  }

  const themeMode = (window as any).themeMode;

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

  if (userId && savePreference) {
    await saveUserThemePreference(userId, newTheme);
  } else if (!userId) {
    localStorage.setItem(THEME_KEY, newTheme);
  }
  
  // Apply company theme colors immediately (synchronous)
  applyCompanyThemeColors();
}

export async function toggleTheme(currentUserId?: number) {
  // Wait for themeMode to be available
  const isAvailable = await waitForThemeMode();
  if (!isAvailable) {
    return;
  }

  const themeMode = (window as any).themeMode;
  const isDarkMode = await themeMode.toggle();
  const newTheme = isDarkMode ? "dark" : "light";

  updateDocumentTheme(isDarkMode);
  
  // Save theme preference for current user if available
  if (currentUserId) {
    await saveUserThemePreference(currentUserId, newTheme);
  } else {
    // Fallback to global theme storage
    localStorage.setItem(THEME_KEY, newTheme);
  }
  
  // Apply company theme colors immediately (synchronous)
  applyCompanyThemeColors();
}

export async function syncThemeWithLocal() {
  try {
    // First, apply theme immediately from localStorage if available (CSS-only)
    const localTheme = localStorage.getItem(THEME_KEY) as ThemeMode | null;
    if (localTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (localTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      // System default
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', isDark);
    }

    // Apply company colors immediately from cache (before async theme sync)
    applyCompanyThemeColors();

    // Wait for themeMode to be available
    const isAvailable = await waitForThemeMode();
    if (!isAvailable) {
      // Continue without Electron themeMode - use CSS-only themes
      console.warn('Running in fallback mode without Electron theme integration');
      return;
    }

    const themeMode = (window as any).themeMode;

    // Now sync with Electron's theme system
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
  } catch (error) {
    console.error('Error syncing theme with local storage:', error);
  }
}

function updateDocumentTheme(isDark: boolean) {
  document.documentElement.classList.toggle('dark', isDark);
}

export function getUserThemeKey(userId: number): string {
  return `${USER_THEME_PREFIX}${userId}`;
}

export async function saveUserThemePreference(userId: number, theme: ThemeMode): Promise<void> {
  try {
    // Save to localStorage for immediate access
    localStorage.setItem(getUserThemeKey(userId), theme);
    
    // Save to database for persistence
    const user = await getUserById(userId);
    if (user) {
      await updateUser({
        ...user,
        theme_preference: theme
      });
    }
  } catch (error) {
    console.error('Error saving user theme preference:', error);
  }
}

export function getUserThemePreference(userId: number): ThemeMode | null {
  return localStorage.getItem(getUserThemeKey(userId)) as ThemeMode | null;
}

export async function applyUserThemeComplete(userId: number, providedUser?: any): Promise<void> {
  try {
    const user = providedUser || await getUserById(userId);
    if (!user) {
      console.error('User not found for theme application');
      return;
    }

    // Determine theme preference
    let userTheme: ThemeMode = user.theme_preference || 'system';
    
    // Update localStorage for future quick access
    localStorage.setItem(getUserThemeKey(userId), userTheme);

    // Wait for themeMode to be available
    const isAvailable = await waitForThemeMode();
    if (!isAvailable) {
      // Fallback to CSS-only theme without Electron integration
      const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', isDarkMode);
      // Apply company colors
      applyCompanyThemeColors();
      return;
    }

    // Apply theme mode first
    const themeMode = (window as any).themeMode;
    let isDarkMode = false;
    try {
      switch (userTheme) {
        case "dark":
          await themeMode.dark();
          isDarkMode = true;
          break;
        case "light":
          await themeMode.light();
          isDarkMode = false;
          break;
        case "system": {
          isDarkMode = await themeMode.system();
          break;
        }
      }
    } catch (error) {
      console.error('Error setting Electron theme:', error);
      // Fallback to system theme detection
      isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    // Update document theme class immediately
    document.documentElement.classList.toggle('dark', isDarkMode);

    // Apply company theme colors immediately (synchronous)
    applyCompanyThemeColors();
  } catch (error) {
    console.error('Error applying complete user theme:', error);
  }
}

export function applyUserThemeFromStorage(): void {
  // Simply apply company colors from cache (synchronous)
  applyCompanyThemeColors();
}

export async function applyUserThemePreference(userId: number): Promise<void> {
  try {
    // Always get the latest theme preference from the database
    const user = await getUserById(userId);
    let userTheme: ThemeMode | null = null;

    if (user?.theme_preference) {
      userTheme = user.theme_preference;
      // Update localStorage for future quick access
      localStorage.setItem(getUserThemeKey(userId), userTheme);
    } else {
      // Check localStorage as fallback
      userTheme = getUserThemePreference(userId);
    }

    if (userTheme) {
      await setTheme(userTheme, userId, false);
    } else {
      // Default to system theme if no preference is set
      await setTheme('system', userId, false);
    }
  } catch (error) {
    console.error('Error applying user theme preference:', error);
  }
}
