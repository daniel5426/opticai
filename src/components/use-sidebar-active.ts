import React from "react";
import { useLocation } from "@tanstack/react-router";

const normalizePath = (path: string) => (!path || path === "/" ? "/" : path.replace(/\/+$/, ""));

// A client's pages (e.g. an order) live under /clients; the sidebar keeps the section they were opened from.
let lastSection: string | null = null;
const sectionByHistoryEntry = new Map<string, string>();
const MAX_REMEMBERED_ENTRIES = 256;
const isClientPage = (path: string) => /^\/clients\/(?!new$)[^/]+/.test(path);

/** Whether a sidebar item's url is the current section; shared by every sidebar group. */
export function useSidebarActive(urls: (string | undefined)[]) {
  const location = useLocation();
  const currentPath = normalizePath(location.pathname);
  const entryKey = location.state?.__TSR_key ?? location.state?.key;
  const onClientPage = isClientPage(currentPath);
  const clientSection = onClientPage
    ? (entryKey && sectionByHistoryEntry.get(entryKey)) || lastSection || "/clients"
    : null;
  const matches = (url: string) => {
    const target = normalizePath(url);
    if (target === "/") return currentPath === "/";
    return currentPath === target || currentPath.startsWith(`${target}/`);
  };
  const section = urls.find((url) => url && matches(url));
  React.useEffect(() => {
    if (clientSection) {
      lastSection = clientSection;
      if (entryKey && !sectionByHistoryEntry.has(entryKey)) {
        sectionByHistoryEntry.set(entryKey, clientSection);
        const oldestEntry = sectionByHistoryEntry.keys().next().value;
        if (sectionByHistoryEntry.size > MAX_REMEMBERED_ENTRIES && oldestEntry) {
          sectionByHistoryEntry.delete(oldestEntry);
        }
      }
    } else if (section) {
      lastSection = normalizePath(section);
    }
  }, [clientSection, entryKey, section]);
  return (url: string) =>
    clientSection && clientSection !== "/clients"
      ? normalizePath(url) === clientSection
      : matches(url);
}
