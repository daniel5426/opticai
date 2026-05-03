import React from "react"
import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { rootTree } from "./routes";

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
  path === "/auth/callback" || path === "/oauth/callback";

const isPackagedIndexPath = (path: string) =>
  path === "/index.html" ||
  path.endsWith("/index.html") ||
  /^\/[A-Za-z]:\//.test(path);

const isUsableStoredPath = (path: string) =>
  path.startsWith("/") &&
  !isCallbackPath(path) &&
  !isPackagedIndexPath(path);

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
    window.location.pathname + window.location.search + window.location.hash;
  return fallback || "/";
};

// Create the memory history with error handling
// IMPORTANT: Initialize history with the actual current URL so popup/callback
// windows render the correct route (e.g. /auth/callback) instead of '/'
const initialEntry = resolveInitialEntry();

const history = createMemoryHistory({
  initialEntries: [initialEntry],
});

// Create router with error handlers
export const router = createRouter({
  routeTree: rootTree,
  history: history,
  defaultErrorComponent: ({ error }) => {
    console.error('Router error:', error);
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Navigation Error</h2>
        <p>There was a problem loading this page.</p>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: '8px 16px', marginTop: '16px', cursor: 'pointer' }}
        >
          Try Again
        </button>
      </div>
    );
  },
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
