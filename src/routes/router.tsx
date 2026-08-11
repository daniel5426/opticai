import React from "react"
import { createRouter } from "@tanstack/react-router";
import { createBrowserHistory, createMemoryHistory, parseHref } from "@tanstack/history";
import { useTranslation } from "react-i18next";
import { rootTree } from "./routes";
import {
  detectPreferredLocale,
  getLocaleFromPath,
  isUnprefixedPath,
  localeRoutingEnabled,
  localizeHref,
  stripLocalePrefix,
} from "@/localization/locale";

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const serializeSearch = (search: unknown): string => {
  if (!search) return "";

  if (typeof search === "string") {
    if (!search.length) return "";
    return search.startsWith("?") ? search : `?${search}`;
  }

  if (typeof search === "object") {
    try {
      const params = new URLSearchParams();
      Object.entries(search as Record<string, unknown>).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        if (Array.isArray(value)) {
          value.forEach((entry) => params.append(key, String(entry)));
          return;
        }
        params.set(key, String(value));
      });
      const query = params.toString();
      return query ? `?${query}` : "";
    } catch {
      return "";
    }
  }

  return "";
};

const isCallbackPath = (path: string) =>
  isUnprefixedPath(path);

const isPackagedIndexPath = (path: string) =>
  path === "/index.html" ||
  path.endsWith("/index.html") ||
  /^\/[A-Za-z]:\//.test(path);

const isUsableStoredPath = (path: string) =>
  path.startsWith("/") &&
  !isCallbackPath(path) &&
  !isPackagedIndexPath(path);

function RouteError({ error }: { error: Error }) {
  const { t } = useTranslation();
  console.error("Router error:", error);
  return (
    <div style={{ padding: "20px", textAlign: "center" }}>
      <h2>{t("navigationError")}</h2>
      <p>{t("navigationErrorDescription")}</p>
      <button
        onClick={() => window.location.reload()}
        style={{ padding: "8px 16px", marginTop: "16px", cursor: "pointer" }}
      >
        {t("tryAgain")}
      </button>
    </div>
  );
}

const resolveInitialEntry = (): string => {
  if (typeof window === "undefined") return "/";

  try {
    // CRITICAL: If the current browser URL is a callback, WE MUST USE IT.
    // Otherwise the memory history will boot into the last saved app path
    // and ignore the login tokens in the URL/Hash.
    const currentPath = window.location.pathname;
    if (isCallbackPath(currentPath)) {
      return currentPath + window.location.search + window.location.hash;
    }

    const storedPath = localStorage.getItem("lastAppPath");
    if (storedPath && isUsableStoredPath(storedPath)) {
      return storedPath;
    }

    if (storedPath && !isUsableStoredPath(storedPath)) {
      localStorage.removeItem("lastAppPath");
    }
  } catch (error) {
    console.error("[Router] Failed to read stored path:", error);
  }

  if (window.location.protocol === "file:" && isPackagedIndexPath(window.location.pathname)) {
    return "/";
  }

  const fallback =
    stripLocalePrefix(window.location.pathname) + window.location.search + window.location.hash;
  return fallback || "/";
};

const isWebBrowser =
  typeof window !== "undefined" &&
  window.location.protocol !== "file:" &&
  !window.electronAPI;

/**
 * The router intentionally sees locale-free paths, so existing route
 * definitions and internal links remain compatible. Browser-facing hrefs are
 * prefixed by the history adapter (for example, /clients -> /he/clients).
 */
const history = isWebBrowser
  ? (() => {
      const currentPath = window.location.pathname;
      const requestedLocale = getLocaleFromPath(currentPath);
      if ((!localeRoutingEnabled || !requestedLocale) && !isCallbackPath(currentPath)) {
        const locale = detectPreferredLocale();
        window.history.replaceState(
          window.history.state,
          "",
          localizeHref(`${currentPath}${window.location.search}${window.location.hash}`, locale),
        );
      }

      return createBrowserHistory({
        parseLocation: () => {
          const physicalHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
          const internalHref = isCallbackPath(window.location.pathname)
            ? physicalHref
            : `${stripLocalePrefix(window.location.pathname)}${window.location.search}${window.location.hash}`;
          return parseHref(internalHref, window.history.state);
        },
        createHref: (href) => localizeHref(href),
      });
    })()
  : createMemoryHistory({
      initialEntries: [resolveInitialEntry()],
    });

// Create router with error handlers
export const router = createRouter({
  routeTree: rootTree,
  history: history,
  defaultErrorComponent: RouteError,
  defaultPreloadStaleTime: 0,
  defaultStaleTime: 0,
});

if (typeof window !== 'undefined') {
  const pathWithSearch = `${history.location.pathname}${history.location.search}${history.location.hash}`;
  try {
    const isCallbackRoute =
      history.location.pathname === '/auth/callback' ||
      history.location.pathname === '/oauth/callback';

    if (!isCallbackRoute && isUsableStoredPath(pathWithSearch)) {
      localStorage.setItem('lastAppPath', pathWithSearch);
      const isControlCenterContext =
        history.location.pathname === '/' || history.location.pathname.startsWith('/control-center');
      localStorage.setItem('lastAppContext', isControlCenterContext ? 'control-center' : 'clinic');
    }
  } catch (error) {
    console.error('[Router] Failed to persist initial path/context:', error);
  }
}

export const routerHistory = history;

// Inject router into authService to avoid circular dependency issues
import { authService } from "@/lib/auth/AuthService";
authService.setRouter(router, routerHistory);
