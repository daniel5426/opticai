import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAppearanceStore, resolveAppearance } from "@/lib/appearance";

function fixture(initial: Record<string, string> = {}, dark = false) {
  const values = new Map(Object.entries(initial));
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const listeners = new Set<() => void>();
  const media = { matches: dark, addEventListener: (_event: string, listener: () => void) => listeners.add(listener), removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener) };
  const native = { light: vi.fn(async () => {}), dark: vi.fn(async () => {}), system: vi.fn(async () => {}) };
  const root = document.createElement("html");
  const store = createAppearanceStore({ storage, root, media: media as unknown as MediaQueryList, nativeTheme: () => native });
  const changeSystem = (next: boolean) => { media.matches = next; listeners.forEach(listener => listener()); };
  return { values, storage, media, listeners, root, store, native, changeSystem };
}

beforeEach(() => vi.restoreAllMocks());

describe("appearance compatibility and user lifecycle", () => {
  it("defaults existing users to Classic and keeps both legacy mode keys valid", () => {
    expect(resolveAppearance(fixture().storage)).toEqual({ mode: "system", style: "classic", palette: "neutral" });
    expect(resolveAppearance(fixture({ theme: "dark" }).storage).mode).toBe("dark");
    expect(resolveAppearance(fixture({ "vite-ui-theme": "light", theme: "dark" }).storage).mode).toBe("light");
  });
  it("uses the saved user mode before cache and device values; ignores invalid values", () => {
    const { storage } = fixture({ user_theme_4: "dark", theme: "light", user_appearance_style_4: "unknown", user_color_theme_4: "unknown" });
    expect(resolveAppearance(storage, 4, "system")).toEqual({ mode: "system", style: "classic", palette: "neutral" });
    expect(resolveAppearance(storage, 4, "unknown").mode).toBe("dark");
  });
  it("initializes root appearance before React, without Electron", () => {
    const { root, store } = fixture({ theme: "dark", appearance_style: "pro" });
    store.initialize();
    expect(root.dataset.style).toBe("pro");
    expect(root.className).toBe("dark");
    expect(root.style.colorScheme).toBe("dark");
  });
  it("restores each user's style and palette without leaking another user's Pro preference", () => {
    const { values, root, store } = fixture({ user_appearance_style_1: "pro", user_color_theme_1: "forest", user_color_theme_2: "blue" });
    store.activateUser(1, "light");
    expect(root.dataset.style).toBe("pro");
    store.activateUser(2, "light");
    expect(store.getSnapshot()).toMatchObject({ userId: 2, style: "classic", palette: "blue" });
    store.setStyle("pro");
    expect(values.get("user_appearance_style_2")).toBe("pro");
    store.activateUser(1, "dark");
    expect(store.getSnapshot()).toMatchObject({ style: "pro", palette: "forest", mode: "dark" });
    store.activateUser(undefined);
    expect(store.getSnapshot().userId).toBeUndefined();
    store.setStyle("classic");
    expect(values.get("user_appearance_style_1")).toBe("pro");
  });
  it("restores persisted style, palette, and mode across a fresh startup", () => {
    const { storage, root, media, store } = fixture();
    store.activateUser(7, "light");
    store.setPalette("plum"); store.setStyle("pro"); store.setMode("dark");
    const restarted = createAppearanceStore({ storage, root, media: media as unknown as MediaQueryList });
    restarted.initialize();
    expect(restarted.getSnapshot()).toMatchObject({ style: "pro", mode: "dark", palette: "plum" });
    restarted.activateUser(7, "dark");
    restarted.setStyle("classic");
    expect(restarted.getSnapshot().palette).toBe("plum");
    restarted.setMode("light");
    expect(root.style.getPropertyValue("--primary")).not.toBe("");
  });
  it("does not reapply stale login preferences during clinic navigation", () => {
    const { store } = fixture();
    store.activateUser(1, "light");
    store.setMode("dark");
    store.setStyle("pro");
    store.activateUser(1, "light");
    expect(store.getSnapshot()).toMatchObject({ mode: "dark", style: "pro" });
  });
  it("saves browser mode changes immediately to compatible keys", () => {
    const { values, store, root } = fixture();
    store.activateUser(4);
    store.setMode("dark");
    expect(root.classList.contains("dark")).toBe(true);
    for (const key of ["theme", "vite-ui-theme", "user_theme_4"]) expect(values.get(key)).toBe("dark");
  });
  it("continues when browser storage cannot be read or written", () => {
    const storage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    const root = document.createElement("html");
    const store = createAppearanceStore({ storage, root, media: fixture().media as unknown as MediaQueryList });
    expect(() => { store.setMode("dark"); store.setStyle("pro"); store.setPalette("forest"); }).not.toThrow();
    expect(root.dataset.style).toBe("pro");
    expect(root.classList.contains("dark")).toBe(true);
  });
});

