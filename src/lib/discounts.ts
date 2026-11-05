import { apiClient } from './api-client';
import type { Billing, OrderLineItem } from './db/schema-interface';

export interface DiscountDefinition {
  id: number;
  clinic_id: number;
  description: string;
  amount: number;
  currency: 'ILS' | 'USD' | 'EUR';
}

export async function discountRequest<T>(clinicId: number, path = '', options?: RequestInit): Promise<T> {
  const response = await apiClient.discountRequest<T>(`${path}?clinic_id=${clinicId}`, options);
  if (response.error) throw new Error(String(response.error));
  return response.data as T;
}

export const isDiscountLine = (item: OrderLineItem) => !Number(item.price) && Number(item.discount) > 0;

export function discountLine(definition: DiscountDefinition, billing: Billing, items: OrderLineItem[]): OrderLineItem {
  if (definition.currency !== (billing.currency || 'ILS')) throw new Error('cannotMixCurrencies');
  return {
    id: -(Math.max(0, ...items.map(item => Math.abs(item.id || 0))) + 1),
    billings_id: billing.id || 0,
    description: definition.description,
    price: 0, quantity: 1, discount: Number(definition.amount), line_total: -Number(definition.amount),
    currency: definition.currency,
  };
}

const money = (value: number) => Math.round(value * 100) / 100;
const sumLines = (items: OrderLineItem[]) => items.reduce((sum, item) => sum + (Number(item.line_total) || 0), 0);

export function billingLineOffsets(baseline: Billing, baselineItems: OrderLineItem[]) {
  const priorSum = sumLines(baselineItems);
  const subtotalOffset = baseline.line_subtotal_offset ?? (baseline.id && baseline.total_before_discount != null ? baseline.total_before_discount - priorSum : 0);
  const priorDiscount = baseline.discount_amount || (baseline.total_before_discount || 0) * (baseline.discount_percent || 0) / 100;
  const totalOffset = baseline.line_total_offset ?? (baseline.id && baseline.total_after_discount != null ? baseline.total_after_discount + priorDiscount - priorSum : subtotalOffset);
  return { subtotalOffset, totalOffset };
}

// Mirror the API while retaining imported header context, including discrepancies.
export function recalculateLineBilling(billing: Billing, items: OrderLineItem[], baseline: Billing, baselineItems: OrderLineItem[]): Billing {
  const { subtotalOffset, totalOffset } = billingLineOffsets(baseline, baselineItems);
  const sum = sumLines(items);
  const subtotal = Math.max(0, money(sum + subtotalOffset));
  const discount = billing.discount_amount || money(subtotal * (billing.discount_percent || 0) / 100);
  return { ...billing, total_before_discount: subtotal, discount_amount: discount,
    total_after_discount: Math.max(0, money(sum + totalOffset - discount)) };
}
