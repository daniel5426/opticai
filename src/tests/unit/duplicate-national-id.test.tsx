import React from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { normalizeNationalId, useDuplicateNationalId } from "@/hooks/client/useDuplicateNationalId";
import { getPaginatedClients } from "@/lib/db/clients-db";

vi.mock("@/lib/db/clients-db", () => ({ getPaginatedClients: vi.fn() }));
afterEach(() => vi.mocked(getPaginatedClients).mockReset());

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

describe("duplicate national ID check", () => {
  test("IDs compare as digits without leading zeros", () => {
    expect(normalizeNationalId(" 022-153451 ")).toBe("22153451");
    expect(normalizeNationalId(null)).toBe("");
  });

  test("finds another client with the same ID, ignoring partial matches", async () => {
    vi.mocked(getPaginatedClients).mockResolvedValue({
      items: [
        { id: 7, national_id: "122153451" } as any,
        { id: 9, national_id: "022153451", first_name: "Dana" } as any,
      ],
      total: null,
      hasMore: false,
    });
    const { result } = renderHook(() => useDuplicateNationalId("22153451", 60), { wrapper });
    await waitFor(() => expect(result.current?.id).toBe(9));
    expect(vi.mocked(getPaginatedClients).mock.calls[0][1]?.columnFilters).toBe(JSON.stringify({ national_id: "22153451" }));
  });

  test("leaves out the client being edited", async () => {
    vi.mocked(getPaginatedClients).mockResolvedValue({ items: [{ id: 9, national_id: "22153451" } as any], total: null, hasMore: false });
    const { result } = renderHook(() => useDuplicateNationalId("22153451", 60, { excludeClientId: 9 }), { wrapper });
    await waitFor(() => expect(getPaginatedClients).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  test("does not check short or disabled input", async () => {
    renderHook(() => useDuplicateNationalId("1234", 60), { wrapper });
    renderHook(() => useDuplicateNationalId("22153451", 60, { enabled: false }), { wrapper });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(getPaginatedClients).not.toHaveBeenCalled();
  });
});
