import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import translations from "@/localization/appearance.json";

const userDb = vi.hoisted(() => ({ getUserById: vi.fn(), updateUser: vi.fn() }));
vi.mock("@/lib/db/users-db", () => userDb);

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.removeAttribute("style");
  userDb.getUserById.mockReset();
  userDb.updateUser.mockReset();
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("legacy helpers and user restoration update the mounted provider together", async () => {
  const { ThemeProvider, useTheme } = await import("@/components/theme-provider");
  const { getAppearanceStore } = await import("@/lib/appearance");
  const { setTheme } = await import("@/helpers/theme_helpers");
  function Status() {
    const { style, theme, resolvedMode, palette } = useTheme();
    return <output>{[style, theme, resolvedMode, palette].join("/")}</output>;
  }
  render(<ThemeProvider><Status /></ThemeProvider>);
  expect(screen.getByRole("status")).toHaveTextContent("classic/system/light/neutral");
  localStorage.setItem("user_appearance_style_7", "pro");
  localStorage.setItem("user_color_theme_7", "forest");
  act(() => getAppearanceStore().activateUser(7, "light"));
  expect(screen.getByRole("status")).toHaveTextContent("pro/light/light/forest");
  await act(() => setTheme("dark", 7, false));
  expect(screen.getByRole("status")).toHaveTextContent("pro/dark/dark/forest");
  expect(document.documentElement.classList.contains("dark")).toBe(true);
});

it("a failed server preference save preserves the selected browser mode and style", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  userDb.getUserById.mockResolvedValue({ id: 7, theme_preference: "light" });
  userDb.updateUser.mockRejectedValue(new Error("offline"));
  const { getAppearanceStore } = await import("@/lib/appearance");
  const { setTheme } = await import("@/helpers/theme_helpers");
  const store = getAppearanceStore();
  store.activateUser(7, "light"); store.setStyle("pro");
  await setTheme("dark", 7);
  expect(store.getSnapshot()).toMatchObject({ mode: "dark", style: "pro" });
  expect(localStorage.getItem("user_theme_7")).toBe("dark");
  expect(userDb.updateUser).toHaveBeenCalledWith(expect.objectContaining({ theme_preference: "dark" }));
});

it("serializes rapid server saves so the most recent mode is saved last", async () => {
  userDb.getUserById.mockResolvedValue({ id: 7 });
  let releaseFirst: () => void;
  userDb.updateUser.mockImplementationOnce(() => new Promise<void>(resolve => { releaseFirst = resolve; })).mockResolvedValue(undefined);
  const { getAppearanceStore } = await import("@/lib/appearance");
  const { setTheme } = await import("@/helpers/theme_helpers");
  getAppearanceStore().activateUser(7, "light");
  const first = setTheme("dark", 7), last = setTheme("light", 7);
  await vi.waitFor(() => expect(userDb.updateUser).toHaveBeenCalledTimes(1));
  releaseFirst!();
  await Promise.all([first, last]);
  expect(userDb.updateUser.mock.calls.map(([user]) => user.theme_preference)).toEqual(["dark", "light"]);
});

it("ships all appearance strings in Hebrew, English, and French", () => {
  const expected = Object.keys(translations.en).sort();
  expect(Object.keys(translations.he).sort()).toEqual(expected);
  expect(Object.keys(translations.fr).sort()).toEqual(expected);
  for (const language of Object.values(translations)) for (const value of Object.values(language)) expect(value.trim()).not.toBe("");
});
