export const supportedLocales = ["he", "en"] as const;

export type AppLocale = (typeof supportedLocales)[number];

export const defaultLocale: AppLocale = "he";
// Keep the production Electron companion web build Hebrew-only until its
// bilingual rollout is explicitly enabled. The routing implementation remains
// here so that rollout does not require another architecture migration.
export const localeRoutingEnabled = false;
const languageLocalStorageKey = "lang";
const localeCookieName = "prysm_locale";
const unprefixedPaths = new Set(["/auth/callback", "/oauth/callback"]);

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return !!value && (supportedLocales as readonly string[]).includes(value);
}

export function normalizeLocale(value: string | null | undefined): AppLocale | null {
  if (!value) return null;
  const base = value.toLowerCase().split("-")[0];
  return isAppLocale(base) ? base : null;
}

export function getLocaleFromPath(pathname: string): AppLocale | null {
  const match = pathname.match(/^\/(he|en)(?:\/|$)/);
  return match ? (match[1] as AppLocale) : null;
}

export function stripLocalePrefix(pathname: string): string {
  const locale = getLocaleFromPath(pathname);
  if (!locale) return pathname || "/";
  const stripped = pathname.slice(locale.length + 1);
  return stripped || "/";
}

export function isUnprefixedPath(pathname: string): boolean {
  return unprefixedPaths.has(pathname);
}

export function getStoredLocale(): AppLocale | null {
  if (typeof window === "undefined") return null;
  try {
    return normalizeLocale(window.localStorage.getItem(languageLocalStorageKey));
  } catch {
    return null;
  }
}

export function detectPreferredLocale(): AppLocale {
  if (!localeRoutingEnabled) return defaultLocale;
  const stored = getStoredLocale();
  if (stored) return stored;

  if (typeof navigator !== "undefined") {
    for (const language of navigator.languages ?? [navigator.language]) {
      const locale = normalizeLocale(language);
      if (locale) return locale;
    }
  }

  return defaultLocale;
}

export function getActiveLocale(): AppLocale {
  if (!localeRoutingEnabled) return defaultLocale;
  if (typeof window !== "undefined") {
    const pathLocale = getLocaleFromPath(window.location.pathname);
    if (pathLocale) return pathLocale;
  }
  return detectPreferredLocale();
}

export function getDirection(locale: AppLocale): "rtl" | "ltr" {
  return locale === "he" ? "rtl" : "ltr";
}

export function localizeHref(href: string, locale = getActiveLocale()): string {
  if (!href.startsWith("/")) return href;

  const match = href.match(/^([^?#]*)(.*)$/);
  const pathname = match?.[1] || "/";
  const suffix = match?.[2] || "";

  if (isUnprefixedPath(pathname)) return `${pathname}${suffix}`;
  return `/${locale}${stripLocalePrefix(pathname)}${suffix}`;
}

export function applyDocumentLocale(locale: AppLocale) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  document.documentElement.dir = getDirection(locale);
}

export function persistLocale(locale: AppLocale) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(languageLocalStorageKey, locale);
  } catch {
    // Private browsing or restricted storage must not prevent language changes.
  }
  document.cookie = `${localeCookieName}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/**
 * Changes the visible web URL while the router continues to operate on its
 * locale-free internal routes. Electron has no browser URL to rewrite.
 */
export function replaceBrowserLocale(locale: AppLocale) {
  if (
    typeof window === "undefined" ||
    window.location.protocol === "file:" ||
    isUnprefixedPath(window.location.pathname)
  ) {
    return;
  }

  const href = localizeHref(
    `${window.location.pathname}${window.location.search}${window.location.hash}`,
    locale,
  );
  window.history.replaceState(window.history.state, "", href);
}
