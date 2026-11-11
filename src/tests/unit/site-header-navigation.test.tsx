import React, { useSyncExternalStore } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryHistory } from "@tanstack/history";
import { expect, it, vi } from "vitest";
import { SiteHeader } from "@/components/site-header";
import { SidebarProvider } from "@/components/ui/sidebar";
import i18n from "@/localization/i18n";

const navigation = vi.hoisted(() => ({
  navigate: vi.fn(),
  runGuard: vi.fn<(proceed: () => void) => void>(),
}));
const memoryHistory = createMemoryHistory({ initialEntries: ["/settings"] });
const history = Object.assign(memoryHistory, {
  canGoForward: () => memoryHistory.location.state.__TSR_index < memoryHistory.length - 1,
});

vi.mock("@tanstack/react-router", () => ({
  useCanGoBack: () => useSyncExternalStore(history.subscribe, history.canGoBack),
  useLocation: () => history.location,
  useNavigate: () => navigation.navigate,
  useRouter: () => ({ history }),
}));
vi.mock("@/contexts/NavigationGuardContext", () => ({
  useNavigationGuard: () => ({ runGuard: navigation.runGuard }),
}));
vi.mock("@/contexts/ClientSidebarContext", () => ({
  useClientSidebar: () => ({ currentClient: null }),
}));
vi.mock("@/hooks/client/useClientTabQueries", () => ({
  useClientExamDatesQuery: () => ({}),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/components/agent/AgentVoice", () => ({ AgentEntryButtons: () => null }));

it.each([
  { locale: "he", dir: "rtl", back: "חזרה", forward: "קדימה", backArrow: "right", forwardArrow: "left" },
  { locale: "en", dir: "ltr", back: "Back", forward: "Forward", backArrow: "left", forwardArrow: "right" },
  { locale: "fr", dir: "ltr", back: "Retour", forward: "Avancer", backArrow: "left", forwardArrow: "right" },
])("groups the sidebar toggle with guarded history controls in $locale", async ({
  locale, dir, back, forward, backArrow, forwardArrow,
}) => {
  await i18n.changeLanguage(locale);
  history.go(-history.length);
  history.push("/exam-layouts");
  navigation.runGuard.mockReset();
  render(<SidebarProvider><SiteHeader title="Page title" /></SidebarProvider>);

  const backButton = screen.getByRole("button", { name: back });
  const sidebarButton = screen.getByRole("button", { name: "Toggle Sidebar" });
  const forwardButton = screen.getByRole("button", { name: forward });
  const title = screen.getByRole("heading", { name: "Page title" });
  const header = title.closest("header");

  expect(header).toHaveAttribute("dir", dir);
  expect(Array.from(header!.querySelectorAll("button"))).toEqual([backButton, sidebarButton, forwardButton]);
  expect(sidebarButton.parentElement).toContainElement(forwardButton);
  expect(sidebarButton.parentElement).not.toContainElement(title);
  expect(backButton.querySelector(`.lucide-arrow-${backArrow}`)).toBeInTheDocument();
  expect(forwardButton.querySelector(`.lucide-arrow-${forwardArrow}`)).toBeInTheDocument();
  expect(forwardButton).toBeDisabled();

  fireEvent.click(backButton);
  expect(history.location.pathname).toBe("/exam-layouts");
  act(() => navigation.runGuard.mock.lastCall![0]());
  expect(history.location.pathname).toBe("/settings");
  expect(forwardButton).toBeEnabled();

  fireEvent.click(forwardButton);
  expect(history.location.pathname).toBe("/settings");
  act(() => navigation.runGuard.mock.lastCall![0]());
  expect(history.location.pathname).toBe("/exam-layouts");
  expect(forwardButton).toBeDisabled();
});
