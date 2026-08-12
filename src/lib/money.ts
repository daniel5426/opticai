import type { AppLocale } from "@/localization/locale";

export const supportedCurrencies = ["ILS", "USD", "EUR"] as const;
export type CurrencyCode = (typeof supportedCurrencies)[number];

const localeByLanguage: Record<AppLocale, string> = {
  he: "he-IL",
  en: "en-US",
  fr: "fr-FR",
};

export function normalizeCurrency(value?: string | null): CurrencyCode {
  const currency = value?.trim().toUpperCase();
  return supportedCurrencies.includes(currency as CurrencyCode)
    ? (currency as CurrencyCode)
    : "ILS";
}

export function formatMoney(
  value?: number | null,
  currency?: string | null,
  locale: AppLocale = "he",
  options?: Intl.NumberFormatOptions,
): string {
  const minimumFractionDigits =
    options?.minimumFractionDigits ?? options?.maximumFractionDigits ?? 2;
  const maximumFractionDigits =
    options?.maximumFractionDigits ?? options?.minimumFractionDigits ?? 2;
  return new Intl.NumberFormat(localeByLanguage[locale], {
    style: "currency",
    currency: normalizeCurrency(currency),
    minimumFractionDigits,
    maximumFractionDigits,
    ...options,
  }).format(Number(value) || 0);
}
