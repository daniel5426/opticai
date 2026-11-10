import React from "react";
import { useLocation } from "@tanstack/react-router";

const normalizePath = (path: string) => (!path || path === "/" ? "/" : path.replace(/\/+$/, ""));

// A client's pages (e.g. an order) live under /clients; the sidebar keeps the section they were opened from.
let sectionBeforeClientPage: string | null = null;
const isClientPage = (path: string) => /^\/clients\/(?!new$)[^/]+/.test(path);

/** Whether a sidebar item's url is the current section; shared by every sidebar group. */
export function useSidebarActive(urls: (string | undefined)[]) {
  const currentPath = normalizePath(useLocation().pathname);
  const onClientPage = isClientPage(currentPath);
  const matches = (url: string) => {
    const target = normalizePath(url);
    if (target === "/") return currentPath === "/";
    return currentPath === target || currentPath.startsWith(`${target}/`);
  };
  const section = urls.find((url) => url && matches(url));
  React.useEffect(() => {
    if (!onClientPage && section) sectionBeforeClientPage = normalizePath(section);
  }, [onClientPage, section]);
  return (url: string) =>
    onClientPage && sectionBeforeClientPage && sectionBeforeClientPage !== "/clients"
      ? normalizePath(url) === sectionBeforeClientPage
      : matches(url);
}
