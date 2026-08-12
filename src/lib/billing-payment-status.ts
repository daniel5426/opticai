export const BILLING_PAYMENT_STATUS = {
  paid: "שולם",
  partial: "שולם חלקית",
  unpaid: "לא שולם",
} as const;

export function getBillingBalance(total?: number | null, paid?: number | null) {
  return Math.max(0, (Number(total) || 0) - (Number(paid) || 0));
}

export function getBillingPaymentStatus(total?: number | null, paid?: number | null) {
  const totalAmount = Number(total) || 0;
  const paidAmount = Number(paid) || 0;

  if (paidAmount <= 0) return BILLING_PAYMENT_STATUS.unpaid;
  if (totalAmount <= 0 || paidAmount >= totalAmount) return BILLING_PAYMENT_STATUS.paid;
  return BILLING_PAYMENT_STATUS.partial;
}

export function formatBillingAmount(
  value?: number | null,
  currency?: string | null,
  locale: "he" | "en" | "fr" = "he",
) {
  const locales = { he: "he-IL", en: "en-US", fr: "fr-FR" } as const;
  return new Intl.NumberFormat(locales[locale], {
    style: "currency",
    currency: currency || "ILS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}
