import type { ThemeMode } from "@/types/theme-mode";
import { updateUser, getUserById } from "@/lib/db/users-db";
import type { Company, User } from "@/lib/db/schema-interface";
import {
  getAppearanceStore,
  getColorThemeKey,
  getUserThemeKey,
  isColorTheme,
  isThemeMode,
  readAppearanceValue,
} from "@/lib/appearance";
import type { ColorTheme } from "@/lib/appearance";

export type { ColorTheme } from "@/lib/appearance";
export { getColorThemeKey, getUserThemeKey } from "@/lib/appearance";

export interface ThemePreferences {
  system: ThemeMode;
  local: ThemeMode | null;
}

export function getColorTheme(userId?: number): ColorTheme {
  const value = readAppearanceValue(localStorage, userId === undefined ? "color_theme" : getColorThemeKey(userId));
  return isColorTheme(value) ? value : "neutral";
}

export function applyColorTheme(_userId?: number): void {
  getAppearanceStore().reapply();
}

export function previewColorTheme(theme: ColorTheme): void {
  getAppearanceStore().previewPalette(theme);
}

export function setColorTheme(theme: ColorTheme, userId?: number): void {
  getAppearanceStore().setPalette(theme, userId);
}

// Retain the legacy company cache contract; appointment colors are separate from UI appearance.
export function cacheCompanyThemeColors(company: Company | null): void {
  try {
    if (!company) localStorage.removeItem("company_theme_colors");
    else localStorage.setItem("company_theme_colors", JSON.stringify({
      primary: company.primary_theme_color || "#3f3f46",
      secondary: company.secondary_theme_color || "#f4f4f5",
    }));
  } catch { /* appearance remains usable when storage is restricted */ }
}

export function getCompanyThemeColors(): { primary: string; secondary: string } | null {
  try {
    const cached = localStorage.getItem("company_theme_colors");
    return cached ? JSON.parse(cached) : null;
  } catch { return null; }
}

// Compatibility adapters must not resolve or overwrite the active user's style.
export function applyCompanyThemeColors(_company?: Company | null): void {
  getAppearanceStore().reapply();
}

export async function applyThemeColorsFromSettings(_providedSettings?: unknown, _userId?: number): Promise<void> {
  getAppearanceStore().reapply();
}

export function applyThemeColorsFromUserData(_user?: unknown): void {
  getAppearanceStore().reapply();
}

export async function getCurrentTheme(): Promise<ThemePreferences> {
  const mode = getAppearanceStore().getSnapshot().mode;
  const local = readAppearanceValue(localStorage, "theme");
  return { system: mode, local: isThemeMode(local) ? local : null };
}

export async function getActualThemeState(): Promise<{ electronTheme: ThemeMode; isDark: boolean }> {
  const state = getAppearanceStore().getSnapshot();
  return { electronTheme: state.mode, isDark: state.resolvedMode === "dark" };
}

export async function setTheme(newTheme: ThemeMode, userId?: number, savePreference = true) {
  if (!isThemeMode(newTheme)) return;
  const store = getAppearanceStore();
  const activeUserId = userId ?? store.getSnapshot().userId;
  store.setMode(newTheme, activeUserId);
  if (activeUserId !== undefined && savePreference) await saveUserThemePreference(activeUserId, newTheme);
}

export async function toggleTheme(currentUserId?: number) {
  const state = getAppearanceStore().getSnapshot();
  await setTheme(state.resolvedMode === "dark" ? "light" : "dark", currentUserId);
}

export async function syncThemeWithLocal() {
  getAppearanceStore().initialize();
}

// Serialize writes per user so rapid selections cannot leave an older mode on the server.
const preferenceWrites = new Map<number, Promise<void>>();
export async function saveUserThemePreference(userId: number, theme: ThemeMode): Promise<void> {
  if (!isThemeMode(theme)) return;
  try { localStorage.setItem(getUserThemeKey(userId), theme); } catch { /* best-effort cache */ }
  const write = (preferenceWrites.get(userId) ?? Promise.resolve()).then(async () => {
    try {
      const user = await getUserById(userId);
      if (user) await updateUser({ ...user, theme_preference: theme });
    } catch (error) {
      console.error("Error saving user theme preference:", error);
    }
  });
  preferenceWrites.set(userId, write);
  await write;
  if (preferenceWrites.get(userId) === write) preferenceWrites.delete(userId);
}

export function getUserThemePreference(userId: number): ThemeMode | null {
  const value = readAppearanceValue(localStorage, getUserThemeKey(userId));
  return isThemeMode(value) ? value : null;
}

export async function applyUserThemeComplete(userId: number, providedUser?: User): Promise<void> {
  const store = getAppearanceStore();
  const previousUserId = store.getSnapshot().userId;
  const user = providedUser ?? await getUserById(userId);
  if (!providedUser && store.getSnapshot().userId !== previousUserId) return;
  if (user) store.activateUser(userId, user.theme_preference);
}

export function applyUserThemeFromStorage(): void {
  getAppearanceStore().reapply();
}

export async function applyUserThemePreference(userId: number): Promise<void> {
  const store = getAppearanceStore();
  try {
    const user = await getUserById(userId);
    // A late request from a previous session must not restyle the new user.
    if (store.getSnapshot().userId !== userId) return;
    store.setMode(isThemeMode(user?.theme_preference) ? user.theme_preference : getUserThemePreference(userId) ?? "system", userId);
  } catch (error) {
    console.error("Error applying user theme preference:", error);
  }
}
