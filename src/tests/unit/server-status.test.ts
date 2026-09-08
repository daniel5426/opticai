import { afterEach, describe, expect, it, vi } from "vitest";
import { checkServerConnection } from "@/contexts/ServerStatusContext";

describe("server connection status", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("trusts a successful health check when navigator.onLine is stale", async () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    const request = vi.fn().mockResolvedValue({ ok: true });

    await expect(
      checkServerConnection("https://api.example.com", request),
    ).resolves.toBeNull();
    expect(request).toHaveBeenCalledWith(
      "https://api.example.com/health",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("reports client offline only after the health request fails", async () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    const request = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      checkServerConnection("https://api.example.com", request),
    ).resolves.toBe("client-offline");
  });

  it("reports server unavailable when the request fails while online", async () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(true);
    const request = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      checkServerConnection("https://api.example.com", request),
    ).resolves.toBe("server");
  });
});