describe("Classic palette previews and Pro isolation", () => {
  it("restores the committed Classic palette after cancelled pointer or keyboard preview", () => {
    const { store, root, values } = fixture({ color_theme: "forest", theme: "light" });
    store.initialize();
    const committedPrimary = root.style.getPropertyValue("--primary");
    store.previewPalette("blue");
    expect(root.style.getPropertyValue("--primary")).not.toBe(committedPrimary);
    expect(values.get("color_theme")).toBe("forest");
    expect(store.getSnapshot().palette).toBe("forest");
    store.previewPalette(null);
    expect(root.style.getPropertyValue("--primary")).toBe(committedPrimary);
  });
  it("previews Bloom without persisting it, and restores the saved selection on restart", () => {
    const { store, root, values, storage, media } = fixture({ color_theme: "forest", theme: "light" });
    store.initialize();
    store.previewPalette("bloom");
    expect(root.dataset.palette).toBe("bloom");
    expect(values.get("color_theme")).toBe("forest");
    store.previewPalette(null);
    expect(root.dataset.palette).toBe("forest");
    store.activateUser(7, "light");
    store.setPalette("bloom");
    expect(values.get("user_color_theme_7")).toBe("bloom");
    const restarted = createAppearanceStore({ storage, root, media: media as unknown as MediaQueryList });
    restarted.initialize();
    expect(root.dataset.palette).toBe("bloom");
    restarted.setStyle("pro");
    expect(root.dataset.style).toBe("pro");
    restarted.setStyle("classic");
    expect(root.dataset.palette).toBe("bloom");
    restarted.setPalette("blue");
    expect(root.dataset.palette).toBe("blue");
  });
  it("Pro clears Classic inline colors, ignores previews, and restores the palette on return", () => {
    const { store, root } = fixture({ color_theme: "forest", theme: "light" });
    store.initialize();
    const primary = root.style.getPropertyValue("--primary");
    store.setStyle("pro");
    store.previewPalette("blue");
    expect(root.style.getPropertyValue("--primary")).toBe("");
    expect(root.style.getPropertyValue("--sidebar")).toBe("");
    expect(store.getSnapshot().palette).toBe("forest");
    store.setStyle("classic");
    expect(root.style.getPropertyValue("--primary")).toBe(primary);
  });
  it("applies a dark variant of the Classic palette in dark mode", () => {
    const { store, root } = fixture({ color_theme: "forest", theme: "light" });
    store.initialize();
    const lightPrimary = root.style.getPropertyValue("--primary");
    store.setMode("dark");
    const darkPrimary = root.style.getPropertyValue("--primary");
    expect(darkPrimary).not.toBe("");
    expect(darkPrimary).not.toBe(lightPrimary);
    store.setPalette("plum");
    expect(root.style.getPropertyValue("--primary")).not.toBe(darkPrimary);
    store.setMode("light");
    store.setPalette("forest");
    expect(root.style.getPropertyValue("--primary")).toBe(lightPrimary);
  });
});

describe("system mode and optional Electron synchronization", () => {
  it("tracks OS changes only in system mode and removes the listener on disconnect", () => {
    const { store, root, listeners, changeSystem } = fixture();
    const unsubscribe = store.connect();
    changeSystem(true);
    expect(store.getSnapshot().resolvedMode).toBe("dark");
    expect(root.classList.contains("dark")).toBe(true);
    store.setMode("light");
    changeSystem(false); changeSystem(true);
    expect(store.getSnapshot().resolvedMode).toBe("light");
    store.setMode("system");
    expect(store.getSnapshot().resolvedMode).toBe("dark");
    unsubscribe();
    expect(listeners.size).toBe(0);
  });
  it("notifies subscribers for legacy/store changes and cancels subscription cleanly", () => {
    const { store } = fixture();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.setStyle("pro");
    expect(listener).toHaveBeenCalledOnce();
    store.setStyle("pro");
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe(); store.setStyle("classic");
    expect(listener).toHaveBeenCalledOnce();
  });
  it("coalesces rapid native requests to the last selected mode", async () => {
    const { store, native } = fixture();
    store.connect();
    store.setMode("dark");
    store.setMode("light");
    await vi.waitFor(() => expect(native.light).toHaveBeenCalledOnce());
    expect(native.dark).not.toHaveBeenCalled();
    expect(native.system).not.toHaveBeenCalled();
  });
  it("keeps local appearance and future selections usable after native failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { store, native, root } = fixture();
    native.dark.mockRejectedValueOnce(new Error("IPC unavailable"));
    store.setMode("dark");
    await vi.waitFor(() => expect(native.dark).toHaveBeenCalledOnce());
    expect(root.classList.contains("dark")).toBe(true);
    store.setMode("light");
    await vi.waitFor(() => expect(native.light).toHaveBeenCalledOnce());
    expect(root.classList.contains("light")).toBe(true);
  });
});

