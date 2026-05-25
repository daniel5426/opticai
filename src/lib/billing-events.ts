import type { BillingPayment } from "@/lib/db/schema-interface";

export const BILLING_PAYMENTS_CHANGED_EVENT = "opticai:billing-payments-changed";

export interface BillingPaymentsChangedDetail {
  billingId: number;
  prepaymentAmount: number;
  payments?: BillingPayment[];
  orderId?: number;
  contactLensId?: number;
}

export function emitBillingPaymentsChanged(detail: BillingPaymentsChangedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<BillingPaymentsChangedDetail>(BILLING_PAYMENTS_CHANGED_EVENT, {
      detail,
    }),
  );
}

export function onBillingPaymentsChanged(
  handler: (detail: BillingPaymentsChangedDetail) => void,
) {
  if (typeof window === "undefined") return () => {};

  const listener = (event: Event) => {
    handler((event as CustomEvent<BillingPaymentsChangedDetail>).detail);
  };

  window.addEventListener(BILLING_PAYMENTS_CHANGED_EVENT, listener);
  return () => window.removeEventListener(BILLING_PAYMENTS_CHANGED_EVENT, listener);
}
