import { describe, expect, it } from "vitest";
import { formatMoney, normalizeCurrency } from "@/lib/money";

describe("money", () => {
  it("normalizes supported currencies and defaults unknown values to ILS", () => {
    expect(normalizeCurrency("usd")).toBe("USD");
    expect(normalizeCurrency("EUR")).toBe("EUR");
    expect(normalizeCurrency("CAD")).toBe("ILS");
  });

  it("formats ILS, USD, and EUR with their own currency", () => {
    expect(formatMoney(100, "ILS", "en")).toContain("₪");
    expect(formatMoney(100, "USD", "en")).toContain("$");
    expect(formatMoney(100, "EUR", "en")).toContain("€");
    expect(() =>
      formatMoney(100, "ILS", "he", { maximumFractionDigits: 0 }),
    ).not.toThrow();
  });
});