describe("raised surface preference", () => {
  it("starts raised, persists per user, and restores the flat shadow", () => {
    const { store, root, storage, media, values } = fixture();
    store.initialize();
    expect(root.dataset.canvasElevation).toBe("lift");
    store.activateUser(7, "light");
    store.setCanvasElevation("flat");
    expect(root.dataset.canvasElevation).toBe("flat");
    expect(values.get("user_canvas_elevation_7")).toBe("flat");
    const restarted = createAppearanceStore({ storage, root, media: media as unknown as MediaQueryList });
    restarted.activateUser(7, "light");
    expect(restarted.getSnapshot().canvasElevation).toBe("flat");
    restarted.activateUser(8, "light");
    expect(root.dataset.canvasElevation).toBe("lift");
    restarted.setCanvasElevation("lift");
    expect(values.get("user_canvas_elevation_7")).toBe("flat");
  });
});

describe("page gradient preferences", () => {
  const custom = { colorOne: "#2389dc", colorTwo: "#c4b5fd", angle: 90, strength: 60, grain: 25 };
  it("previews without saving and cancels back to the committed gradient", () => {
    const { store, root, values } = fixture();
    store.initialize();
    store.previewCanvasGradient(custom);
    expect(root.dataset.canvasGradient).toBe("custom");
    expect(root.style.getPropertyValue("--canvas-gradient-image")).toContain("#c4b5fd");
    expect(values.get("appearance_canvas_gradient")).toBeUndefined();
    store.previewCanvasGradient(undefined);
    expect(root.dataset.canvasGradient).toBe("default");
    expect(root.style.getPropertyValue("--canvas-gradient-image")).toBe("");
    store.setCanvasGradient(custom);
    store.previewCanvasGradient(null);
    expect(root.dataset.canvasGradient).toBe("default");
    store.previewCanvasGradient(undefined);
    expect(root.dataset.canvasGradient).toBe("custom");
  });
  it("persists per user, survives startup, and does not carry drafts to another user", () => {
    const { store, root, storage, media, values } = fixture();
    store.activateUser(7, "light");
    store.setCanvasGradient(custom);
    expect(JSON.parse(values.get("user_canvas_gradient_7")!)).toEqual(custom);
    const restarted = createAppearanceStore({ storage, root, media: media as unknown as MediaQueryList });
    restarted.activateUser(7, "light");
    expect(restarted.getSnapshot().canvasGradient).toEqual(custom);
    restarted.previewCanvasGradient({ ...custom, colorOne: "#14b8a6" });
    restarted.activateUser(8, "light");
    expect(root.dataset.canvasGradient).toBe("default");
    expect(restarted.getSnapshot().previewCanvasGradient).toBeUndefined();
    restarted.activateUser(7, "light");
    expect(restarted.getSnapshot().canvasGradient).toEqual(custom);
    restarted.setCanvasGradient(null);
    const reset = createAppearanceStore({ storage, root, media: media as unknown as MediaQueryList });
    reset.activateUser(7, "light");
    expect(root.dataset.canvasGradient).toBe("default");
  });
  it("ignores malformed stored values and rejects invalid edits", () => {
    const { store, root } = fixture({ appearance_canvas_gradient: '{"colorOne":"url(evil)"}' });
    store.initialize();
    expect(root.dataset.canvasGradient).toBe("default");
    store.setCanvasGradient({ ...custom, grain: 101 });
    store.previewCanvasGradient({ ...custom, colorTwo: "red; background: black" });
    expect(root.dataset.canvasGradient).toBe("default");
  });
});
